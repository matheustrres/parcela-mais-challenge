# Patients Module

## Português (pt-BR)

### Visão geral

O módulo `patients` concentra a representação do paciente sintético dentro do sistema. Ele define os dados mínimos de contato e o estado de elegibilidade para comunicação, servindo de base para acordos financeiros, cobrança e histórico de tentativas.

No desafio da Parcela Mais, este módulo é o ponto de entrada do contexto relacional do paciente com a clínica. Seu papel é:

- representar o paciente como entidade de domínio
- validar nome, vínculo com a clínica e informações de contato
- definir se o paciente pode ou não ser contatado
- sustentar isolamento por clínica para acordos e comunicações

### Contexto no domínio

Na linguagem do projeto, `Patient` é uma pessoa sintética vinculada a uma clínica e potencialmente associada a acordos financeiros, parcelas e comunicações.

Por isso, `patients` não executa cobrança nem registra pagamento. Ele controla os dados mínimos necessários para que outros módulos possam decidir se há contexto operacional suficiente para cobrança.

### Escopo atual

Responsabilidade principal: manter a identidade operacional do paciente e seu estado de contato dentro da clínica.

Fora do escopo atual: cadastro HTTP, busca/listagem, consentimento avançado, unificação de duplicados, histórico de alterações de contato, segmentação e qualquer armazenamento de dado clínico.

### Modelo de domínio

`PatientEntity` em `src/modules/patients/domain/entities/patient.entity.ts`

Campos principais:

- `name`
- `clinicId`
- `email`
- `phone`
- `preferredChannel`
- `contactStatus`

Status de contato:

- `ACTIVE`
- `DO_NOT_CONTACT`
- `MISSING_CONTACT_INFO`

Invariantes centrais:

- nome é obrigatório
- nome deve ter entre 2 e 120 caracteres
- `clinicId` é obrigatório
- e-mail, quando informado, deve ser válido
- telefone, quando informado, deve ter entre 8 e 20 caracteres
- canal `WHATSAPP` exige telefone
- canal `EMAIL` exige e-mail
- paciente com `MISSING_CONTACT_INFO` não pode ter `preferredChannel`

Normalizações:

- `name` recebe `trim`
- `email` recebe `trim` e `lowercase`
- `phone` recebe `trim`
- campos vazios opcionais viram `null`

Erros de domínio relevantes:

- `PATIENT_NAME_REQUIRED`
- `PATIENT_NAME_TOO_SHORT`
- `PATIENT_NAME_TOO_LONG`
- `PATIENT_CLINIC_ID_REQUIRED`
- `INVALID_PATIENT_EMAIL`
- `INVALID_PATIENT_PHONE`
- `WHATSAPP_CHANNEL_REQUIRES_PHONE`
- `EMAIL_CHANNEL_REQUIRES_EMAIL`
- `MISSING_CONTACT_INFO_CANNOT_HAVE_PREFERRED_CHANNEL`

Comportamentos:

- `PatientEntity.create(props)`
- `PatientEntity.createFrom(id, props, meta?)`
- `hasContactInfo()`
- `canBeContacted()`
- `markAsDoNotContact()`
- `markAsMissingContactInfo()`
- `changePreferredChannel(channel)`
- `updateContactInfo(input)`

### Regras de negócio principais

Elegibilidade de contato:

- o paciente precisa estar `ACTIVE`
- precisa ter pelo menos um meio de contato
- precisa ter `preferredChannel` definido

Transições relevantes:

- `markAsDoNotContact()` muda o status para bloqueio explícito
- `markAsMissingContactInfo()` muda o status e remove o canal preferido
- `changePreferredChannel()` reaplica validação de consistência
- `updateContactInfo()` recalcula normalização e validação sobre o estado completo

Isso torna `patients` um guardião local das pré-condições de contato usadas pela régua de cobrança.

### Persistência

Tabela Prisma/Postgres: `patients`

Campos principais:

- `clinic_id`
- `name`
- `email`
- `phone`
- `preferred_channel`
- `contact_status`
- `created_at`
- `updated_at`

Relacionamentos:

- `Patient` pertence a `Clinic`
- `Patient` possui `1:N` com `DebtAgreement`
- `Patient` possui `1:N` com `CommunicationAttempt`

Restrições e índices relevantes:

- unicidade em `clinicId + email`
- índice por `clinicId`
- índice por `clinicId + contactStatus`

### Integrações e dependências

Dependências principais:

- `ClinicsModule` como contexto pai do `clinicId`
- `DebtAgreementsModule` como consumidor do vínculo paciente-clínica
- `CollectionsModule` como consumidor do estado de contato
- `CommunicationsModule` como consumidor indireto da elegibilidade de contato

Uso atual no sistema:

- `CreateDebtAgreementUseCase` valida se o paciente existe
- o mesmo caso de uso garante que o paciente pertence à clínica correta
- `CollectionRulePolicyDomainService` depende de `contactStatus` e canais para decidir cobrança

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, o módulo deve operar apenas com dados sintéticos e não deve armazenar qualquer detalhe clínico.

Cuidados centrais:

- o paciente sempre pertence a uma clínica
- não expor pacientes de outra clínica
- não armazenar diagnóstico, procedimento, prontuário ou observações clínicas
- armazenar apenas nome e contato mínimos para cobrança

### Observabilidade

O módulo participa da operação principalmente por meio de estados que afetam cobrança:

- `ACTIVE`
- `DO_NOT_CONTACT`
- `MISSING_CONTACT_INFO`

Esses estados impactam diretamente bloqueios da régua e métricas como pacientes com dívida em aberto, pacientes inadimplentes e pacientes não elegíveis para contato.

### Testes

Cobertura direta encontrada:

- `tests/__unit__/modules/patients/domain/entities/patient.entity.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Essas specs cobrem normalização, validação de nome, e-mail, telefone, consistência de canal preferido, elegibilidade de contato, transições de status e mapeamento Prisma.

### Resumo

`patients` é o módulo que define a identidade operacional e a elegibilidade de contato do paciente. Ele não executa cobrança, mas condiciona se a cobrança pode acontecer com segurança e isolamento corretos.

## English (en-US)

### Overview

The `patients` module owns the representation of the synthetic patient inside the system. It defines the minimal contact data and contact-eligibility state that support financial agreements, collections, and communication history.

In the Parcela Mais challenge, this module is the entry point for the patient-clinic relationship context. Its role is to:

- represent the patient as a domain entity
- validate name, clinic ownership, and contact information
- define whether the patient can be contacted
- sustain clinic isolation for agreements and communications

### Domain context

In the project language, `Patient` is a synthetic person linked to a clinic and potentially associated with financial agreements, installments, and communications.

Because of that, `patients` does not execute collections or register payments. It controls the minimum data needed so that other modules can decide whether there is enough operational context to collect.

### Current scope

Primary responsibility: maintain patient operational identity and contact state inside the clinic.

Out of scope today: HTTP CRUD, search/listing, advanced consent, duplicate merging, contact-change history, segmentation, and any clinical data storage.

### Domain model

`PatientEntity` in `src/modules/patients/domain/entities/patient.entity.ts`

Main fields:

- `name`
- `clinicId`
- `email`
- `phone`
- `preferredChannel`
- `contactStatus`

Contact statuses:

- `ACTIVE`
- `DO_NOT_CONTACT`
- `MISSING_CONTACT_INFO`

Core invariants:

- name is required
- name must be between 2 and 120 characters
- `clinicId` is required
- email, when present, must be valid
- phone, when present, must be between 8 and 20 characters
- `WHATSAPP` channel requires a phone
- `EMAIL` channel requires an email
- a patient with `MISSING_CONTACT_INFO` cannot have a `preferredChannel`

Normalizations:

- `name` is trimmed
- `email` is trimmed and lowercased
- `phone` is trimmed
- empty optional fields become `null`

Relevant domain errors:

- `PATIENT_NAME_REQUIRED`
- `PATIENT_NAME_TOO_SHORT`
- `PATIENT_NAME_TOO_LONG`
- `PATIENT_CLINIC_ID_REQUIRED`
- `INVALID_PATIENT_EMAIL`
- `INVALID_PATIENT_PHONE`
- `WHATSAPP_CHANNEL_REQUIRES_PHONE`
- `EMAIL_CHANNEL_REQUIRES_EMAIL`
- `MISSING_CONTACT_INFO_CANNOT_HAVE_PREFERRED_CHANNEL`

Behaviors:

- `PatientEntity.create(props)`
- `PatientEntity.createFrom(id, props, meta?)`
- `hasContactInfo()`
- `canBeContacted()`
- `markAsDoNotContact()`
- `markAsMissingContactInfo()`
- `changePreferredChannel(channel)`
- `updateContactInfo(input)`

### Core business rules

Contact eligibility:

- the patient must be `ACTIVE`
- must have at least one contact method
- must have a defined `preferredChannel`

Relevant transitions:

- `markAsDoNotContact()` moves the status to explicit block
- `markAsMissingContactInfo()` changes the status and removes the preferred channel
- `changePreferredChannel()` reapplies consistency validation
- `updateContactInfo()` reruns normalization and validation against the full state

That makes `patients` a local guardian of the contact preconditions used by the collection policy.

### Technical structure

Main files:

- `src/modules/patients/patients.module.ts`
- `src/modules/patients/domain/entities/patient.entity.ts`
- `src/modules/patients/application/repositories/patient.repository.ts`
- `src/modules/patients/infrastructure/prisma/patient-prisma.mapper.ts`
- `src/modules/patients/infrastructure/prisma/prisma-patient.repository.ts`

Layers: `domain` with the entity, `application` with the `PatientRepository` port, and `infrastructure` with Prisma and mapper. The module currently exposes no controller or HTTP use case of its own.

Main contract:

- `findById(id: EntityId): Promise<PatientEntity | null>`

### Persistence

Prisma/Postgres table: `patients`

Main fields:

- `clinic_id`
- `name`
- `email`
- `phone`
- `preferred_channel`
- `contact_status`
- `created_at`
- `updated_at`

Relationships:

- `Patient` belongs to `Clinic`
- `Patient` has `1:N` with `DebtAgreement`
- `Patient` has `1:N` with `CommunicationAttempt`

Relevant constraints and indexes:

- uniqueness on `clinicId + email`
- index by `clinicId`
- index by `clinicId + contactStatus`

### Integrations and dependencies

Main dependencies:

- `ClinicsModule` as the parent `clinicId` context
- `DebtAgreementsModule` as a consumer of the patient-clinic link
- `CollectionsModule` as a consumer of contact state
- `CommunicationsModule` as an indirect consumer of contact eligibility

Current system usage:

- `CreateDebtAgreementUseCase` validates that the patient exists
- that same use case ensures the patient belongs to the correct clinic
- `CollectionRulePolicyDomainService` depends on `contactStatus` and channels to decide collection

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, the module must operate only on synthetic data and must not store any clinical detail.

Core safeguards:

- the patient always belongs to a clinic
- do not expose patients from another clinic
- do not store diagnosis, procedure, chart, or clinical notes
- store only the minimal name and contact data needed for collections

### Observability

The module participates in operations mainly through states that affect collections:

- `ACTIVE`
- `DO_NOT_CONTACT`
- `MISSING_CONTACT_INFO`

Those states directly affect collection blockers and metrics such as patients with open debt, delinquent patients, and patients not eligible for contact.

### Tests

Direct coverage found:

- `tests/__unit__/modules/patients/domain/entities/patient.entity.spec.ts`
- `tests/__unit__/modules/prisma-mappers.spec.ts`

Those specs cover normalization, validation of name, email, phone, preferred-channel consistency, contact eligibility, status transitions, and Prisma mapping.

### Summary

`patients` is the module that defines patient operational identity and contact eligibility. It does not execute collections, but it determines whether collections can happen safely and with proper isolation.
