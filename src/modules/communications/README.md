# Communications Module

## Português (pt-BR)

### Visão geral

O módulo `communications` concentra o registro e a consulta das tentativas de comunicação do sistema. No contexto do desafio, ele não entrega mensagens reais; ele persiste e expõe o histórico auditável das comunicações simuladas geradas pela régua de cobrança.

Hoje, `communications` é um módulo de suporte operacional. Seu papel é:

- representar a tentativa de comunicação como entidade de domínio
- persistir tentativas geradas por outros fluxos
- consultar histórico por clínica
- apoiar cobrança, priorização e auditoria

### Contexto no domínio

Na linguagem do projeto, `CommunicationAttempt` é o registro auditável de uma mensagem gerada, enviada de forma simulada, pulada ou marcada como falha.

Por isso, `communications` não decide quando cobrar nem qual mensagem gerar. Essas decisões pertencem ao módulo `collections`. Aqui, o foco é armazenar, consultar e atualizar o estado operacional dessas tentativas.

### Escopo atual

Responsabilidade principal: manter o histórico de tentativas de comunicação escopado por clínica.

Fora do escopo atual: envio real de mensagens, fila assíncrona, webhook de entrega, retry automatizado, templates dinâmicos por canal e edição manual de mensagens já geradas.

### Modelo de domínio

`CommunicationAttemptEntity` em `src/modules/communications/domain/entities/communication-attempt.entity.ts`

Campos principais:

- `clinicId`, `patientId`, `installmentId`
- `type`, `channel`, `status`
- `scheduledFor`, `sentAt`
- `skippedReason`, `message`
- `aiGenerated`, `templateKey`

Invariantes centrais:

- `clinicId`, `patientId` e `installmentId` são obrigatórios
- `type`, `channel` e `status` devem ser enums válidos
- `scheduledFor` e `sentAt` devem ser datas válidas quando informadas
- status `SKIPPED` exige motivo
- status `FAILED` exige motivo
- status `SENT_SIMULATED` exige `sentAt`

Normalizações:

- `skippedReason`, `message` e `templateKey` recebem `trim`
- campos opcionais vazios são convertidos para `null`

Erros de domínio relevantes:

- `COMMUNICATION_CLINIC_ID_REQUIRED`
- `COMMUNICATION_PATIENT_ID_REQUIRED`
- `COMMUNICATION_INSTALLMENT_ID_REQUIRED`
- `INVALID_COMMUNICATION_TYPE`
- `INVALID_COMMUNICATION_CHANNEL`
- `INVALID_COMMUNICATION_STATUS`
- `SKIPPED_COMMUNICATION_REQUIRES_REASON`
- `FAILED_COMMUNICATION_REQUIRES_REASON`
- `SENT_COMMUNICATION_REQUIRES_SENT_AT`

Comportamentos:

- `CommunicationAttemptEntity.create(props)`
- `CommunicationAttemptEntity.createFrom(id, props, meta?)`
- `markAsSent(sentAt)`
- `markAsSkipped(reason)`
- `markAsFailed(reason)`
- `hasBeenSent()`

### Persistência

Tabela Prisma/Postgres: `communication_attempts`

Campos principais:

- `clinic_id`, `patient_id`, `installment_id`
- `type`, `channel`, `status`
- `scheduled_for`, `sent_at`
- `skipped_reason`, `message`
- `ai_generated`, `template_key`
- `created_at`, `updated_at`

Relacionamentos:

- `CommunicationAttempt` pertence a `Clinic`
- `CommunicationAttempt` pertence a `Patient`
- `CommunicationAttempt` pertence a `Installment`

Chave de deduplicação:

- `clinicId + patientId + installmentId + type + channel`

Essa chave protege a régua contra duplicação do mesmo tipo de comunicação no mesmo canal para a mesma parcela.

### Como o módulo é usado hoje

O principal produtor deste módulo é `collections`, especialmente em `run-collection-rules.use-case.ts`, que cria tentativas de comunicação simuladas em transação.

Consumidores principais:

- `run-collection-rules.use-case.ts`
- `list-delinquent-patients.use-case.ts`
- `list-communication-attempts.use-case.ts`

Papel nesses fluxos:

- registrar tentativas geradas
- consultar histórico para cooldown e deduplicação
- expor listagem operacional por clínica

### Caso de uso exposto

`ListCommunicationAttemptsUseCase`:

- valida `clinicId`
- valida paginação (`limit`, `offset`)
- verifica existência da clínica
- consulta tentativas por clínica
- retorna itens paginados com paciente e parcela

Endpoint exposto:

- `GET /communication-attempts`

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, o módulo deve operar apenas com dados sintéticos e sempre respeitar `clinicId`.

Cuidados centrais:

- não vazar tentativas de outra clínica
- não incluir detalhes clínicos em `message`
- minimizar exposição de conteúdo textual quando não necessário
- evitar logging de mensagens completas se contiverem dados pessoais

### Observabilidade

O módulo suporta auditoria operacional porque mantém status, datas e motivos de bloqueio/falha em cada tentativa.

Sinais importantes:

- `GENERATED`
- `SENT_SIMULATED`
- `SKIPPED`
- `FAILED`

Erros de aplicação relevantes:

- `CLINIC_NOT_FOUND`
- `INVALID_COMMUNICATION_ATTEMPTS_PAGINATION`
- `COLLECTION_RULE_ATTEMPT_ALREADY_EXISTS`

### Testes

Cobertura direta encontrada:

- `tests/__unit__/modules/communications/domain/entities/communication-attempt.entity.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Essas specs cobrem normalização de campos, transições de estado (`markAsSent`, `markAsSkipped`, `markAsFailed`), obrigatoriedade de motivos, exigência de `sentAt` e mapeamento Prisma.

### Resumo

`communications` é o módulo que dá persistência e auditabilidade às comunicações simuladas do sistema. Ele não define a estratégia de cobrança, mas é a base para histórico, deduplicação, cooldown e rastreabilidade operacional.

## English (en-US)

### Overview

The `communications` module owns storage and querying for the system's communication attempts. In the challenge context, it does not deliver real messages; it persists and exposes the auditable history of simulated communications generated by the collection policy.

Today, `communications` is an operational support module. Its role is to:

- represent a communication attempt as a domain entity
- persist attempts generated by other flows
- query history by clinic
- support collections, prioritization, and auditing

### Domain context

In the project language, `CommunicationAttempt` is the auditable record of a generated, simulated-sent, skipped, or failed message.

Because of that, `communications` does not decide when to collect or which message should be generated. Those decisions belong to `collections`. The focus here is storing, querying, and updating the operational state of those attempts.

### Current scope

Primary responsibility: maintain clinic-scoped communication attempt history.

Out of scope today: real message delivery, async queues, delivery webhooks, automated retries, channel-specific dynamic templates, and manual editing of already generated messages.

### Domain model

`CommunicationAttemptEntity` in `src/modules/communications/domain/entities/communication-attempt.entity.ts`

Main fields:

- `clinicId`, `patientId`, `installmentId`
- `type`, `channel`, `status`
- `scheduledFor`, `sentAt`
- `skippedReason`, `message`
- `aiGenerated`, `templateKey`

Core invariants:

- `clinicId`, `patientId`, and `installmentId` are required
- `type`, `channel`, and `status` must be valid enums
- `scheduledFor` and `sentAt` must be valid dates when present
- `SKIPPED` status requires a reason
- `FAILED` status requires a reason
- `SENT_SIMULATED` status requires `sentAt`

Normalizations:

- `skippedReason`, `message`, and `templateKey` are trimmed
- empty optional fields become `null`

Relevant domain errors:

- `COMMUNICATION_CLINIC_ID_REQUIRED`
- `COMMUNICATION_PATIENT_ID_REQUIRED`
- `COMMUNICATION_INSTALLMENT_ID_REQUIRED`
- `INVALID_COMMUNICATION_TYPE`
- `INVALID_COMMUNICATION_CHANNEL`
- `INVALID_COMMUNICATION_STATUS`
- `SKIPPED_COMMUNICATION_REQUIRES_REASON`
- `FAILED_COMMUNICATION_REQUIRES_REASON`
- `SENT_COMMUNICATION_REQUIRES_SENT_AT`

Behaviors:

- `CommunicationAttemptEntity.create(props)`
- `CommunicationAttemptEntity.createFrom(id, props, meta?)`
- `markAsSent(sentAt)`
- `markAsSkipped(reason)`
- `markAsFailed(reason)`
- `hasBeenSent()`

### Technical structure

Main files:

- `src/modules/communications/communications.module.ts`
- `src/modules/communications/domain/entities/communication-attempt.entity.ts`
- `src/modules/communications/application/repositories/communication-attempt.repository.ts`
- `src/modules/communications/application/repositories/communication-attempts-query.repository.ts`
- `src/modules/communications/application/use-cases/list-communication-attempts.use-case.ts`
- `src/modules/communications/infrastructure/prisma/communication-attempt-prisma.mapper.ts`
- `src/modules/communications/infrastructure/prisma/prisma-communication-attempt.repository.ts`
- `src/modules/communications/infrastructure/prisma/prisma-communication-attempts-query.repository.ts`
- `src/modules/communications/presentation/http/communications.controller.ts`

Layers: `domain` with the entity, `application` with ports and the list use case, `infrastructure` with Prisma, and `presentation` with the HTTP endpoint.

Main contracts:

- `CommunicationAttemptRepository.findRelevantForCollectionRun(...)`
- `CommunicationAttemptRepository.findByClinicIdAndInstallmentIds(...)`
- `CommunicationAttemptRepository.createMany(...)`
- `CommunicationAttemptsQueryRepository.findByClinicId(...)`

### Persistence

Prisma/Postgres table: `communication_attempts`

Main fields:

- `clinic_id`, `patient_id`, `installment_id`
- `type`, `channel`, `status`
- `scheduled_for`, `sent_at`
- `skipped_reason`, `message`
- `ai_generated`, `template_key`
- `created_at`, `updated_at`

Relationships:

- `CommunicationAttempt` belongs to `Clinic`
- `CommunicationAttempt` belongs to `Patient`
- `CommunicationAttempt` belongs to `Installment`

Deduplication key:

- `clinicId + patientId + installmentId + type + channel`

This key protects the collection rule from generating the same communication type twice on the same channel for the same installment.

### How the module is used today

The main producer of this module is `collections`, especially in `run-collection-rules.use-case.ts`, which creates simulated communication attempts inside a transaction.

Main consumers:

- `run-collection-rules.use-case.ts`
- `list-delinquent-patients.use-case.ts`
- `list-communication-attempts.use-case.ts`

Role in those flows:

- register generated attempts
- query history for cooldown and deduplication
- expose clinic-scoped operational listing

### Exposed use case

`ListCommunicationAttemptsUseCase`:

- validates `clinicId`
- validates pagination (`limit`, `offset`)
- checks clinic existence
- queries attempts by clinic
- returns paginated items with patient and installment data

Exposed endpoint:

- `GET /communication-attempts`

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, the module must only operate on synthetic data and must always respect `clinicId`.

Core safeguards:

- no cross-clinic leakage
- no clinical details inside `message`
- minimize text exposure when it is not necessary
- avoid logging full messages when they contain personal data

### Observability

The module supports operational auditing because it stores status, timestamps, and skip/failure reasons on each attempt.

Important signals:

- `GENERATED`
- `SENT_SIMULATED`
- `SKIPPED`
- `FAILED`

Relevant application errors:

- `CLINIC_NOT_FOUND`
- `INVALID_COMMUNICATION_ATTEMPTS_PAGINATION`
- `COLLECTION_RULE_ATTEMPT_ALREADY_EXISTS`

### Tests

Direct coverage found:

- `tests/__unit__/modules/communications/domain/entities/communication-attempt.entity.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Those specs cover field normalization, state transitions (`markAsSent`, `markAsSkipped`, `markAsFailed`), required reasons, required `sentAt`, and Prisma mapping.

### Summary

`communications` is the module that gives persistence and auditability to simulated communications in the system. It does not define collection strategy, but it is the foundation for history, deduplication, cooldown, and operational traceability.
