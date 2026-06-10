# Observabilidade e operação

## Objetivo

Demonstrar que o sistema foi pensado para operação real, mesmo no MVP.

O foco não é implementar stack completa de observabilidade, mas deixar logs, erros e eventos importantes suficientemente rastreáveis.

## Logs estruturados

Preferir logs em formato estruturado.

Campos úteis:

```txt
timestamp
level
context
clinicId
patientId
installmentId
operation
status
errorCode
```

## O que logar

### Pagamentos

- tentativa de registro;
- pagamento criado;
- pagamento duplicado por idempotência;
- pagamento rejeitado por regra de negócio;
- erro de webhook simulado.

### Régua de cobrança

- início da execução;
- quantidade de parcelas avaliadas;
- quantidade de comunicações geradas;
- quantidade de comunicações puladas;
- motivo de bloqueio quando relevante.

### IA

- provider usado;
- fallback acionado;
- guardrail reprovado;
- timeout ou erro externo.

Não logar prompt completo com dado sensível.

## Eventos de domínio relevantes

Eventos podem ser implementados ou apenas documentados no MVP.

Eventos úteis:

```txt
DebtAgreementCreated
InstallmentBecameOverdue
PaymentRegistered
InstallmentPaid
CommunicationAttemptGenerated
CommunicationAttemptSentSimulated
PaymentWebhookReceived
PaymentWebhookDuplicated
```

## Métricas sugeridas

Mesmo que não sejam implementadas com Prometheus, podem aparecer no dashboard ou logs.

```txt
payments_registered_total
payments_duplicated_total
collection_attempts_generated_total
collection_attempts_skipped_total
overdue_installments_total
overdue_amount_cents
ai_fallback_total
```

## Dashboard operacional

Endpoint:

```http
GET /dashboard/summary?clinicId=clinic_001&referenceDate=2026-06-10T15:00:00.000Z
```

Resposta:

```json
{
  "clinicId": "clinic_001",
  "referenceDate": "2026-06-10T15:00:00.000Z",
  "receivables": {
    "totalDebtAmountCents": 220000,
    "totalPaidAmountCents": 20000,
    "totalOpenAmountCents": 200000,
    "totalOverdueAmountCents": 80000
  },
  "agreements": {
    "total": 5,
    "active": 3,
    "canceled": 1,
    "fullyPaid": 1
  },
  "installments": {
    "total": 4,
    "open": 3,
    "paid": 1,
    "partiallyPaid": 1,
    "overdue": 1,
    "dueToday": 1,
    "dueSoon": 1
  },
  "patients": {
    "total": 6,
    "withOpenDebt": 3,
    "delinquent": 1,
    "doNotContact": 1,
    "missingContactInfo": 1
  },
  "collections": {
    "totalAttempts": 3,
    "generatedToday": 2,
    "byChannel": {
      "whatsapp": 2,
      "email": 1
    },
    "byType": {
      "preDueReminder": 0,
      "dueDateReminder": 1,
      "overdueSoftNotice": 1,
      "overdueFollowUp": 1,
      "overdueEscalation": 0
    }
  },
  "payments": {
    "totalPayments": 2,
    "paidAmountLast7DaysCents": 20000,
    "paidAmountLast30DaysCents": 110000
  },
  "priority": {
    "topDelinquentPatients": [
      {
        "patientId": "patient_001",
        "patientName": "Ana Sintetica",
        "totalOverdueCents": 80000,
        "overdueInstallments": 1,
        "daysOverdue": 7,
        "priorityScore": 45,
        "priorityReasons": ["OVERDUE_DAYS", "OVERDUE_AMOUNT"],
        "lastCommunicationAt": "2026-06-10T13:00:00.000Z",
        "suggestedAction": null,
        "suggestedActionSkippedReason": "PATIENT_ALREADY_CONTACTED_TODAY"
      }
    ]
  }
}
```

Notas semânticas:

- `receivables` considera apenas acordos `ACTIVE`.
- `installments.total` e os demais agregados de parcelas consideram apenas acordos `ACTIVE`; acordos cancelados entram apenas nos contadores administrativos de `agreements`.
- `installments.open` inclui parcelas `PENDING` e `PARTIALLY_PAID` com saldo em aberto.
- `agreements.fullyPaid` é um contador derivado de acordos quitados, não uma quarta categoria adicional do payload.
- `suggestedActionSkippedReason` representa o primeiro bloqueio encontrado pela `CollectionRulePolicyDomainService`, seguindo a ordem de precedência interna da policy.
- `priorityReasons.RECENT_PARTIAL_PAYMENT` usa janela heurística de até 7 dias para reduzir score; isso é diferente do bloqueio operacional de 24h usado para decidir se `suggestedAction` deve virar `null`.

## Tratamento de erros

Erros devem ter código estável.

Exemplo:

```json
{
  "code": "PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE",
  "message": "Payment amount exceeds installment remaining balance.",
  "details": {
    "installmentId": "installment_001",
    "remainingAmountCents": 30000
  }
}
```

## Falhas esperadas

### Falha na IA

Comportamento:

- registrar falha;
- usar template;
- continuar fluxo.

### Webhook duplicado

Comportamento:

- não reprocessar;
- retornar sucesso idempotente ou status de duplicado;
- registrar evento como duplicado.

### Pagamento inválido

Comportamento:

- rejeitar com erro de negócio;
- não alterar parcela;
- não criar pagamento parcial acidental.

## Segurança operacional

- Não expor stack trace em produção.
- Não logar `.env`.
- Não logar chave de IA.
- Não logar headers de autorização.
- Não logar dados reais.
