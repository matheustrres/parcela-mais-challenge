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

## Dashboard mínimo

Endpoint:

```http
GET /dashboard/summary?clinicId=clinic_001&referenceDate=2026-06-03
```

Resposta:

```json
{
  "totalReceivableCents": 850000,
  "totalOverdueCents": 230000,
  "paidThisMonthCents": 120000,
  "overduePatients": 4,
  "openInstallments": 17,
  "paidInstallments": 9,
  "communicationsGeneratedToday": 6
}
```

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
