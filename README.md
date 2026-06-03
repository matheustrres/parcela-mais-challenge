# ParcelaMais

API para apoio à cobrança de parcelas de pacientes de clínicas, construída como recorte funcional para o desafio técnico da Parcela Mais.

O foco do projeto é demonstrar modelagem de domínio, API backend, régua de cobrança, registro de pagamentos, listagem de inadimplentes, uso crítico de IA e cuidado com dados sensíveis.

## Problema

Clínicas que oferecem parcelamento precisam acompanhar parcelas a vencer e vencidas, comunicar pacientes em momentos corretos e priorizar a cobrança sem aumentar trabalho manual.

Este projeto resolve um recorte desse problema:

- cadastrar pacientes sintéticos;
- criar acordos de dívida/parcelamento;
- gerar parcelas;
- registrar pagamentos;
- consultar inadimplentes;
- executar uma régua de comunicação;
- gerar mensagens simuladas com apoio de IA ou template determinístico.

## Stack proposta

- Node.js
- NestJS
- PostgreSQL
- Prisma ORM
- Docker Compose
- Swagger/OpenAPI
- Jest para testes unitários e integração

## Escopo do MVP

Incluído:

- modelo de dados para clínica, paciente, acordo, parcela, pagamento e comunicação;
- API REST para registrar e consultar dívidas;
- API para registrar pagamentos com idempotência;
- listagem de inadimplentes com score de prioridade;
- régua de cobrança D-3, D0, D+2, D+7 e D+15;
- mensagens simuladas;
- dados 100% sintéticos;
- documentação das decisões e trade-offs.

Fora do MVP:

- integração real com WhatsApp;
- integração real com PIX, boleto ou adquirente;
- autenticação multiusuário completa;
- renegociação completa;
- uso de dados reais;
- envio real de mensagens;
- frontend avançado.

## Como rodar

```bash
cp .env.example .env
docker compose up -d
pnpm install
npx prisma migrate dev
npx prisma db seed
pnpm start:dev
```

## Endpoints principais

- `POST /patients`
- `GET /patients`
- `POST /debt-agreements`
- `GET /debt-agreements/:id`
- `GET /installments/overdue`
- `POST /payments`
- `GET /delinquents`
- `POST /collection-rules/run`
- `GET /communication-attempts`
- `GET /dashboard/summary`

## Dados sintéticos

Todos os dados usados no projeto devem ser fictícios. Não usar nomes reais, CPF, telefone real, e-mail real, diagnóstico, tratamento específico ou qualquer dado médico.

## Como a IA foi usada

IA pôde ser usada para acelerar brainstorming de entidades, cenários de cobrança, mensagens e testes. As saídas devem ser revisadas criticamente.

Correções esperadas sobre sugestões de IA:

- remover campos sensíveis desnecessários;
- evitar mensagens agressivas ou constrangedoras;
- evitar promessas de desconto ou renegociação não implementadas;
- evitar integrações reais fora do escopo;
- transformar ideias amplas em regras auditáveis e testáveis.

## Documentação complementar

- `PROJECT_SCOPE.md`
- `ARCHITECTURE.md`
- `DOMAIN_MODEL.md`
- `API_GUIDELINES.md`
- `COMMUNICATION_RULES.md`
- `PAYMENT_RULES.md`
- `AI_USAGE.md`
- `DATA_PRIVACY.md`
- `TESTING_GUIDELINES.md`
- `OBSERVABILITY.md`
- `DEVELOPMENT_WORKFLOW.md`