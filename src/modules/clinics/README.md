# Clinics Module

## Português (pt-BR)

### Visão geral

O módulo `clinics` representa a clínica como raiz de escopo operacional do sistema. No desafio da Parcela Mais, quase toda operação relevante depende de `clinicId` para garantir isolamento entre clínicas e consistência nas consultas e escritas.

Hoje, `clinics` é um módulo fundacional. Ele não expõe API própria nem casos de uso de cadastro/edição. Seu papel é:

- materializar a entidade `Clinic`
- validar invariantes básicos da clínica
- consultar clínica por identificador
- servir de dependência para os demais módulos validarem existência e escopo

### Contexto no domínio

O problema central do desafio é a cobrança de pacientes de clínicas com apoio de IA. Isso exige um modelo multi-tenant simples, em que cada clínica possui sua própria base operacional, não enxerga dados de outra clínica e opera tudo a partir do próprio `clinicId`.

Por isso, `clinics` não concentra regras de cobrança ou pagamento. Ele define a fronteira organizacional sobre a qual os outros módulos operam.

### Escopo atual

Responsabilidade principal: garantir que operações downstream ocorram apenas para uma clínica existente e identificada.

Fora do escopo atual: autenticação e onboarding, configurações ou políticas comerciais por clínica, CRUD HTTP e listagem de clínicas.

### Modelo de domínio

`ClinicEntity` em `src/modules/clinics/domain/entities/clinic.entity.ts`

Campos:

- `id`, `name`, `createdAt`, `updatedAt`

Invariantes:

- nome é obrigatório
- nome é normalizado com `trim`
- nome não pode ficar vazio após `trim`
- nome deve ter entre 2 e 120 caracteres

Erros de domínio:

- `CLINIC_NAME_REQUIRED`
- `CLINIC_NAME_TOO_SHORT`
- `CLINIC_NAME_TOO_LONG`

Comportamentos:

- `ClinicEntity.create(props)`
- `ClinicEntity.createFrom(id, props, meta?)`
- `changeName(name)`

### Persistência

Tabela Prisma/Postgres: `clinics`

Campos principais:

- `id`
- `name`
- `created_at`
- `updated_at`

`Clinic` possui relação `1:N` com `Patient`, `DebtAgreement`, `Installment`, `Payment`, `CommunicationAttempt` e `PaymentWebhookEvent`. Isso confirma que a clínica é a raiz de escopo dos dados operacionais.

### Como o módulo é usado hoje

O módulo não implementa casos de uso próprios. Ele é consumido por outros módulos como pré-condição de existência e isolamento, especialmente em:

- `create-debt-agreement.use-case.ts`
- `list/get-debt-agreement.use-case.ts`
- `list-installments.use-case.ts`
- `list-communication-attempts.use-case.ts`
- `list-delinquent-patients.use-case.ts`
- `run-collection-rules.use-case.ts`
- `get-dashboard-summary.use-case.ts`

Papel nesses fluxos:

- validar `clinicId` antes da operação
- lançar `CLINIC_NOT_FOUND` quando a clínica não existe
- reforçar que leituras e escritas devem acontecer dentro do tenant correto

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, `clinics` é a base do isolamento por tenant.

Regras derivadas: toda query operacional deve respeitar `clinicId`, endpoints de listagem devem receber ou inferir `clinicId`, e não pode haver vazamento cross-clinic.

Validar a existência da clínica não basta sozinho. Cada repositório consumidor também precisa aplicar `clinicId` nas queries.

### Observabilidade

O módulo não possui logs próprios hoje. Ainda assim, ele participa da operação segura porque falhas de lookup geram `CLINIC_NOT_FOUND`, esse erro é estável para logs e respostas, e `clinicId` deve aparecer em logs estruturados, conforme `docs/OBSERVABILITY.md`.

### Testes

`tests/__unit__/modules/prisma-mappers.spec.ts` cobre `ClinicPrismaMapper` e valida preservação de `id`, `createdAt`, `updatedAt` e normalização do nome com `trim`.

### Resumo

`clinics` é menos um módulo de gestão de clínicas e mais um módulo de identidade e fronteira operacional. Seu código é pequeno, mas seu papel é central: garantir existência da clínica e sustentar isolamento por `clinicId` em todo o sistema.

## English (en-US)

### Overview

The `clinics` module represents the clinic as the root operational scope of the system. In the Parcela Mais challenge, almost every relevant operation depends on `clinicId` to guarantee clinic isolation and consistent reads and writes.

Today, `clinics` is a foundational module. It does not expose its own API or create/update use cases. Its role is to:

- materialize the `Clinic` entity
- validate basic clinic invariants
- fetch a clinic by identifier
- serve as a dependency so other modules can validate existence and scope

### Domain context

The core challenge is patient collections for clinics with AI support. That requires a simple multi-tenant model in which each clinic has its own operational dataset, cannot see another clinic's data, and drives operations from its own `clinicId`.

Because of that, `clinics` does not own collection or payment rules. It defines the organizational boundary on top of which the other modules operate.

### Current scope

Primary responsibility: ensure downstream operations only run for an existing, identified clinic.

Out of scope today: clinic authentication and onboarding, clinic-specific settings or commercial policies, HTTP CRUD, and clinic listing.

### Domain model

`ClinicEntity` in `src/modules/clinics/domain/entities/clinic.entity.ts`

Fields:

- `id`, `name`, `createdAt`, `updatedAt`

Invariants:

- name is required
- name is normalized with `trim`
- name cannot be empty after `trim`
- name must be between 2 and 120 characters

Domain errors:

- `CLINIC_NAME_REQUIRED`
- `CLINIC_NAME_TOO_SHORT`
- `CLINIC_NAME_TOO_LONG`

Behaviors:

- `ClinicEntity.create(props)`
- `ClinicEntity.createFrom(id, props, meta?)`
- `changeName(name)`

### Technical structure

Files:

- `src/modules/clinics/clinics.module.ts`
- `src/modules/clinics/domain/entities/clinic.entity.ts`
- `src/modules/clinics/application/repositories/clinic.repository.ts`
- `src/modules/clinics/infrastructure/prisma/clinic-prisma.mapper.ts`
- `src/modules/clinics/infrastructure/prisma/prisma-clinic.repository.ts`

Layers: `domain` with `ClinicEntity`, `application` with `ClinicRepository`, `infrastructure` with Prisma and mapper, and `Nest` with `ClinicsModule` exporting `ClinicRepository`.

Main contract:

- `findById(id: EntityId): Promise<ClinicEntity | null>`

### Persistence

Prisma/Postgres table: `clinics`

Main fields:

- `id`
- `name`
- `created_at`
- `updated_at`

`Clinic` has `1:N` relations with `Patient`, `DebtAgreement`, `Installment`, `Payment`, `CommunicationAttempt`, and `PaymentWebhookEvent`. This confirms the clinic as the root scope for operational data.

### How the module is used today

The module does not implement its own use cases. It is consumed by other modules as an existence and isolation precondition, especially in:

- `create-debt-agreement.use-case.ts`
- `list/get-debt-agreement.use-case.ts`
- `list-installments.use-case.ts`
- `list-communication-attempts.use-case.ts`
- `list-delinquent-patients.use-case.ts`
- `run-collection-rules.use-case.ts`
- `get-dashboard-summary.use-case.ts`

Role in those flows:

- validate `clinicId` before the operation
- throw `CLINIC_NOT_FOUND` when the clinic does not exist
- reinforce that reads and writes must happen inside the correct tenant scope

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, `clinics` is the base layer for tenant isolation.

Derived rules: every operational query must respect `clinicId`, list endpoints must receive or infer `clinicId`, and cross-clinic leakage must never happen.

Validating clinic existence alone is not enough. Each consuming repository must also apply `clinicId` in its queries.

### Observability

The module does not currently own logs. Still, it contributes to safe operation because lookup failures produce `CLINIC_NOT_FOUND`, that error is stable for logs and application responses, and `clinicId` should appear in structured logs as described in `docs/OBSERVABILITY.md`.

### Tests

`tests/__unit__/modules/prisma-mappers.spec.ts` covers `ClinicPrismaMapper` and validates `id`, `createdAt`, `updatedAt`, and trimmed name normalization.

### Summary

`clinics` is less a clinic management module and more an identity and operational boundary module. Its code is small, but its role is central: guarantee clinic existence and sustain `clinicId` isolation across the system.
