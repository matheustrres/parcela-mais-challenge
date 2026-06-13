# Dashboard Module

## Português (pt-BR)

### Visão geral

O módulo `dashboard` consolida a visão operacional da clínica em um único resumo. Ele agrega recebíveis, acordos, parcelas, pacientes, cobranças, pagamentos e a fila prioritária de inadimplentes para suportar acompanhamento diário.

No desafio da Parcela Mais, este módulo é a superfície de leitura gerencial do sistema. Seu papel é:

- agregar indicadores financeiros e operacionais por clínica
- calcular recortes temporais com base em `referenceDate`
- combinar métricas consolidadas com a fila de prioridade de cobrança
- expor um payload único para consumo por dashboard ou relatório

### Contexto no domínio

O dashboard não cria ou altera estado de negócio. Ele projeta uma visão de leitura sobre dados já existentes em outros módulos, especialmente `debt-agreements`, `installments`, `payments`, `communications` e `collections`.

Por isso, `dashboard` não decide regras de cobrança nem registra pagamentos. Ele transforma estado operacional disperso em uma visão resumida e acionável.

### Escopo atual

Responsabilidade principal: retornar um resumo operacional de uma clínica para uma data de referência.

Fora do escopo atual: gráficos históricos, filtros avançados, comparação entre clínicas, exportação, drill-down detalhado por widget e persistência de snapshots.

### Modelo de domínio

O módulo não possui entidade de domínio própria persistida. Seu núcleo está no contrato de leitura `DashboardSummaryQueryRepository` e no tipo `DashboardSummary`.

Seções principais do payload:

- `receivables`
- `agreements`
- `installments`
- `patients`
- `collections`
- `payments`
- `priority`

Item principal de prioridade:

- `DashboardPriorityQueueItem`

Esse item expõe paciente, atraso, score, razões, última comunicação e próxima ação sugerida.

### Regras de negócio principais

O resumo segue regras semânticas importantes do projeto:

- `receivables` considera apenas acordos `ACTIVE`
- agregados de parcelas consideram apenas acordos não cancelados ou ativos, conforme a métrica
- `installments.open` inclui parcelas `PENDING` e `PARTIALLY_PAID` com saldo em aberto
- `overdue`, `dueToday` e `dueSoon` dependem de `referenceDate`
- `priority.topDelinquentPatients` vem do `ListDelinquentPatientsUseCase`
- `suggestedActionSkippedReason` preserva a precedência da `CollectionRulePolicyDomainService`

Janelas temporais usadas hoje:

- `paidAmountLast7DaysCents`
- `paidAmountLast30DaysCents`
- `dueSoon` até `7` dias

### Caso de uso exposto

`GetDashboardSummaryUseCase`:

- valida `clinicId`
- resolve `referenceDate`, usando data atual quando ausente
- verifica existência da clínica
- consulta agregados base no repositório de dashboard
- consulta top `5` inadimplentes via `ListDelinquentPatientsUseCase`
- injeta a fila prioritária no payload final

Endpoint exposto:

- `GET /dashboard/summary`

### Integrações e dependências

Dependências principais:

- `ClinicsModule` para validar existência da clínica
- `CollectionsModule` para obter a fila priorizada de inadimplentes
- `DatabaseService` via repositório Prisma para agregar dados de acordos, pacientes, comunicações e pagamentos

Fontes lidas hoje:

- `debtAgreement`
- `patient`
- `communicationAttempt`
- `payment`

### Persistência e agregação

O módulo não possui tabela própria. Ele monta o resumo a partir de consultas agregadas em outras tabelas.

Detalhes importantes da implementação:

- usa `clinicId` como filtro em todas as consultas
- considera `paidAt <= referenceDate` para pagamentos
- usa data de negócio em `America/Sao_Paulo` para comparar dias
- filtra tentativas de comunicação futuras ao calcular contadores efetivos

### Privacidade e isolamento

Alinhado com `docs/DATA_PRIVACY.md`, o dashboard deve sempre respeitar escopo por clínica e não expor dados de outra operação.

Cuidados centrais:

- toda leitura é filtrada por `clinicId`
- a fila prioritária traz apenas contexto financeiro e operacional mínimo
- não deve incluir dados clínicos
- não deve misturar métricas de clínicas diferentes

### Observabilidade

Este módulo materializa várias métricas sugeridas em `docs/OBSERVABILITY.md`, como:

- dívida em aberto
- valor vencido
- quantidade de inadimplentes
- tentativas de cobrança por canal e tipo
- pagamentos recentes

Erros de aplicação relevantes:

- `CLINIC_NOT_FOUND`
- `INVALID_DASHBOARD_REFERENCE_DATE`

### Testes

Não encontrei, neste recorte, spec unitária dedicada ao módulo `dashboard`.

Isso indica um gap atual: as regras semânticas do resumo estão documentadas e implementadas, mas não encontrei teste específico cobrindo agregações, recortes temporais e composição da fila prioritária.

### Resumo

`dashboard` é o módulo de leitura executiva do sistema. Ele não altera o domínio, mas transforma dados dispersos em um resumo operacional coerente, escopado por clínica e alinhado à lógica real de cobrança.

## English (en-US)

### Overview

The `dashboard` module consolidates a clinic's operational view into a single summary. It aggregates receivables, agreements, installments, patients, collections, payments, and the delinquent priority queue to support day-to-day monitoring.

In the Parcela Mais challenge, this module is the managerial read surface of the system. Its role is to:

- aggregate financial and operational indicators by clinic
- calculate time-based slices using `referenceDate`
- combine consolidated metrics with the collection priority queue
- expose a single payload for dashboard or reporting consumers

### Domain context

The dashboard does not create or mutate business state. It projects a read view on top of data owned by other modules, especially `debt-agreements`, `installments`, `payments`, `communications`, and `collections`.

Because of that, `dashboard` does not decide collection rules or register payments. It turns dispersed operational state into a summarized, actionable view.

### Current scope

Primary responsibility: return an operational clinic summary for a reference date.

Out of scope today: historical charts, advanced filters, cross-clinic comparison, export, widget drill-down, and persisted snapshots.

### Domain model

The module has no persisted domain entity of its own. Its core lives in the read contract `DashboardSummaryQueryRepository` and the `DashboardSummary` type.

Main payload sections:

- `receivables`
- `agreements`
- `installments`
- `patients`
- `collections`
- `payments`
- `priority`

Main priority item:

- `DashboardPriorityQueueItem`

This item exposes patient, delinquency, score, reasons, last communication, and the suggested next action.

### Core business rules

The summary follows important semantic rules from the project:

- `receivables` considers only `ACTIVE` agreements
- installment aggregates consider only non-canceled or active agreements depending on the metric
- `installments.open` includes `PENDING` and `PARTIALLY_PAID` installments with open balance
- `overdue`, `dueToday`, and `dueSoon` depend on `referenceDate`
- `priority.topDelinquentPatients` comes from `ListDelinquentPatientsUseCase`
- `suggestedActionSkippedReason` preserves `CollectionRulePolicyDomainService` precedence

Current time windows:

- `paidAmountLast7DaysCents`
- `paidAmountLast30DaysCents`
- `dueSoon` up to `7` days

### Technical structure

Main files:

- `src/modules/dashboard/dashboard.module.ts`
- `src/modules/dashboard/application/repositories/dashboard-summary-query.repository.ts`
- `src/modules/dashboard/application/use-cases/get-dashboard-summary.use-case.ts`
- `src/modules/dashboard/infrastructure/prisma/prisma-dashboard-summary-query.repository.ts`
- `src/modules/dashboard/presentation/http/dashboard.controller.ts`
- `src/modules/dashboard/presentation/http/dtos/get-dashboard-summary-query.dto.ts`

Layers: `application` with the read contract and use case, `infrastructure` with Prisma aggregation, and `presentation` with the HTTP endpoint.

### Exposed use case

`GetDashboardSummaryUseCase`:

- validates `clinicId`
- resolves `referenceDate`, defaulting to current time when absent
- checks clinic existence
- queries base aggregates from the dashboard repository
- queries top `5` delinquent patients through `ListDelinquentPatientsUseCase`
- injects the priority queue into the final payload

Exposed endpoint:

- `GET /dashboard/summary`

### Integrations and dependencies

Main dependencies:

- `ClinicsModule` to validate clinic existence
- `CollectionsModule` to obtain the prioritized delinquent queue
- `DatabaseService` through the Prisma repository to aggregate agreements, patients, communications, and payments

Current read sources:

- `debtAgreement`
- `patient`
- `communicationAttempt`
- `payment`

### Persistence and aggregation

The module does not own a table. It builds the summary from aggregated reads over other tables.

Important implementation details:

- uses `clinicId` as a filter in every query
- considers `paidAt <= referenceDate` for payments
- uses business-day comparison in `America/Sao_Paulo`
- filters out future communication attempts when computing effective counters

### Privacy and isolation

Aligned with `docs/DATA_PRIVACY.md`, the dashboard must always respect clinic scope and must not expose data from another operation.

Core safeguards:

- every read is filtered by `clinicId`
- the priority queue carries only minimal financial and operational context
- it must not include clinical details
- it must not mix metrics from different clinics

### Observability

This module materializes multiple metrics suggested in `docs/OBSERVABILITY.md`, such as:

- open debt
- overdue amount
- delinquent patient count
- collection attempts by channel and type
- recent payments

Relevant application errors:

- `CLINIC_NOT_FOUND`
- `INVALID_DASHBOARD_REFERENCE_DATE`

### Summary

`dashboard` is the system's executive read module. It does not mutate the domain, but it turns scattered data into a coherent operational summary, scoped by clinic and aligned with the real collection logic.
