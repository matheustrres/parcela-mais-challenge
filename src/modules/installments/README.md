# Installments Module

## Português (pt-BR)

### Visão geral

O módulo `installments` concentra a entidade parcela e sua leitura operacional. Ele representa cada unidade cobrável de um acordo financeiro e sustenta a evolução do saldo, do status persistido e do status derivado usado por cobrança, dashboard e consultas.

No desafio da Parcela Mais, este módulo é o ponto em que a dívida parcelada vira item operacional concreto. Seu papel é:

- representar a parcela como entidade de domínio
- registrar abatimento financeiro sobre a parcela
- derivar status operacionais a partir de data e saldo
- expor listagem paginada por clínica

### Contexto no domínio

Na linguagem do projeto, `Installment` é a unidade cobrável do acordo financeiro. É nela que cobrança, pagamento, atraso e saldo remanescente se manifestam de forma concreta.

Por isso, `installments` não decide a régua de cobrança nem registra o pagamento como evento financeiro persistido. Ele mantém o estado da parcela e fornece regras locais para saber se ela está aberta, vencida, paga, cancelada ou vencendo hoje.

### Escopo atual

Responsabilidade principal: manter estado e leitura das parcelas escopadas por clínica.

Fora do escopo atual: emissão de boleto/PIX, renegociação da parcela, cancelamento via endpoint, split manual de parcela, reordenação do cronograma e envio de comunicação.

### Modelo de domínio

`InstallmentEntity` em `src/modules/installments/domain/entities/installment.entity.ts`

Campos principais:

- `clinicId`, `debtAgreementId`
- `installmentNumber`
- `dueDate`
- `amount`, `paidAmount`
- `status`, `paidAt`
- `version`

Status persistidos:

- `PENDING`
- `PARTIALLY_PAID`
- `PAID`
- `CANCELED`

Status derivados:

- `PENDING`
- `DUE_TODAY`
- `OVERDUE`
- `PARTIALLY_PAID`
- `PAID`
- `CANCELED`

Invariantes centrais:

- `clinicId` e `debtAgreementId` são obrigatórios
- `installmentNumber` deve ser inteiro positivo
- `dueDate` deve ser válida
- `amount` deve ser `MoneyVo` positivo
- `paidAmount` deve ser `MoneyVo` não negativo
- `paidAmount` não pode exceder `amount`
- moedas devem coincidir
- `status` deve ser enum válido
- `version` deve ser inteiro não negativo
- parcela `PAID` exige `paidAt`
- parcela totalmente quitada deve estar com status `PAID`
- parcela `PENDING` não pode ter valor pago positivo

Erros de domínio relevantes:

- `INSTALLMENT_CLINIC_ID_REQUIRED`
- `INSTALLMENT_DEBT_AGREEMENT_ID_REQUIRED`
- `INSTALLMENT_NUMBER_MUST_BE_POSITIVE_INTEGER`
- `INSTALLMENT_DUE_DATE_REQUIRED`
- `INSTALLMENT_AMOUNT_REQUIRED`
- `INSTALLMENT_AMOUNT_MUST_BE_POSITIVE`
- `INSTALLMENT_PAID_AMOUNT_CANNOT_EXCEED_AMOUNT`
- `INVALID_INSTALLMENT_STATUS`
- `PAID_INSTALLMENT_MUST_HAVE_PAID_AT`
- `PENDING_INSTALLMENT_CANNOT_HAVE_PAID_AMOUNT`

Comportamentos:

- `InstallmentEntity.create(props)`
- `InstallmentEntity.createFrom(id, props, meta?)`
- `registerPayment(amount, paidAt)`
- `getRemainingAmount()`
- `isPaid()`
- `isCanceled()`
- `isOverdue(referenceDate)`
- `isDueToday(referenceDate)`
- `getDaysOverdue(referenceDate)`
- `getDerivedStatus(referenceDate)`

### Regras de negócio principais

Ao registrar pagamento:

- o valor deve ser positivo
- a data de pagamento deve ser válida
- parcela paga não aceita novo pagamento
- parcela cancelada não aceita pagamento
- pagamento não pode exceder o saldo restante
- pagamento parcial move status para `PARTIALLY_PAID`
- quitação total move status para `PAID`
- `version` é incrementada para suportar concorrência otimista

Status derivado:

- depende de `referenceDate`
- ignora hora e compara por dia civil
- trata `OVERDUE` e `DUE_TODAY` como estados calculados, não persistidos

### Caso de uso exposto

`ListInstallmentsUseCase`:

- valida `clinicId`, `referenceDate` e paginação
- verifica existência da clínica
- consulta parcelas por clínica
- calcula `remainingAmountCents`
- calcula `derivedStatus` a partir de `referenceDate`
- retorna paciente e resumo do acordo junto da parcela

Endpoint exposto:

- `GET /installments`

### Persistência

Tabela Prisma/Postgres: `installments`

Campos principais:

- `clinic_id`
- `debt_agreement_id`
- `installment_number`
- `due_date`
- `amount_cents`
- `paid_amount_cents`
- `status`
- `paid_at`
- `version`
- `created_at`
- `updated_at`

Relacionamentos:

- `Installment` pertence a `Clinic`
- `Installment` pertence a `DebtAgreement`
- `Installment` possui `1:N` com `Payment`
- `Installment` possui `1:N` com `CommunicationAttempt`

Restrições e índices relevantes:

- unicidade em `debtAgreementId + installmentNumber`
- índices por `clinicId`
- índices por `clinicId + status`
- índices por `clinicId + dueDate`

### Integrações e dependências

Dependências principais:

- `ClinicsModule` para validar existência da clínica
- `DebtAgreementsModule` como origem do vínculo pai
- `PaymentsModule` e `CollectionsModule` como consumidores indiretos da entidade

O repositório transacional oferece:

- `findByIdAndClinicId(...)`
- `createMany(...)`
- `update(...)`

Detalhe importante:

- `update(...)` usa `version` anterior no `where` para detectar concorrência otimista
- se nenhuma linha for atualizada, lança `INSTALLMENT_CONCURRENT_MODIFICATION`

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, o módulo deve operar apenas com dados sintéticos e sempre respeitar `clinicId`.

Cuidados centrais:

- não expor parcelas de outra clínica
- não incluir dados clínicos
- manter valores financeiros em centavos
- limitar payloads ao contexto financeiro e operacional necessário

### Observabilidade

O módulo é base para sinais operacionais como:

- parcelas abertas
- parcelas vencidas
- parcelas vencendo hoje
- saldo restante
- transições para `PARTIALLY_PAID` e `PAID`

Erros de aplicação relevantes:

- `CLINIC_NOT_FOUND`
- `INVALID_INSTALLMENTS_REFERENCE_DATE`
- `INVALID_INSTALLMENTS_PAGINATION`
- `INSTALLMENT_CONCURRENT_MODIFICATION`

### Testes

Cobertura direta encontrada:

- `tests/__unit__/modules/installments/domain/entities/installment.entity.spec.ts`
- `tests/__unit__/modules/installments/domain/services/installment-status-policy.service.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Essas specs cobrem invariantes, registro de pagamento, saldo restante, atraso, vencimento no dia, status derivado, política de status e mapeamento Prisma.

### Resumo

`installments` é o módulo que transforma o acordo financeiro em unidades cobradas e acompanháveis. Ele sustenta saldo, atraso, status derivado e concorrência otimista, servindo como base para cobrança, pagamento e dashboard.

## English (en-US)

### Overview

The `installments` module owns the installment entity and its operational read model. It represents each billable unit of a financial agreement and supports balance evolution, persisted status, and derived status used by collections, dashboard, and query flows.

In the Parcela Mais challenge, this is the point where installment debt becomes a concrete operational item. Its role is to:

- represent the installment as a domain entity
- register financial reductions against the installment
- derive operational statuses from date and balance
- expose paginated listing by clinic

### Domain context

In the project language, an `Installment` is the billable unit of a debt agreement. It is where collection, payment, delinquency, and remaining balance become concrete.

Because of that, `installments` does not decide the collection policy or persist payment events themselves. It maintains installment state and provides local rules to determine whether the installment is open, overdue, paid, canceled, or due today.

### Current scope

Primary responsibility: maintain state and clinic-scoped reads for installments.

Out of scope today: boleto/PIX issuance, installment renegotiation, cancellation through an endpoint, manual installment splitting, schedule reordering, and communication delivery.

### Domain model

`InstallmentEntity` in `src/modules/installments/domain/entities/installment.entity.ts`

Main fields:

- `clinicId`, `debtAgreementId`
- `installmentNumber`
- `dueDate`
- `amount`, `paidAmount`
- `status`, `paidAt`
- `version`

Persisted statuses:

- `PENDING`
- `PARTIALLY_PAID`
- `PAID`
- `CANCELED`

Derived statuses:

- `PENDING`
- `DUE_TODAY`
- `OVERDUE`
- `PARTIALLY_PAID`
- `PAID`
- `CANCELED`

Core invariants:

- `clinicId` and `debtAgreementId` are required
- `installmentNumber` must be a positive integer
- `dueDate` must be valid
- `amount` must be a positive `MoneyVo`
- `paidAmount` must be a non-negative `MoneyVo`
- `paidAmount` cannot exceed `amount`
- currencies must match
- `status` must be a valid enum
- `version` must be a non-negative integer
- a `PAID` installment requires `paidAt`
- a fully paid installment must use `PAID` status
- a `PENDING` installment cannot have positive paid amount

Relevant domain errors:

- `INSTALLMENT_CLINIC_ID_REQUIRED`
- `INSTALLMENT_DEBT_AGREEMENT_ID_REQUIRED`
- `INSTALLMENT_NUMBER_MUST_BE_POSITIVE_INTEGER`
- `INSTALLMENT_DUE_DATE_REQUIRED`
- `INSTALLMENT_AMOUNT_REQUIRED`
- `INSTALLMENT_AMOUNT_MUST_BE_POSITIVE`
- `INSTALLMENT_PAID_AMOUNT_CANNOT_EXCEED_AMOUNT`
- `INVALID_INSTALLMENT_STATUS`
- `PAID_INSTALLMENT_MUST_HAVE_PAID_AT`
- `PENDING_INSTALLMENT_CANNOT_HAVE_PAID_AMOUNT`

Behaviors:

- `InstallmentEntity.create(props)`
- `InstallmentEntity.createFrom(id, props, meta?)`
- `registerPayment(amount, paidAt)`
- `getRemainingAmount()`
- `isPaid()`
- `isCanceled()`
- `isOverdue(referenceDate)`
- `isDueToday(referenceDate)`
- `getDaysOverdue(referenceDate)`
- `getDerivedStatus(referenceDate)`

### Core business rules

When registering a payment:

- amount must be positive
- payment date must be valid
- a paid installment cannot receive another payment
- a canceled installment cannot receive payment
- payment cannot exceed remaining balance
- a partial payment moves status to `PARTIALLY_PAID`
- a full settlement moves status to `PAID`
- `version` is incremented to support optimistic concurrency

Derived status:

- depends on `referenceDate`
- ignores time and compares by calendar day
- treats `OVERDUE` and `DUE_TODAY` as computed states, not persisted ones

### Technical structure

Main files:

- `src/modules/installments/installments.module.ts`
- `src/modules/installments/domain/entities/installment.entity.ts`
- `src/modules/installments/domain/enums/derived-status.ts`
- `src/modules/installments/domain/services/installment-status-policy.service.ts`
- `src/modules/installments/application/repositories/installment.repository.ts`
- `src/modules/installments/application/repositories/installments-query.repository.ts`
- `src/modules/installments/application/use-cases/list-installments.use-case.ts`
- `src/modules/installments/infrastructure/prisma/installment-prisma.mapper.ts`
- `src/modules/installments/infrastructure/prisma/prisma-installment.repository.ts`
- `src/modules/installments/infrastructure/prisma/prisma-installments-query.repository.ts`
- `src/modules/installments/presentation/http/installments.controller.ts`

Layers: `domain` with the entity and status policy, `application` with ports and listing, `infrastructure` with Prisma, and `presentation` with the HTTP endpoint.

### Exposed use case

`ListInstallmentsUseCase`:

- validates `clinicId`, `referenceDate`, and pagination
- checks clinic existence
- queries installments by clinic
- calculates `remainingAmountCents`
- calculates `derivedStatus` from `referenceDate`
- returns patient and debt-agreement summary alongside the installment

Exposed endpoint:

- `GET /installments`

### Persistence

Prisma/Postgres table: `installments`

Main fields:

- `clinic_id`
- `debt_agreement_id`
- `installment_number`
- `due_date`
- `amount_cents`
- `paid_amount_cents`
- `status`
- `paid_at`
- `version`
- `created_at`
- `updated_at`

Relationships:

- `Installment` belongs to `Clinic`
- `Installment` belongs to `DebtAgreement`
- `Installment` has `1:N` with `Payment`
- `Installment` has `1:N` with `CommunicationAttempt`

Relevant constraints and indexes:

- uniqueness on `debtAgreementId + installmentNumber`
- indexes by `clinicId`
- indexes by `clinicId + status`
- indexes by `clinicId + dueDate`

### Integrations and dependencies

Main dependencies:

- `ClinicsModule` to validate clinic existence
- `DebtAgreementsModule` as the parent-link origin
- `PaymentsModule` and `CollectionsModule` as indirect consumers of the entity

The transactional repository exposes:

- `findByIdAndClinicId(...)`
- `createMany(...)`
- `update(...)`

Important detail:

- `update(...)` uses the previous `version` in the `where` clause to detect optimistic concurrency
- if no row is updated, it throws `INSTALLMENT_CONCURRENT_MODIFICATION`

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, the module must operate only on synthetic data and must always respect `clinicId`.

Core safeguards:

- do not expose installments from another clinic
- do not include clinical details
- keep financial values in cents
- limit payloads to the required financial and operational context

### Observability

The module is the basis for operational signals such as:

- open installments
- overdue installments
- installments due today
- remaining balance
- transitions to `PARTIALLY_PAID` and `PAID`

Relevant application errors:

- `CLINIC_NOT_FOUND`
- `INVALID_INSTALLMENTS_REFERENCE_DATE`
- `INVALID_INSTALLMENTS_PAGINATION`
- `INSTALLMENT_CONCURRENT_MODIFICATION`

### Tests

Direct coverage found:

- `tests/__unit__/modules/installments/domain/entities/installment.entity.spec.ts`
- `tests/__unit__/modules/installments/domain/services/installment-status-policy.service.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Those specs cover invariants, payment registration, remaining balance, delinquency, due-today status, derived status, status policy delegation, and Prisma mapping.

### Summary

`installments` is the module that turns a debt agreement into billable, trackable units. It supports balance, delinquency, derived status, and optimistic concurrency, forming the base for collections, payments, and dashboard views.
