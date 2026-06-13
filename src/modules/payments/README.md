# Payments Module

## Português (pt-BR)

### Visão geral

O módulo `payments` registra pagamentos de parcelas e absorve webhooks simulados com idempotência. Ele existe para transformar uma intenção de quitação em escrita consistente sobre dois agregados relacionados: `Payment` e `Installment`.

Na prática, o módulo protege três pontos sensíveis do desafio:

- não registrar o mesmo pagamento duas vezes
- não ultrapassar o saldo restante da parcela
- manter o estado da parcela coerente após pagamentos manuais ou via webhook

### Contexto no domínio

No fluxo da Parcela Mais, acordos geram parcelas, parcelas vencidas entram em cobrança, e pagamentos encerram total ou parcialmente a dívida operacional. `payments` é o ponto onde dinheiro confirmado vira fato de domínio.

Ele não decide política de cobrança. Ele recebe um pagamento já autorizado ou um evento externo já considerado válido e aplica as regras de consistência financeira.

### Escopo atual

Responsabilidades principais:

- registrar pagamento direto em `POST /payments`
- processar webhook simulado em `POST /webhooks/payments/simulated`
- garantir idempotência por `clinicId + idempotencyKey`
- reaproveitar pagamento já persistido quando a mesma carga chega de novo
- validar que o valor não excede o saldo da parcela
- atualizar a parcela dentro da mesma transação do pagamento

Fora do escopo atual:

- integração real com gateway externo
- estorno, chargeback ou cancelamento
- conciliação bancária
- split de pagamento entre múltiplas parcelas
- reprocessamento em lote

### Modelo de domínio

`PaymentEntity` em `src/modules/payments/domain/entities/payment.entity.ts`

Campos:

- `clinicId`, `installmentId`
- `amount`
- `method`
- `externalReference`
- `idempotencyKey`
- `idempotencyPayloadHash`
- `paidAt`

Invariantes:

- `clinicId` é obrigatório
- `installmentId` é obrigatório
- `amount` deve ser `MoneyVo`
- `amount` deve ser positivo
- `method` deve existir em `EPaymentMethod`
- `idempotencyKey` é obrigatória
- `idempotencyPayloadHash` é obrigatória
- `paidAt` deve ser `Date` válida

Normalizações:

- `externalReference` recebe `trim` e vira `null` quando vazia
- `idempotencyKey` recebe `trim`
- `idempotencyPayloadHash` recebe `trim`

Erros de domínio:

- `PAYMENT_CLINIC_ID_REQUIRED`
- `PAYMENT_INSTALLMENT_ID_REQUIRED`
- `PAYMENT_AMOUNT_REQUIRED`
- `PAYMENT_AMOUNT_MUST_BE_POSITIVE`
- `INVALID_PAYMENT_METHOD`
- `PAYMENT_IDEMPOTENCY_KEY_REQUIRED`
- `PAYMENT_IDEMPOTENCY_PAYLOAD_HASH_REQUIRED`
- `PAYMENT_PAID_AT_REQUIRED`

Comportamentos úteis:

- `isFromWebhook()`
- `hasExternalReference()`

### Regras de negócio principais

`RegisterPaymentUseCase` é a regra central do módulo.

Fluxo:

1. valida `clinicId`, `installmentId` e `paidAt`
2. carrega a parcela no escopo da clínica
3. calcula hash determinístico do payload de idempotência
4. verifica duplicidade por `idempotencyKey`
5. verifica duplicidade por `externalReference`, quando existir
6. rejeita parcela já paga
7. rejeita pagamento acima do saldo
8. cria `PaymentEntity`
9. chama `installment.registerPayment(...)`
10. persiste pagamento e atualização da parcela na mesma transação

Decisões importantes:

- mesma `idempotencyKey` com mesmo payload retorna o pagamento existente com `reused: true`
- mesma `idempotencyKey` com payload diferente gera `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`
- mesma `externalReference` com mesmo payload também reaproveita
- mesma `externalReference` com payload diferente gera `EXTERNAL_REFERENCE_PAYLOAD_MISMATCH`
- violação de unicidade por corrida concorrente tenta recarregar o registro vencedor antes de falhar

Erros de aplicação mais relevantes:

- `INSTALLMENT_NOT_FOUND`
- `INVALID_PAYMENT_PAID_AT`
- `INSTALLMENT_ALREADY_PAID`
- `PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE`
- `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`
- `EXTERNAL_REFERENCE_PAYLOAD_MISMATCH`
- `INSTALLMENT_CONCURRENT_MODIFICATION`

### Webhook simulado

`ProcessSimulatedPaymentWebhookUseCase` adapta evento externo ao mesmo fluxo interno de pagamento.

Papel do caso de uso:

- normalizar `provider`, `eventId`, `externalReference` e `paidAt`
- gerar chave idempotente no formato `webhook:{PROVIDER}:{EVENT_ID}`
- criar ou reaproveitar `PaymentWebhookEvent`
- impedir replay com payload diferente
- reprocessar falhas retryable
- reconstruir resposta quando o webhook já foi processado antes

Classificação de falha:

- erros de negócio definitivos ficam marcados como não retryable
- falhas inesperadas ficam retryable
- replay de evento processado retorna `webhookReplay: true` e `paymentReused: true`

Isso conecta `payments` ao módulo `payment-webhook-events`, que guarda trilha de auditoria e estado de processamento.

### Persistência

Tabela Prisma/Postgres: `payments`

Campos principais:

- `id`
- `clinic_id`
- `installment_id`
- `amount_cents`
- `method`
- `external_reference`
- `idempotency_key`
- `idempotency_payload_hash`
- `paid_at`
- `created_at`

Restrições relevantes:

- unicidade em `clinic_id + idempotency_key`
- unicidade em `clinic_id + external_reference`

Índices relevantes:

- `clinic_id`
- `clinic_id + installment_id`
- `clinic_id + paid_at`

`PaymentPrismaMapper` converte:

- `amount_cents` para `MoneyVo`
- ids persistidos para `EntityUuid`
- metadados de criação para a entidade

### Casos de uso expostos

`POST /payments`

- registra pagamento manual ou interno
- retorna dados do pagamento e da parcela após atualização

`POST /webhooks/payments/simulated`

- processa evento idempotente
- responde `201` no primeiro processamento
- responde `200` quando absorve replay já processado

### Integrações e dependências

Dependências principais:

- `installments`: consulta parcela e aplica `registerPayment`
- `payment-webhook-events`: guarda deduplicação e estado do webhook
- `TransactionManager`: garante atomicidade entre `Payment` e `Installment`
- `nestjs-pino`: logs estruturados no fluxo de webhook

`docs/PAYMENT_RULES.md` ajuda a entender as premissas de negócio adotadas pelo módulo.

### Privacidade e isolamento

O módulo respeita isolamento por clínica em toda consulta crítica:

- busca parcela por `id + clinicId`
- deduz duplicidade por `clinicId + idempotencyKey`
- deduz duplicidade por `clinicId + externalReference`
- reconstrói replay usando `clinicId` do evento persistido

Isso reduz risco de colisão entre tenants e impede reaproveitamento cruzado de referências externas.

### Observabilidade

O fluxo de webhook usa `PinoLogger` com contexto `ProcessSimulatedPaymentWebhookUseCase`.

Eventos úteis para operação:

- webhook processado
- webhook em replay
- webhook falho com `errorCode`

Como o módulo lida com dinheiro, chaves de idempotência e referências externas são sinais operacionais importantes, mas payloads completos não devem ser expostos sem necessidade.

### Testes

Cobertura observada:

- `payment.entity.spec.ts`
  valida invariantes, normalização e helpers
- `payment-idempotency-payload-hasher.service.spec.ts`
  valida hash determinístico
- `simulated-payment-webhook-payload.service.spec.ts`
  valida normalização e chave do webhook
- `register-payment.use-case.spec.ts`
  cobre pagamento total, parcial, duplicidade, saldo excedido, data inválida e falha transacional
- `process-simulated-payment-webhook.use-case.spec.ts`
  cobre criação do evento, replay, mismatch de payload e falhas persistidas

Risco residual:

- não há integração com provedor real
- comportamento depende de unicidades e transação no banco para segurar concorrência de produção

### Resumo

`payments` é o módulo que fecha o ciclo financeiro do desafio. Ele não só grava um pagamento; ele protege idempotência, impede inconsistência de saldo e conecta operação síncrona com ingestão assíncrona por webhook sem perder isolamento por clínica.

## English (en-US)

### Overview

The `payments` module registers installment payments and absorbs simulated webhooks with idempotency. It exists to turn a payment intent into a consistent write across two related aggregates: `Payment` and `Installment`.

In practice, the module protects three sensitive parts of the challenge:

- do not register the same payment twice
- do not exceed the installment remaining balance
- keep installment state coherent after manual or webhook-driven payments

### Domain context

In the Parcela Mais flow, agreements create installments, overdue installments enter collections, and payments close the operational debt fully or partially. `payments` is the point where confirmed money becomes a domain fact.

It does not decide collection policy. It receives an already authorized payment or an external event already considered valid and applies financial consistency rules.

### Current scope

Main responsibilities:

- register direct payments at `POST /payments`
- process simulated webhooks at `POST /webhooks/payments/simulated`
- guarantee idempotency through `clinicId + idempotencyKey`
- reuse an already persisted payment when the same payload arrives again
- validate that the amount does not exceed the installment balance
- update the installment inside the same transaction as the payment

Out of scope today:

- real external gateway integration
- refunds, chargebacks, or cancellations
- bank reconciliation
- splitting one payment across multiple installments
- batch reprocessing

### Domain model

`PaymentEntity` in `src/modules/payments/domain/entities/payment.entity.ts`

Fields:

- `clinicId`, `installmentId`
- `amount`
- `method`
- `externalReference`
- `idempotencyKey`
- `idempotencyPayloadHash`
- `paidAt`

Invariants:

- `clinicId` is required
- `installmentId` is required
- `amount` must be a `MoneyVo`
- `amount` must be positive
- `method` must exist in `EPaymentMethod`
- `idempotencyKey` is required
- `idempotencyPayloadHash` is required
- `paidAt` must be a valid `Date`

Normalizations:

- `externalReference` is trimmed and becomes `null` when empty
- `idempotencyKey` is trimmed
- `idempotencyPayloadHash` is trimmed

Domain errors:

- `PAYMENT_CLINIC_ID_REQUIRED`
- `PAYMENT_INSTALLMENT_ID_REQUIRED`
- `PAYMENT_AMOUNT_REQUIRED`
- `PAYMENT_AMOUNT_MUST_BE_POSITIVE`
- `INVALID_PAYMENT_METHOD`
- `PAYMENT_IDEMPOTENCY_KEY_REQUIRED`
- `PAYMENT_IDEMPOTENCY_PAYLOAD_HASH_REQUIRED`
- `PAYMENT_PAID_AT_REQUIRED`

Useful behaviors:

- `isFromWebhook()`
- `hasExternalReference()`

### Core business rules

`RegisterPaymentUseCase` is the central rule of the module.

Flow:

1. validate `clinicId`, `installmentId`, and `paidAt`
2. load the installment inside the clinic scope
3. compute a deterministic idempotency payload hash
4. check duplicates by `idempotencyKey`
5. check duplicates by `externalReference`, when present
6. reject already paid installments
7. reject payments above remaining balance
8. create `PaymentEntity`
9. call `installment.registerPayment(...)`
10. persist payment and installment update in the same transaction

Important decisions:

- same `idempotencyKey` with the same payload returns the existing payment with `reused: true`
- same `idempotencyKey` with a different payload throws `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`
- same `externalReference` with the same payload also reuses
- same `externalReference` with a different payload throws `EXTERNAL_REFERENCE_PAYLOAD_MISMATCH`
- unique-constraint races try to reload the winning record before failing

Most relevant application errors:

- `INSTALLMENT_NOT_FOUND`
- `INVALID_PAYMENT_PAID_AT`
- `INSTALLMENT_ALREADY_PAID`
- `PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE`
- `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`
- `EXTERNAL_REFERENCE_PAYLOAD_MISMATCH`
- `INSTALLMENT_CONCURRENT_MODIFICATION`

### Simulated webhook

`ProcessSimulatedPaymentWebhookUseCase` adapts an external event into the same internal payment flow.

Role of the use case:

- normalize `provider`, `eventId`, `externalReference`, and `paidAt`
- generate an idempotent key in the form `webhook:{PROVIDER}:{EVENT_ID}`
- create or reuse a `PaymentWebhookEvent`
- block replays with a different payload
- retry previously retryable failures
- rebuild the response when the webhook was already processed

Failure classification:

- definitive business errors are stored as non-retryable
- unexpected failures stay retryable
- processed-event replay returns `webhookReplay: true` and `paymentReused: true`

This connects `payments` to the `payment-webhook-events` module, which stores the audit trail and processing state.

### Technical structure

Main files:

- `src/modules/payments/payments.module.ts`
- `src/modules/payments/domain/entities/payment.entity.ts`
- `src/modules/payments/application/repositories/payment.repository.ts`
- `src/modules/payments/application/services/payment-idempotency-payload-hasher.service.ts`
- `src/modules/payments/application/services/simulated-payment-webhook-payload.service.ts`
- `src/modules/payments/application/use-cases/register-payment.use-case.ts`
- `src/modules/payments/application/use-cases/process-simulated-payment-webhook.use-case.ts`
- `src/modules/payments/infrastructure/prisma/payment-prisma.mapper.ts`
- `src/modules/payments/infrastructure/prisma/prisma-payment.repository.ts`
- `src/modules/payments/presentation/http/payments.controller.ts`
- `src/modules/payments/presentation/http/payment-webhooks.controller.ts`

Nest composition:

- imports `InstallmentsModule`
- exposes `PaymentsController` and `PaymentWebhooksController`
- registers `RegisterPaymentUseCase`
- registers `ProcessSimulatedPaymentWebhookUseCase`
- registers `PaymentRepository` with a Prisma implementation
- reuses `PaymentWebhookEventRepository` with a Prisma implementation

### Persistence

Prisma/Postgres table: `payments`

Main fields:

- `id`
- `clinic_id`
- `installment_id`
- `amount_cents`
- `method`
- `external_reference`
- `idempotency_key`
- `idempotency_payload_hash`
- `paid_at`
- `created_at`

Relevant constraints:

- unique on `clinic_id + idempotency_key`
- unique on `clinic_id + external_reference`

Relevant indexes:

- `clinic_id`
- `clinic_id + installment_id`
- `clinic_id + paid_at`

`PaymentPrismaMapper` converts:

- `amount_cents` into `MoneyVo`
- persisted ids into `EntityUuid`
- creation metadata into the entity

### Exposed use cases

`POST /payments`

- registers a manual or internal payment
- returns payment and installment data after the update

`POST /webhooks/payments/simulated`

- processes an idempotent event
- responds `201` on first processing
- responds `200` when an already processed replay is absorbed

### Integrations and dependencies

Main dependencies:

- `installments`: loads installments and applies `registerPayment`
- `payment-webhook-events`: stores webhook deduplication and state
- `TransactionManager`: guarantees atomicity between `Payment` and `Installment`
- `nestjs-pino`: structured logs in the webhook flow

`docs/PAYMENT_RULES.md` helps explain the business assumptions adopted by the module.

### Privacy and isolation

The module respects clinic isolation in every critical lookup:

- load installment by `id + clinicId`
- detect duplicates by `clinicId + idempotencyKey`
- detect duplicates by `clinicId + externalReference`
- rebuild replay using the `clinicId` stored in the event

This reduces cross-tenant collision risk and prevents cross-clinic reuse of external references.

### Observability

The webhook flow uses `PinoLogger` with context `ProcessSimulatedPaymentWebhookUseCase`.

Useful operational events:

- processed webhook
- replayed webhook
- failed webhook with `errorCode`

Because the module handles money, idempotency keys and external references are important operational signals, but full payloads should not be exposed unless necessary.

### Tests

Observed coverage:

- `payment.entity.spec.ts`
  validates invariants, normalization, and helpers
- `payment-idempotency-payload-hasher.service.spec.ts`
  validates deterministic hashing
- `simulated-payment-webhook-payload.service.spec.ts`
  validates normalization and webhook key generation
- `register-payment.use-case.spec.ts`
  covers full payment, partial payment, duplicates, exceeded balance, invalid date, and transaction failure
- `process-simulated-payment-webhook.use-case.spec.ts`
  covers event creation, replay, payload mismatch, and persisted failures

Residual risk:

- there is no real provider integration
- behavior relies on database uniqueness and transactions to hold production concurrency

### Summary

`payments` is the module that closes the financial loop of the challenge. It does not only store a payment; it protects idempotency, prevents balance inconsistencies, and connects synchronous operation with asynchronous webhook ingestion without losing clinic isolation.
