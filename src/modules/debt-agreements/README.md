# Debt Agreements Module

## Português (pt-BR)

### Visão geral

O módulo `debt-agreements` concentra a criação e a consulta dos acordos financeiros parcelados do sistema. Ele representa a dívida parcelada do paciente com a clínica e coordena a geração inicial das parcelas que depois serão cobradas e pagas.

No desafio da Parcela Mais, este módulo é a origem do fluxo financeiro parcelado. Seu papel é:

- representar o acordo financeiro como entidade de domínio
- validar vínculo entre clínica, paciente e valor do acordo
- criar o acordo e sua agenda inicial de parcelas
- expor consultas resumidas e detalhadas dos acordos

### Contexto no domínio

Na linguagem do projeto, `DebtAgreement` é o contrato financeiro parcelado associado a um paciente e a uma clínica. Ele funciona como agregado pai das parcelas cobradas ao longo do tempo.

Por isso, `debt-agreements` não registra pagamento diretamente nem decide comunicação. Ele define o compromisso financeiro, o total devido, a quantidade de parcelas e a estrutura base da cobrança futura.

### Escopo atual

Responsabilidade principal: criar e consultar acordos parcelados escopados por clínica.

Fora do escopo atual: renegociação, edição de acordo existente, cancelamento via endpoint, reparcelamento, cálculo de juros/multa, desconto, reemissão manual de cronograma e conciliação de pagamento.

### Modelo de domínio

`DebtAgreementEntity` em `src/modules/debt-agreements/domain/entities/debt-agreement.entity.ts`

Campos principais:

- `clinicId`, `patientId`
- `totalAmount`
- `installmentsCount`
- `status`

Invariantes centrais:

- `clinicId` é obrigatório
- `patientId` é obrigatório
- `totalAmount` deve ser `MoneyVo`
- `totalAmount` deve ser positivo
- `installmentsCount` deve ser inteiro positivo
- `status` deve ser enum válido

Status atuais:

- `ACTIVE`
- `PAID`
- `CANCELED`

Erros de domínio relevantes:

- `DEBT_AGREEMENT_CLINIC_ID_REQUIRED`
- `DEBT_AGREEMENT_PATIENT_ID_REQUIRED`
- `DEBT_AGREEMENT_TOTAL_AMOUNT_REQUIRED`
- `DEBT_AGREEMENT_TOTAL_AMOUNT_MUST_BE_POSITIVE`
- `DEBT_AGREEMENT_INSTALLMENTS_COUNT_MUST_BE_POSITIVE_INTEGER`
- `INVALID_DEBT_AGREEMENT_STATUS`
- `PAID_DEBT_AGREEMENT_CANNOT_BE_CANCELED`
- `CANCELED_DEBT_AGREEMENT_CANNOT_BE_PAID`

Comportamentos:

- `DebtAgreementEntity.create(props)`
- `DebtAgreementEntity.createFrom(id, props, meta?)`
- `cancel()`
- `markAsPaid()`
- `isActive()`
- `isCanceled()`

### Política de cronograma

`InstallmentSchedulePolicyDomainService` gera as datas de vencimento a partir de:

- `firstDueDate`
- `installmentsCount`

Regras atuais:

- a primeira parcela preserva a data inicial informada
- parcelas seguintes avançam mês a mês
- o dia âncora é preservado quando possível
- meses curtos usam o último dia disponível sem causar drift permanente

Isso permite cronogramas como `31/01 -> 28/02 -> 31/03 -> 30/04`.

### Casos de uso expostos

`CreateDebtAgreementUseCase`:

- valida `clinicId` e `patientId`
- verifica existência da clínica
- verifica existência do paciente
- garante que o paciente pertence à clínica
- cria o acordo financeiro
- divide o valor em parcelas com `MoneyVo.splitEqually`
- gera datas de vencimento
- cria parcelas `PENDING`
- persiste acordo e parcelas em transação

`GetDebtAgreementUseCase`:

- valida `clinicId`, `debtAgreementId` e `referenceDate`
- verifica existência da clínica
- consulta acordo detalhado por `debtAgreementId + clinicId`
- calcula totais pagos, saldo restante e `derivedStatus` das parcelas

`ListDebtAgreementsUseCase`:

- valida `clinicId`, filtros, paginação e `referenceDate`
- verifica existência da clínica
- lista acordos por clínica com filtros opcionais de paciente e status
- calcula totais pagos, saldo restante e quantidade de parcelas pagas, abertas e vencidas

Endpoints expostos:

- `POST /debt-agreements`
- `GET /debt-agreements`
- `GET /debt-agreements/:id`

### Persistência

Tabela Prisma/Postgres: `debt_agreements`

Campos principais:

- `clinic_id`
- `patient_id`
- `total_amount_cents`
- `installments_count`
- `status`
- `created_at`
- `updated_at`

Relacionamentos:

- `DebtAgreement` pertence a `Clinic`
- `DebtAgreement` pertence a `Patient`
- `DebtAgreement` possui `1:N` com `Installment`

Índices relevantes:

- `clinicId`
- `clinicId + status`
- `clinicId + patientId`

### Integrações e dependências

Dependências principais:

- `ClinicsModule` para validar existência da clínica
- `PatientsModule` para validar paciente e isolamento por clínica
- `InstallmentsModule` para persistir parcelas criadas junto ao acordo
- `TransactionManager` para garantir atomicidade entre acordo e parcelas

O query model depende de:

- `patient`
- `installments`

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, o módulo deve operar apenas com dados sintéticos e sempre respeitar `clinicId`.

Cuidados centrais:

- não criar acordo para paciente de outra clínica
- não expor acordos de outra clínica nas consultas
- não armazenar dados clínicos no acordo
- manter valores em centavos

### Observabilidade

O módulo é relevante para eventos e métricas como:

- criação de acordo financeiro
- quantidade de acordos ativos, pagos e cancelados
- valor total parcelado
- parcelas vencidas e em aberto derivadas nas consultas

Erros de aplicação relevantes:

- `CLINIC_NOT_FOUND`
- `PATIENT_NOT_FOUND`
- `PATIENT_DOES_NOT_BELONG_TO_CLINIC`
- `DEBT_AGREEMENT_NOT_FOUND`
- `INVALID_DEBT_AGREEMENT_QUERY`
- `INVALID_DEBT_AGREEMENT_PAGINATION`

### Testes

Cobertura direta encontrada:

- `tests/__unit__/modules/debt-agreements/domain/entities/debt-agreement.entity.spec.ts`
- `tests/__unit__/modules/debt-agreements/domain/services/installment-schedule-policy.service.spec.ts`
- `tests/__unit__/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case.spec.ts`
- `tests/__unit__/modules/debt-agreements/application/use-cases/get-debt-agreement.use-case.spec.ts`
- `tests/__unit__/modules/debt-agreements/application/use-cases/list-debt-agreements.use-case.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Essas specs cobrem invariantes da entidade, transições de estado, geração do cronograma mensal, divisão de valores, atomicidade da criação, filtros, agregações e mapeamento Prisma.

### Resumo

`debt-agreements` é o módulo que formaliza a dívida parcelada do paciente. Ele inicia o ciclo financeiro do sistema: cria o acordo, estrutura as parcelas e expõe leituras que servem de base para cobrança, dashboard e pagamento.

## English (en-US)

### Overview

The `debt-agreements` module owns creation and querying of the system's installment-based financial agreements. It represents the patient's installment debt with the clinic and coordinates the initial creation of installments that will later be collected and paid.

In the Parcela Mais challenge, this module is the origin of the installment financial flow. Its role is to:

- represent the financial agreement as a domain entity
- validate the link between clinic, patient, and agreement amount
- create the agreement and its initial installment schedule
- expose summary and detail queries for agreements

### Domain context

In the project language, `DebtAgreement` is the installment-based financial contract associated with a patient and a clinic. It works as the parent aggregate of the installments charged over time.

Because of that, `debt-agreements` does not directly register payments or decide communications. It defines the financial commitment, total amount due, installment count, and the base structure for future collection.

### Current scope

Primary responsibility: create and query clinic-scoped installment agreements.

Out of scope today: renegotiation, editing an existing agreement, cancellation through an endpoint, reparceling, interest/penalty calculation, discounts, manual schedule reissue, and payment reconciliation.

### Domain model

`DebtAgreementEntity` in `src/modules/debt-agreements/domain/entities/debt-agreement.entity.ts`

Main fields:

- `clinicId`, `patientId`
- `totalAmount`
- `installmentsCount`
- `status`

Core invariants:

- `clinicId` is required
- `patientId` is required
- `totalAmount` must be a `MoneyVo`
- `totalAmount` must be positive
- `installmentsCount` must be a positive integer
- `status` must be a valid enum

Current statuses:

- `ACTIVE`
- `PAID`
- `CANCELED`

Relevant domain errors:

- `DEBT_AGREEMENT_CLINIC_ID_REQUIRED`
- `DEBT_AGREEMENT_PATIENT_ID_REQUIRED`
- `DEBT_AGREEMENT_TOTAL_AMOUNT_REQUIRED`
- `DEBT_AGREEMENT_TOTAL_AMOUNT_MUST_BE_POSITIVE`
- `DEBT_AGREEMENT_INSTALLMENTS_COUNT_MUST_BE_POSITIVE_INTEGER`
- `INVALID_DEBT_AGREEMENT_STATUS`
- `PAID_DEBT_AGREEMENT_CANNOT_BE_CANCELED`
- `CANCELED_DEBT_AGREEMENT_CANNOT_BE_PAID`

Behaviors:

- `DebtAgreementEntity.create(props)`
- `DebtAgreementEntity.createFrom(id, props, meta?)`
- `cancel()`
- `markAsPaid()`
- `isActive()`
- `isCanceled()`

### Scheduling policy

`InstallmentSchedulePolicyDomainService` generates due dates from:

- `firstDueDate`
- `installmentsCount`

Current rules:

- the first installment preserves the input start date
- following installments move month by month
- the anchor day is preserved when possible
- short months use the last available day without causing permanent drift

This supports schedules such as `01/31 -> 02/28 -> 03/31 -> 04/30`.

### Technical structure

Main files:

- `src/modules/debt-agreements/debt-agreements.module.ts`
- `src/modules/debt-agreements/domain/entities/debt-agreement.entity.ts`
- `src/modules/debt-agreements/domain/services/installment-schedule-policy.service.ts`
- `src/modules/debt-agreements/application/repositories/debt-agreement.repository.ts`
- `src/modules/debt-agreements/application/repositories/debt-agreement-query.repository.ts`
- `src/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case.ts`
- `src/modules/debt-agreements/application/use-cases/get-debt-agreement.use-case.ts`
- `src/modules/debt-agreements/application/use-cases/list-debt-agreements.use-case.ts`
- `src/modules/debt-agreements/infrastructure/prisma/debt-agreement-prisma.mapper.ts`
- `src/modules/debt-agreements/infrastructure/prisma/prisma-debt-agreement.repository.ts`
- `src/modules/debt-agreements/infrastructure/prisma/prisma-debt-agreement-query.repository.ts`
- `src/modules/debt-agreements/presentation/http/debt-agreements.controller.ts`

Layers: `domain` with the entity and scheduling policy, `application` with ports and use cases, `infrastructure` with Prisma and query model, and `presentation` with HTTP endpoints.

### Exposed use cases

`CreateDebtAgreementUseCase`:

- validates `clinicId` and `patientId`
- checks clinic existence
- checks patient existence
- guarantees the patient belongs to the clinic
- creates the financial agreement
- splits the total amount using `MoneyVo.splitEqually`
- generates due dates
- creates `PENDING` installments
- persists agreement and installments inside a transaction

`GetDebtAgreementUseCase`:

- validates `clinicId`, `debtAgreementId`, and `referenceDate`
- checks clinic existence
- queries agreement detail by `debtAgreementId + clinicId`
- calculates paid totals, remaining balance, and installment `derivedStatus`

`ListDebtAgreementsUseCase`:

- validates `clinicId`, filters, pagination, and `referenceDate`
- checks clinic existence
- lists agreements by clinic with optional patient and status filters
- calculates paid totals, remaining balance, and counts of paid, open, and overdue installments

Exposed endpoints:

- `POST /debt-agreements`
- `GET /debt-agreements`
- `GET /debt-agreements/:id`

### Persistence

Prisma/Postgres table: `debt_agreements`

Main fields:

- `clinic_id`
- `patient_id`
- `total_amount_cents`
- `installments_count`
- `status`
- `created_at`
- `updated_at`

Relationships:

- `DebtAgreement` belongs to `Clinic`
- `DebtAgreement` belongs to `Patient`
- `DebtAgreement` has `1:N` with `Installment`

Relevant indexes:

- `clinicId`
- `clinicId + status`
- `clinicId + patientId`

### Integrations and dependencies

Main dependencies:

- `ClinicsModule` to validate clinic existence
- `PatientsModule` to validate patient ownership and clinic isolation
- `InstallmentsModule` to persist installments created with the agreement
- `TransactionManager` to guarantee atomicity between agreement and installments

The query model depends on:

- `patient`
- `installments`

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, the module must operate only on synthetic data and must always respect `clinicId`.

Core safeguards:

- do not create an agreement for a patient from another clinic
- do not expose agreements from another clinic in queries
- do not store clinical data in the agreement
- keep monetary values in cents

### Observability

The module is relevant for events and metrics such as:

- financial agreement creation
- active, paid, and canceled agreement counts
- total financed amount
- overdue and open installments derived in queries

Relevant application errors:

- `CLINIC_NOT_FOUND`
- `PATIENT_NOT_FOUND`
- `PATIENT_DOES_NOT_BELONG_TO_CLINIC`
- `DEBT_AGREEMENT_NOT_FOUND`
- `INVALID_DEBT_AGREEMENT_QUERY`
- `INVALID_DEBT_AGREEMENT_PAGINATION`

### Tests

Direct coverage found:

- `tests/__unit__/modules/debt-agreements/domain/entities/debt-agreement.entity.spec.ts`
- `tests/__unit__/modules/debt-agreements/domain/services/installment-schedule-policy.service.spec.ts`
- `tests/__unit__/modules/debt-agreements/application/use-cases/create-debt-agreement.use-case.spec.ts`
- `tests/__unit__/modules/debt-agreements/application/use-cases/get-debt-agreement.use-case.spec.ts`
- `tests/__unit__/modules/debt-agreements/application/use-cases/list-debt-agreements.use-case.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Those specs cover entity invariants, state transitions, monthly schedule generation, amount splitting, creation atomicity, filters, aggregates, and Prisma mapping.

### Summary

`debt-agreements` is the module that formalizes the patient's installment debt. It starts the system's financial cycle: creates the agreement, structures the installments, and exposes the read models used later by collections, dashboard, and payments.
