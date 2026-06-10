# Parcela Mais Technical Case

API backend para um recorte funcional de cobrança de parcelas em clínicas. O projeto implementa criação e consulta de dívidas por endpoints dedicados, geração de parcelas, registro de pagamentos com idempotência, régua de cobrança, listagem de inadimplentes e endpoints HTTP documentados via Swagger.

## Resumo do recorte

Priorizei entregar bem o núcleo mínimo do case:

- registrar e consultar dívidas;
- registrar pagamentos com proteção contra duplicidade;
- listar inadimplentes com priorização;
- aplicar uma régua de cobrança com regras explícitas;
- manter o sistema demonstrável por API, com dados sintéticos e testes.

Em vez de abrir muitas frentes, preferi concentrar esforço em consistência de domínio, isolamento por clínica, semântica temporal das leituras, idempotência de pagamento e previsibilidade dos fluxos críticos.

## O que foi priorizado e por quê

As prioridades deste recorte foram:

- `dívida + parcela + pagamento` como base do modelo, porque o restante da cobrança depende dessa consistência;
- leitura clara do estado atual da cobrança, com endpoints dedicados para consultar acordos e inadimplência;
- regras de comunicação determinísticas, porque a régua é o centro do desafio;
- robustez em pagamento, com idempotência, replay seguro e proteção contra atualização concorrente;
- dados sintéticos, isolamento multi-clínica e validações explícitas, para reduzir risco operacional e facilitar avaliação.

Escolhi não começar por frontend ou integrações externas porque isso aumentaria a superfície de demo sem melhorar tanto a qualidade do núcleo de cobrança.

## Contexto

Clínicas que parcelam tratamentos precisam:

- acompanhar parcelas a vencer e vencidas;
- priorizar cobrança por risco e atraso;
- registrar pagamentos sem duplicidade;
- controlar comunicações sem spam, respeitando regras de negócio e privacidade.

Este repositório implementa esse recorte com foco em modelagem de domínio, separação entre aplicação/domínio/infra, dados sintéticos e avaliação fácil via API.

## O que foi construído

- modelo de domínio para `Clinic`, `Patient`, `DebtAgreement`, `Installment`, `Payment` e `CommunicationAttempt`;
- mappers Prisma dedicados por entidade;
- casos de uso para criação e consulta de acordos com geração de parcelas;
- caso de uso para registro de pagamento com idempotência por `idempotencyKey` e `externalReference`;
- régua de cobrança para `D-3`, `D0`, `D+2`, `D+7` e `D+15`;
- score de priorização de inadimplentes;
- endpoints HTTP mínimos para demonstração;
- Swagger como interface principal de avaliação;
- seed sintético para demo manual;
- testes unitários e E2E dos fluxos críticos.

## O que ficou de fora

Para manter o recorte enxuto e sólido, deixei fora desta etapa:

- autenticação e autorização reais;
- renegociação / novo parcelamento;
- integrações reais de cobrança ou mensageria;
- webhook de pagamento completo;
- frontend dedicado para operação da clínica;
- camada analítica mais profunda do dashboard.

Esses itens seriam passos naturais de evolução, mas não eram necessários para demonstrar o raciocínio principal de modelagem, cobrança e pagamento.

## Stack

- Node.js
- TypeScript
- NestJS
- PostgreSQL
- Prisma ORM + `@prisma/adapter-pg`
- Swagger / OpenAPI
- Vitest
- Supertest
- Testcontainers para E2E

## Como rodar

Pré-requisitos:

- Node.js 20+
- PostgreSQL acessível localmente
- arquivo `.env.dev` configurado

Instalação:

```bash
npm install
```

Subir schema no banco de desenvolvimento:

```bash
npm run db:push:dev
```

Popular dados sintéticos:

```bash
npm run db:seed:dev
```

Subir API:

```bash
npm run start:dev
```

Swagger:

- ambiente não-produtivo: `http://localhost:{PORT}/api`

## Como testar

Unitários:

```bash
npm run test:unit
```

E2E:

```bash
npm run test:e2e
```

Cobertura:

```bash
npm run test:cov
```

Observações:

- os testes E2E usam `testcontainers`, então precisam de runtime de containers disponível;
- o arquivo `.env.test` deve existir e usar `NODE_ENV=test`.

## Dados sintéticos

O seed fica em [prisma/seed.ts](https://github.com/matheustrres/parcela-mais-challenge/blob/main/prisma/seed.ts) e cria cenários de demonstração com datas relativas ao dia atual em `America/Sao_Paulo`.

Cobertura principal do seed:

- `1` clínica;
- pacientes ativos;
- paciente `DO_NOT_CONTACT`;
- paciente sem contato;
- acordos ativos e cancelado;
- parcelas em `D-3`, `D0`, `D+2`, `D+7`, `D+15`;
- parcela parcialmente paga;
- pagamento parcial recente;
- tentativas anteriores de comunicação.

Todos os dados são sintéticos. Não há uso de dado clínico real, dado médico ou identificadores pessoais reais.

## Principais endpoints

- `GET /health`
- `POST /debt-agreements`
- `GET /debt-agreements`
- `GET /debt-agreements/:id`
- `POST /payments`
- `POST /collection-rules/run`
- `GET /delinquents`
- `GET /installments`
- `GET /communication-attempts`
- `GET /dashboard/summary`

## Modelo de domínio

Módulos principais:

- `clinics`
- `patients`
- `debt-agreements`
- `installments`
- `payments`
- `communications`
- `collections`
- `dashboard`

Responsabilidades:

- domínio: entidades, enums, policies e invariantes;
- aplicação: use cases e contratos de repositório;
- infraestrutura: Prisma repositories, query repositories e mappers;
- apresentação: controllers HTTP e DTOs.

Os mapeamentos Prisma <-> domínio foram extraídos para classes dedicadas, evitando tradução espalhada dentro dos repositories.

## Régua de cobrança

Regras implementadas:

- `D-3`: `PRE_DUE_REMINDER`
- `D0`: `DUE_DATE_REMINDER`
- `D+2`: `OVERDUE_SOFT_NOTICE`
- `D+7`: `OVERDUE_FOLLOW_UP` com WhatsApp + Email
- `D+15`: `OVERDUE_ESCALATION`

Skips relevantes:

- parcela paga;
- parcela cancelada;
- acordo cancelado;
- `DO_NOT_CONTACT`;
- ausência de contato;
- fora do horário comercial;
- sem regra para a data;
- paciente já contatado no dia;
- pagamento parcial recente;
- comunicação do mesmo tipo/canal já existente.

## Pagamentos e idempotência

O fluxo de pagamento implementa:

- pagamento total marcando parcela como `PAID`;
- pagamento parcial marcando parcela como `PARTIALLY_PAID`;
- idempotência por `clinicId + idempotencyKey`;
- deduplicação adicional por `clinicId + externalReference`;
- detecção de replay com payload divergente via hash normalizado;
- controle transacional de pagamento + atualização da parcela;
- controle de concorrência por `version` na parcela.

## Priorização de inadimplentes

`GET /delinquents` agrega parcelas vencidas por paciente e calcula score com base em:

- dias de atraso;
- valor em aberto;
- quantidade de parcelas vencidas;
- penalidade por comunicação recente;
- penalidade por pagamento parcial recente.

A listagem retorna paginação, score, razões do score, última comunicação e ação sugerida quando aplicável.

## Consulta de dívidas

O sistema permite registrar e consultar dívidas por endpoints dedicados:

- `POST /debt-agreements`: registra o acordo e gera parcelas.
- `GET /debt-agreements`: lista acordos da clínica com filtros por `patientId`, `status`, paginação e `referenceDate` opcional. Quando omitida, a API resolve internamente a data de referência atual e devolve esse valor no payload.
- `GET /debt-agreements/:id`: retorna o detalhe do acordo e das parcelas. Exige `referenceDate` para expor `derivedStatus` coerente por parcela.
- `GET /dashboard/summary`: aceita `referenceDate` opcional, mas para demo manual e vídeo o ideal é enviar uma data explícita para manter `overdue`, `dueToday`, `dueSoon`, fila e métricas de comunicação determinísticas.
  No contrato atual, agregados de `receivables` e `installments` consideram apenas acordos `ACTIVE`; acordos cancelados entram apenas nos contadores administrativos de `agreements`. Quando `suggestedAction` vier `null`, `suggestedActionSkippedReason` expõe o primeiro bloqueio encontrado pela `CollectionRulePolicyDomainService`, conforme a precedência interna da régua.

## Uso de IA

Usei IA como apoio de engenharia, não como fonte final de decisão.

Ela me ajudou a:

- acelerar exploração de alternativas de modelagem;
- estruturar planos de implementação;
- levantar edge cases de cobrança, leitura e pagamento;
- revisar lacunas de teste e ambiguidades de endpoint.

Os principais pontos em que precisei corrigir ou endurecer o que a IA sugeria foram:

- idempotência e replay de pagamento, onde respostas superficiais tendiam a ser inseguras;
- multicanal em `D+7`, para não reduzir uma regra importante a um único disparo simplificado;
- isolamento multi-clínica e privacidade, para evitar vazamento de escopo entre clínicas;
- separação entre domínio, aplicação e query layer, para não misturar regra de negócio com leitura HTTP;
- semântica temporal dos endpoints de leitura, deixando explícito quando `referenceDate` é obrigatória ou resolvida internamente.

Em resumo: usei IA para ganhar velocidade, mas validei manualmente as decisões estruturais e os casos mais sensíveis no código e nos testes.

## Trade-offs

- Swagger foi usado como interface principal de demonstração, sem frontend dedicado:
  isso reduziu tempo de apresentação e aumentou foco na API e nas regras de domínio.
- autenticação não foi implementada nesta etapa, então `clinicId` segue explícito nos endpoints:
  é um trade-off aceitável para o case, mas não seria a forma final de produção.
- Prisma `db push` foi mantido no fluxo local para reduzir atrito de setup:
  em um produto evoluindo por mais tempo, eu migraria para uma disciplina de migrations mais rígida.
- o seed foi pensado para demo manual e avaliação rápida, não para volumetria:
  priorizei legibilidade dos cenários em vez de massa de dados.
- `dashboard/summary` foi expandido como dashboard operacional sem frontend:
  entrega agregados executivos, métricas de cobrança e fila curta de priorização, mas ainda não é uma camada analítica histórica completa.
- a régua foi implementada com regras explícitas, não com decisão automatizada por IA em runtime:
  preferi previsibilidade e auditabilidade antes de sofisticação adaptativa.

## Próximos passos pensados

- autenticação/autorização multi-tenant;
- webhook de pagamento com persistência e replay;
- integração real de canais de comunicação;
- paginação/filtros mais ricos para read endpoints;
- observabilidade operacional mais forte;
- pipeline CI com execução automática de E2E.

## Referências

- [docs/COMMUNICATION_RULES.md](https://github.com/matheustrres/parcela-mais-challenge/blob/main/docs/COMMUNICATION_RULES.md)
- [docs/DATA_PRIVACY.md](https://github.com/matheustrres/parcela-mais-challenge/blob/main/docs/DATA_PRIVACY.md)
- [docs/DOMAIN_MODEL.md](https://github.com/matheustrres/parcela-mais-challenge/blob/main/docs/DOMAIN_MODEL.md)
- [docs/OBSERVABILITY.md](https://github.com/matheustrres/parcela-mais-challenge/blob/main/docs/OBSERVABILITY.md)
- [docs/PAYMENT_RULES.md](https://github.com/matheustrres/parcela-mais-challenge/blob/main/docs/PAYMENT_RULES.md)
