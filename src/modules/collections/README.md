# Collections Module

## Português (pt-BR)

### Visão geral

O módulo `collections` concentra a lógica de cobrança do sistema. Ele decide quando uma parcela pode gerar comunicação, qual tipo deve ser aplicado, quais canais são elegíveis e como priorizar pacientes inadimplentes para ação operacional.

No desafio da Parcela Mais, este é o módulo que traduz a régua de cobrança em comportamento auditável. Seu papel é:

- avaliar elegibilidade de comunicação por parcela
- aplicar milestones da régua (`D-3`, `D0`, `D+2`, `D+7`, `D+15`)
- bloquear geração quando houver impedimentos operacionais
- calcular score de prioridade de inadimplência
- gerar tentativas de comunicação simuladas

### Contexto no domínio

O desafio exige uma régua simples, determinística e segura para pacientes. O envio real está fora do MVP; o sistema apenas gera e registra tentativas simuladas.

Por isso, `collections` não faz conciliação financeira nem entrega real de mensagens. Ele coordena decisão, priorização e registro operacional da cobrança.

### Escopo atual

Responsabilidade principal: decidir cobrança e priorização dentro do escopo de uma clínica e de uma data de referência.

Fora do escopo atual: envio real de WhatsApp/e-mail, IA generativa para texto, renegociação, campanhas livres, cadências fora da régua documentada e automação por job em produção.

### Modelo de domínio

O módulo não introduz uma entidade própria persistida. O núcleo está em serviços de domínio e objetos de decisão.

Serviços principais: `CollectionRulePolicyDomainService`, `CollectionPriorityScoreDomainService`, `CollectionCommunicationMessageFactoryDomainService`.

Enums centrais: `ECollectionRuleSkippedReason` e `ECollectionPriorityScoreReason`.

### Regras de negócio principais

#### Régua de cobrança

- `D-3` → `PRE_DUE_REMINDER` via WhatsApp
- `D0` → `DUE_DATE_REMINDER` via WhatsApp
- `D+2` → `OVERDUE_SOFT_NOTICE` via WhatsApp
- `D+7` → `OVERDUE_FOLLOW_UP` via WhatsApp e e-mail
- `D+15` → `OVERDUE_ESCALATION` via e-mail

#### Bloqueios globais

A policy pula geração quando encontra o primeiro bloqueio aplicável:

- parcela paga
- parcela cancelada
- acordo cancelado
- paciente `DO_NOT_CONTACT`
- paciente sem contato válido
- fora do horário comercial
- data sem regra aplicável
- paciente já contatado no dia
- pagamento parcial recente

Bloqueios por ação: mesmo quando a régua gera múltiplos canais, cada ação pode ser pulada individualmente se já existir comunicação igual para a mesma parcela e canal.

#### Janela de tempo

- persistência em UTC
- avaliação de horário em `America/Sao_Paulo`
- janela comercial: `09:00` às `18:00`
- cooldown operacional de pagamento parcial: últimas `24h`

#### Priorização

O score considera dias em atraso, valor total vencido, quantidade de parcelas vencidas, penalidade por comunicação recente e penalidade por pagamento parcial recente.

O resultado é limitado a `0..100` e retorna razões auditáveis, como `OVERDUE_DAYS` e `RECENT_PARTIAL_PAYMENT`.

### Casos de uso

`RunCollectionRulesUseCase`:

- valida `clinicId` e `referenceDate`
- busca candidatas elegíveis para avaliação
- consulta comunicações anteriores e pagamentos recentes
- pede decisão à policy
- gera mensagem por template
- persiste `CommunicationAttempt` geradas em transação

`ListDelinquentPatientsUseCase`:

- valida `clinicId`, paginação e `referenceDate`
- busca parcelas vencidas em aberto
- agrupa por paciente
- calcula score e razões
- sugere próxima ação de cobrança
- ordena por prioridade operacional

### Integrações e dependências

Dependências principais: `ClinicsModule` para validar existência da clínica, `PaymentsModule` para pagamentos recentes e `CommunicationsModule` para histórico e persistência de tentativas.

Endpoints expostos: `POST /collection-rules/run` e `GET /delinquents`.

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, o módulo só deve operar com dados sintéticos e sempre escopados por `clinicId`.

Cuidados centrais: não vazar pacientes de outra clínica, não incluir dados clínicos nas mensagens, não usar tom ameaçador e não logar payloads sensíveis completos.

O factory de mensagens usa dados mínimos: nome, valor e vencimento formatado.

### Observabilidade

O módulo é o principal ponto para métricas de cobrança: quantas parcelas foram avaliadas, quantas comunicações foram geradas, quantas foram puladas e quais motivos de bloqueio ocorreram.

Erros e saídas importantes usam códigos estáveis, como `CLINIC_NOT_FOUND` e `INVALID_COLLECTION_REFERENCE_DATE`.

### Testes

Cobertura direta encontrada: `collection-rule-policy.service.spec.ts`, `collection-priority-score.service.spec.ts`, `run-collection-rules.use-case.spec.ts`, `list-delinquent-patients.use-case.spec.ts` e `collection-communication-message-factory.service.spec.ts`.

Essas specs cobrem milestones da régua, cooldown, bloqueios, geração multicanal, score, ordenação e persistência transacional das tentativas.

### Resumo

`collections` é o módulo que transforma atraso financeiro em decisão operacional de cobrança. Ele é o coração comportamental do desafio: aplica a régua, protege o paciente com guardrails, prioriza a fila de ação e registra comunicações simuladas de forma auditável.

## English (en-US)

### Overview

The `collections` module concentrates the system's collection logic. It decides when an installment can generate a communication, which type should apply, which channels are eligible, and how delinquent patients should be prioritized for operational action.

In the Parcela Mais challenge, this is the module that turns the collection policy into auditable behavior. Its role is to:

- evaluate communication eligibility per installment
- apply collection milestones (`D-3`, `D0`, `D+2`, `D+7`, `D+15`)
- block generation when operational blockers exist
- calculate delinquency priority score
- generate simulated communication attempts

### Domain context

The challenge requires a simple, deterministic, patient-safe collection policy. Real delivery is outside the MVP; the system only generates and records simulated attempts.

Because of that, `collections` does not perform financial reconciliation or real message delivery. It coordinates collection decision-making, prioritization, and operational record keeping.

### Current scope

Primary responsibility: decide collections and prioritization within the scope of a clinic and a reference date.

Out of scope today: real WhatsApp/email delivery, generative AI message writing, renegotiation, free-form campaigns, cadences outside the documented policy, and production job automation.

### Domain model

The module does not introduce its own persisted entity. Its core lives in domain services and decision objects.

Main services: `CollectionRulePolicyDomainService`, `CollectionPriorityScoreDomainService`, `CollectionCommunicationMessageFactoryDomainService`.

Core enums: `ECollectionRuleSkippedReason` and `ECollectionPriorityScoreReason`.

### Core business rules

#### Collection policy

- `D-3` → `PRE_DUE_REMINDER` via WhatsApp
- `D0` → `DUE_DATE_REMINDER` via WhatsApp
- `D+2` → `OVERDUE_SOFT_NOTICE` via WhatsApp
- `D+7` → `OVERDUE_FOLLOW_UP` via WhatsApp and email
- `D+15` → `OVERDUE_ESCALATION` via email

#### Global blockers

The policy skips generation when it finds the first applicable blocker:

- paid installment
- canceled installment
- canceled agreement
- `DO_NOT_CONTACT` patient
- patient without valid contact info
- outside business hours
- no rule for the current date
- patient already contacted today
- recent partial payment

Action-level blockers: even when the policy generates multiple channels, each action can still be skipped individually if the same communication already exists for the same installment and channel.

#### Time window

- persistence in UTC
- business-hour evaluation in `America/Sao_Paulo`
- business window: `09:00` to `18:00`
- operational cooldown for partial payment: last `24h`

#### Prioritization

The score considers days overdue, total overdue amount, overdue installment count, penalty for recent communication, and penalty for recent partial payment.

The result is capped to `0..100` and returns auditable reasons such as `OVERDUE_DAYS` and `RECENT_PARTIAL_PAYMENT`.

### Technical structure

Main files:

- `src/modules/collections/collections.module.ts`
- `src/modules/collections/application/use-cases/list-delinquent-patients.use-case.ts`
- `src/modules/collections/application/use-cases/run-collection-rules.use-case.ts`
- `src/modules/collections/domain/services/collection-rule-policy.service.ts`
- `src/modules/collections/domain/services/collection-priority-score.service.ts`
- `src/modules/collections/domain/services/collections-communication-message-factory.service.ts`
- `src/modules/collections/infrastructure/prisma/prisma-collection-candidate.repository.ts`
- `src/modules/collections/infrastructure/prisma/prisma-delinquent-patients-query.repository.ts`
- `src/modules/collections/presentation/http/collections.controller.ts`

Layers: `application` with use cases and ports, `domain` with policy, score, and templates, `infrastructure` with Prisma queries, and `presentation` with HTTP endpoints.

### Use cases

`RunCollectionRulesUseCase`:

- validates `clinicId` and `referenceDate`
- fetches eligible candidates for evaluation
- loads previous communications and recent payments
- asks the policy for a decision
- generates template-based messages
- persists generated `CommunicationAttempt` records inside a transaction

`ListDelinquentPatientsUseCase`:

- validates `clinicId`, pagination, and `referenceDate`
- fetches overdue open installments
- groups data by patient
- calculates score and reasons
- suggests the next collection action
- sorts by operational priority

### Integrations and dependencies

Main dependencies: `ClinicsModule` to validate clinic existence, `PaymentsModule` for recent payments, and `CommunicationsModule` for history and persistence of attempts.

Exposed endpoints: `POST /collection-rules/run` and `GET /delinquents`.

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, the module must only operate on synthetic data and must always be scoped by `clinicId`.

Core safeguards: no cross-clinic leakage, no clinical details in messages, no threatening tone, and no full sensitive payload logging.

The message factory uses only minimal data: patient name, amount, and formatted due date.

### Observability

This module is the main point for collection metrics: how many installments were evaluated, how many communications were generated, how many were skipped, and which skip reasons occurred.

Important errors and outputs use stable codes such as `CLINIC_NOT_FOUND` and `INVALID_COLLECTION_REFERENCE_DATE`.

### Tests

Direct coverage found: `collection-rule-policy.service.spec.ts`, `collection-priority-score.service.spec.ts`, `run-collection-rules.use-case.spec.ts`, `list-delinquent-patients.use-case.spec.ts`, and `collection-communication-message-factory.service.spec.ts`.

Those specs cover policy milestones, cooldown, blockers, multichannel generation, score, ordering, and transactional persistence of attempts.

### Summary

`collections` is the module that turns financial delinquency into an operational collection decision. It is the behavioral core of the challenge: it applies the policy, protects patients with guardrails, prioritizes the action queue, and records simulated communications in an auditable way.
