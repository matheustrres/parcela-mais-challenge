# Régua de cobrança

Documento central para a política de comunicação de cobrança.

A régua deve ser simples, auditável, determinística e segura para pacientes. O envio real de mensagens está fora do MVP; o sistema deve apenas gerar e registrar tentativas de comunicação simuladas.

## Régua principal

| Momento | Tipo | Canal | Tom | Objetivo |
| ------: | --- | --- | --- | --- |
| D-3 | `PRE_DUE_REMINDER` | WhatsApp simulado | Preventivo | Lembrar vencimento |
| D0 | `DUE_DATE_REMINDER` | WhatsApp simulado | Neutro | Evitar atraso |
| D+2 | `OVERDUE_SOFT_NOTICE` | WhatsApp simulado | Cordial | Avisar atraso recente |
| D+7 | `OVERDUE_FOLLOW_UP` | WhatsApp + e-mail simulado | Firme, sem ameaça | Reforçar pendência |
| D+15 | `OVERDUE_ESCALATION` | E-mail simulado | Formal | Sinalizar necessidade de contato |

## Restrições importantes

A régua deve pular comunicação se:

- parcela já foi paga;
- já houve comunicação do mesmo tipo para a mesma parcela;
- houve comunicação recente dentro do cooldown;
- paciente não tem canal de contato válido;
- valor em aberto é zero;
- data de vencimento é inválida;
- paciente está marcado como `DO_NOT_CONTACT`;
- parcela está cancelada;
- acordo financeiro está cancelado.

## Cooldown

- Não gerar mais de 1 cobrança por paciente por dia.
- Não repetir o mesmo tipo de cobrança para a mesma parcela.
- Não comunicar fora de janela comercial simulada.
- Não gerar nova cobrança se houve pagamento parcial nas últimas 24h.

## Janela comercial

- 09:00–18:00, horário de Brasília.
- Datas devem ser persistidas em UTC.
- A avaliação da janela comercial deve considerar `America/Sao_Paulo`.

## Canal

### WhatsApp simulado

Canal preferencial para lembretes curtos e cobranças iniciais.

Usado em:

- D-3;
- D0;
- D+2;
- D+7, combinado com e-mail.

### E-mail simulado

Canal preferencial para mensagens mais formais e rastreáveis.

Usado em:

- D+7, combinado com WhatsApp;
- D+15.

## Tipos de comunicação

### `PRE_DUE_REMINDER`

Usado 3 dias antes do vencimento.

Objetivo: lembrar sem pressionar.

Exemplo:

```txt
Olá, Ana. Passando para lembrar que existe uma parcela com vencimento em 10/06/2026 no valor de R$ 500,00. Caso precise de apoio, entre em contato com a clínica.
```

### `DUE_DATE_REMINDER`

Usado no dia do vencimento.

Objetivo: reduzir atraso operacional.

Exemplo:

```txt
Olá, Ana. Hoje vence uma parcela no valor de R$ 500,00. Caso já tenha realizado o pagamento, desconsidere esta mensagem.
```

### `OVERDUE_SOFT_NOTICE`

Usado 2 dias após o vencimento.

Objetivo: avisar atraso recente com tom cordial.

Exemplo:

```txt
Olá, Ana. Identificamos uma parcela em aberto com vencimento em 01/06/2026. Caso já tenha pago, desconsidere. Se precisar de apoio, a clínica está disponível para ajudar.
```

### `OVERDUE_FOLLOW_UP`

Usado 7 dias após o vencimento.

Objetivo: reforçar pendência com clareza, sem ameaça.

Exemplo:

```txt
Olá, Ana. Consta uma parcela em aberto no valor de R$ 500,00, vencida em 27/05/2026. Para evitar acúmulo de pendências, recomendamos entrar em contato com a clínica.
```

### `OVERDUE_ESCALATION`

Usado 15 dias após o vencimento.

Objetivo: comunicação formal e orientada à regularização.

Exemplo:

```txt
Olá, Ana. Ainda identificamos uma parcela em aberto referente ao seu acordo financeiro com a clínica. Entre em contato para verificar as alternativas disponíveis de regularização.
```

## Guardrails de mensagem

Mensagens nunca devem:

- citar diagnóstico;
- citar procedimento médico;
- expor detalhes clínicos;
- usar tom ameaçador;
- causar constrangimento;
- prometer desconto não implementado;
- prometer renegociação automática não implementada;
- mencionar negativação, protesto ou jurídico no MVP;
- incluir link real de pagamento;
- usar dados reais.

Mensagens devem:

- ser curtas;
- ser educadas;
- mencionar valor e vencimento quando aplicável;
- orientar contato com a clínica;
- permitir que o paciente desconsidere caso já tenha pago;
- ser auditáveis.

## Deduplicação

Chave lógica recomendada:

```txt
clinicId + patientId + installmentId + communicationType
```

Essa combinação evita gerar a mesma comunicação mais de uma vez para a mesma parcela.

## Execução

No MVP, a régua pode ser executada manualmente por endpoint:

```http
POST /collection-rules/run
```

Em produção, seria um job diário em janela comercial.

## Decisão de envio

O resultado da régua deve ser um objeto de decisão, não apenas uma string.

Exemplo:

```json
{
  "shouldGenerate": true,
  "type": "OVERDUE_SOFT_NOTICE",
  "channel": "WHATSAPP",
  "reason": "installment_is_2_days_overdue"
}
```

Quando a comunicação for bloqueada:

```json
{
  "shouldGenerate": false,
  "reason": "patient_has_recent_communication"
}
```
