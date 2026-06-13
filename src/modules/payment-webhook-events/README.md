# Payment Webhook Events Module

## Português (pt-BR)

### Visão geral

O módulo `payment-webhook-events` concentra o registro auditável dos eventos de webhook de pagamento. Ele existe para dar suporte a idempotência, replay seguro, rastreabilidade de falhas e persistência do estado de processamento de integrações simuladas.

No desafio da Parcela Mais, este módulo é a memória operacional do fluxo de webhook. Seu papel é:

- representar o evento de webhook como entidade de domínio
- persistir o payload e seu hash
- rastrear se o evento foi recebido, processado, duplicado ou falhou
- suportar replay seguro e retentativa controlada

### Contexto no domínio

Na linguagem do projeto, `PaymentWebhookEvent` representa um evento de pagamento recebido de uma integração simulada, antes, durante ou depois do registro efetivo do pagamento.

Por isso, `payment-webhook-events` não registra o pagamento por si só. Ele preserva o envelope operacional do evento externo e a trilha de processamento necessária para evitar reprocessamento indevido.

### Escopo atual

Responsabilidade principal: manter o histórico idempotente e auditável dos webhooks de pagamento.

Fora do escopo atual: endpoint próprio isolado neste módulo, fila de reprocessamento, backoff automático, retenção/expurgo, versionamento de payload externo e integrações reais com provedores.

### Modelo de domínio

`PaymentWebhookEventEntity` em `src/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity.ts`

Campos principais:

- `clinicId`
- `installmentId`
- `paymentId`
- `provider`
- `eventId`
- `externalReference`
- `payload`
- `payloadHash`
- `status`
- `processedAt`
- `errorCode`
- `retryable`
- `errorMessage`

Status atuais:

- `RECEIVED`
- `PROCESSED`
- `DUPLICATED`
- `FAILED`

Invariantes centrais:

- `clinicId` é obrigatório
- `provider` é obrigatório
- `eventId` é obrigatório
- `payload` é obrigatório
- `payloadHash` é obrigatório
- `status` deve ser enum válido
- `processedAt`, quando informado, deve ser data válida
- evento `PROCESSED` exige `paymentId`, `installmentId` e `processedAt`
- evento `FAILED` exige `errorCode` e `retryable`

Normalizações:

- `provider` recebe `trim` e `uppercase`
- `eventId` recebe `trim`
- `externalReference`, `payloadHash`, `errorCode` e `errorMessage` recebem `trim`
- opcionais vazios viram `null`

Erros de domínio relevantes:

- `PAYMENT_WEBHOOK_CLINIC_ID_REQUIRED`
- `PAYMENT_WEBHOOK_PROVIDER_REQUIRED`
- `PAYMENT_WEBHOOK_EVENT_ID_REQUIRED`
- `PAYMENT_WEBHOOK_PAYLOAD_REQUIRED`
- `PAYMENT_WEBHOOK_PAYLOAD_HASH_REQUIRED`
- `INVALID_PAYMENT_WEBHOOK_STATUS`
- `PROCESSED_PAYMENT_WEBHOOK_REQUIRES_PAYMENT_ID_INSTALLMENT_ID_AND_PROCESSED_AT`
- `FAILED_PAYMENT_WEBHOOK_REQUIRES_ERROR_CODE_AND_RETRYABLE`
- `PAYMENT_WEBHOOK_ALREADY_PROCESSED`
- `PAYMENT_WEBHOOK_PAYMENT_ID_REQUIRED`
- `PAYMENT_WEBHOOK_INSTALLMENT_ID_REQUIRED`
- `PAYMENT_WEBHOOK_ERROR_CODE_REQUIRED`
- `PAYMENT_WEBHOOK_RETRY_REQUIRES_FAILED_STATUS`
- `PAYMENT_WEBHOOK_RETRY_REQUIRES_RETRYABLE`

Comportamentos:

- `PaymentWebhookEventEntity.create(props)`
- `PaymentWebhookEventEntity.createFrom(id, props, meta?)`
- `markAsProcessed(...)`
- `markAsDuplicated()`
- `markAsFailed(...)`
- `prepareForRetry()`

### Regras de negócio principais

Idempotência do evento:

- a chave global do webhook é `provider + eventId`
- reenvio com mesmo par deve reutilizar ou bloquear processamento
- reenvio com mesmo par e hash diferente deve ser tratado como inconsistência de payload

Processamento:

- evento começa como `RECEIVED`
- ao sucesso, vira `PROCESSED`
- ao replay reconhecido, pode virar `DUPLICATED`
- em erro, vira `FAILED`

Retentativa:

- só pode ocorrer a partir de `FAILED`
- só pode ocorrer quando `retryable === true`
- ao preparar retry, o evento volta para `RECEIVED` e limpa metadados de erro

### Persistência

Tabela Prisma/Postgres: `payment_webhook_events`

Campos principais:

- `clinic_id`
- `installment_id`
- `payment_id`
- `provider`
- `event_id`
- `external_reference`
- `payload`
- `payload_hash`
- `status`
- `processed_at`
- `error_code`
- `retryable`
- `error_message`
- `created_at`
- `updated_at`

Relacionamentos:

- `PaymentWebhookEvent` pertence a `Clinic`
- `PaymentWebhookEvent` pode apontar para `Installment`
- `PaymentWebhookEvent` pode apontar para `Payment`

Restrições e índices relevantes:

- unicidade em `provider + eventId`
- índices por `clinicId`
- índices por `clinicId + status`
- índices por `clinicId + externalReference`

### Integrações e dependências

Principal consumidor atual:

- `ProcessSimulatedPaymentWebhookUseCase` no módulo `payments`

Papel no fluxo:

- procurar evento existente por `provider + eventId`
- criar evento novo ao primeiro recebimento
- persistir transição para `PROCESSED`, `FAILED` ou `DUPLICATED`
- sustentar replay seguro e classificação de falha

Integrações indiretas:

- `InstallmentRepository`
- `PaymentRepository`
- `RegisterPaymentUseCase`

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, o módulo lida com payload sensível e deve respeitar minimização e isolamento por clínica.

Cuidados centrais:

- todo evento pertence a uma clínica
- não misturar replay entre clínicas
- não expor payload completo sem necessidade
- evitar logging verboso de payload em produção
- manter apenas o contexto financeiro e operacional necessário

### Observabilidade

Este módulo é central para rastrear o ciclo do webhook:

- evento recebido
- evento processado
- evento duplicado
- evento falho
- erro classificado e `retryable`

Erros de aplicação e sinais relevantes no fluxo consumidor:

- `PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH`
- `WEBHOOK_PROCESSING_FAILED`
- códigos de erro de negócio persistidos em `errorCode`

### Testes

Cobertura direta encontrada:

- `tests/__unit__/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity.spec.ts`
- `tests/__unit__/modules/payments/application/use-cases/process-simulated-payment-webhook.use-case.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Essas specs cobrem normalização, transições de status, falha retryable, replay seguro, mismatch de payload, duplicidade lógica e mapeamento Prisma.

### Resumo

`payment-webhook-events` é o módulo que preserva a memória idempotente do webhook de pagamento. Ele não substitui o pagamento em si, mas garante replay seguro, classificação de falhas e rastreabilidade completa do processamento externo.

## English (en-US)

### Overview

The `payment-webhook-events` module owns the auditable record of payment webhook events. It exists to support idempotency, safe replay, failure traceability, and persistence of integration-processing state for simulated webhooks.

In the Parcela Mais challenge, this module is the operational memory of the webhook flow. Its role is to:

- represent the webhook event as a domain entity
- persist the payload and its hash
- track whether the event was received, processed, duplicated, or failed
- support safe replay and controlled retry

### Domain context

In the project language, `PaymentWebhookEvent` represents a payment event received from a simulated integration before, during, or after effective payment registration.

Because of that, `payment-webhook-events` does not register the payment by itself. It preserves the external-event envelope and the processing trail needed to avoid improper reprocessing.

### Current scope

Primary responsibility: maintain idempotent and auditable payment webhook history.

Out of scope today: a standalone endpoint owned by this module, reprocessing queue, automatic backoff, retention/purge, external payload versioning, and real provider integrations.

### Domain model

`PaymentWebhookEventEntity` in `src/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity.ts`

Main fields:

- `clinicId`
- `installmentId`
- `paymentId`
- `provider`
- `eventId`
- `externalReference`
- `payload`
- `payloadHash`
- `status`
- `processedAt`
- `errorCode`
- `retryable`
- `errorMessage`

Current statuses:

- `RECEIVED`
- `PROCESSED`
- `DUPLICATED`
- `FAILED`

Core invariants:

- `clinicId` is required
- `provider` is required
- `eventId` is required
- `payload` is required
- `payloadHash` is required
- `status` must be a valid enum
- `processedAt`, when present, must be a valid date
- a `PROCESSED` event requires `paymentId`, `installmentId`, and `processedAt`
- a `FAILED` event requires `errorCode` and `retryable`

Normalizations:

- `provider` is trimmed and uppercased
- `eventId` is trimmed
- `externalReference`, `payloadHash`, `errorCode`, and `errorMessage` are trimmed
- empty optional fields become `null`

Relevant domain errors:

- `PAYMENT_WEBHOOK_CLINIC_ID_REQUIRED`
- `PAYMENT_WEBHOOK_PROVIDER_REQUIRED`
- `PAYMENT_WEBHOOK_EVENT_ID_REQUIRED`
- `PAYMENT_WEBHOOK_PAYLOAD_REQUIRED`
- `PAYMENT_WEBHOOK_PAYLOAD_HASH_REQUIRED`
- `INVALID_PAYMENT_WEBHOOK_STATUS`
- `PROCESSED_PAYMENT_WEBHOOK_REQUIRES_PAYMENT_ID_INSTALLMENT_ID_AND_PROCESSED_AT`
- `FAILED_PAYMENT_WEBHOOK_REQUIRES_ERROR_CODE_AND_RETRYABLE`
- `PAYMENT_WEBHOOK_ALREADY_PROCESSED`
- `PAYMENT_WEBHOOK_PAYMENT_ID_REQUIRED`
- `PAYMENT_WEBHOOK_INSTALLMENT_ID_REQUIRED`
- `PAYMENT_WEBHOOK_ERROR_CODE_REQUIRED`
- `PAYMENT_WEBHOOK_RETRY_REQUIRES_FAILED_STATUS`
- `PAYMENT_WEBHOOK_RETRY_REQUIRES_RETRYABLE`

Behaviors:

- `PaymentWebhookEventEntity.create(props)`
- `PaymentWebhookEventEntity.createFrom(id, props, meta?)`
- `markAsProcessed(...)`
- `markAsDuplicated()`
- `markAsFailed(...)`
- `prepareForRetry()`

### Core business rules

Event idempotency:

- the global webhook key is `provider + eventId`
- a resend with the same pair must reuse or block processing
- a resend with the same pair but a different hash must be treated as payload inconsistency

Processing:

- an event starts as `RECEIVED`
- on success it becomes `PROCESSED`
- on recognized replay it may become `DUPLICATED`
- on error it becomes `FAILED`

Retry:

- can only happen from `FAILED`
- can only happen when `retryable === true`
- preparing a retry moves the event back to `RECEIVED` and clears error metadata

### Technical structure

Main files:

- `src/modules/payment-webhook-events/application/repositories/payment-webhook-event.repository.ts`
- `src/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity.ts`
- `src/modules/payment-webhook-events/infrastructure/prisma/payment-webhook-event-prisma.mapper.ts`
- `src/modules/payment-webhook-events/infrastructure/prisma/prisma-payment-webhook-event.repository.ts`

Layers: `domain` with the entity, `application` with the persistence port, and `infrastructure` with Prisma and mapper. The module exposes no controller of its own; it is consumed by the payments flow.

Main contracts:

- `findByProviderAndEventId(provider, eventId)`
- `create(event, tx?)`
- `update(event, tx?)`

### Persistence

Prisma/Postgres table: `payment_webhook_events`

Main fields:

- `clinic_id`
- `installment_id`
- `payment_id`
- `provider`
- `event_id`
- `external_reference`
- `payload`
- `payload_hash`
- `status`
- `processed_at`
- `error_code`
- `retryable`
- `error_message`
- `created_at`
- `updated_at`

Relationships:

- `PaymentWebhookEvent` belongs to `Clinic`
- `PaymentWebhookEvent` may point to `Installment`
- `PaymentWebhookEvent` may point to `Payment`

Relevant constraints and indexes:

- uniqueness on `provider + eventId`
- indexes by `clinicId`
- indexes by `clinicId + status`
- indexes by `clinicId + externalReference`

### Integrations and dependencies

Current main consumer:

- `ProcessSimulatedPaymentWebhookUseCase` in the `payments` module

Role in the flow:

- find an existing event by `provider + eventId`
- create a new event on first receipt
- persist transitions to `PROCESSED`, `FAILED`, or `DUPLICATED`
- support safe replay and failure classification

Indirect integrations:

- `InstallmentRepository`
- `PaymentRepository`
- `RegisterPaymentUseCase`

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, this module handles sensitive payload context and must respect minimization and clinic isolation.

Core safeguards:

- every event belongs to a clinic
- do not mix replay across clinics
- do not expose full payloads unless necessary
- avoid verbose payload logging in production
- keep only the required financial and operational context

### Observability

This module is central to tracking the webhook lifecycle:

- event received
- event processed
- event duplicated
- event failed
- classified error and `retryable`

Relevant application errors and signals in the consuming flow:

- `PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH`
- `WEBHOOK_PROCESSING_FAILED`
- business error codes persisted in `errorCode`

### Tests

Direct coverage found:

- `tests/__unit__/modules/payment-webhook-events/domain/entities/payment-webhook-event.entity.spec.ts`
- `tests/__unit__/modules/payments/application/use-cases/process-simulated-payment-webhook.use-case.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Those specs cover normalization, status transitions, retryable failure handling, safe replay, payload mismatch, logical duplication, and Prisma mapping.

### Summary

`payment-webhook-events` is the module that preserves the idempotent memory of payment webhooks. It does not replace payment registration itself, but it guarantees safe replay, failure classification, and full traceability of external processing.
