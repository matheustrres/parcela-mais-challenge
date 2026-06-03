# Modelo de domínio

## Linguagem ubíqua

| Termo | Significado |
|---|---|
| Clínica | Empresa que oferece parcelamento ao paciente |
| Paciente | Pessoa com acordo financeiro junto à clínica |
| Acordo financeiro | Contrato ou dívida parcelada associada a um paciente |
| Parcela | Unidade cobrável do acordo financeiro |
| Pagamento | Evento financeiro que abate saldo de uma parcela |
| Inadimplente | Paciente com uma ou mais parcelas vencidas e saldo em aberto |
| Régua de cobrança | Política que decide quando e como comunicar o paciente |
| Tentativa de comunicação | Registro auditável de uma mensagem gerada ou enviada de forma simulada |
| Score de prioridade | Número usado para ordenar quem deve ser cobrado primeiro |

## Entidades

### Clinic

Representa a clínica.

Campos sugeridos:

```txt
id
name
createdAt
updatedAt
```

### Patient

Representa um paciente sintético.

Campos sugeridos:

```txt
id
clinicId
name
email
phone
preferredChannel
contactStatus
createdAt
updatedAt
```

`contactStatus`:

```txt
ACTIVE
DO_NOT_CONTACT
MISSING_CONTACT_INFO
```

Não armazenar dados clínicos ou documentos reais.

### DebtAgreement

Representa um acordo financeiro parcelado.

Campos sugeridos:

```txt
id
clinicId
patientId
totalAmountCents
installmentsCount
status
createdAt
updatedAt
```

Status:

```txt
ACTIVE
PAID
CANCELED
```

### Installment

Representa uma parcela cobrável.

Campos sugeridos:

```txt
id
clinicId
debtAgreementId
installmentNumber
dueDate
amountCents
paidAmountCents
status
paidAt
createdAt
updatedAt
```

Status persistido:

```txt
PENDING
PARTIALLY_PAID
PAID
CANCELED
```

Status derivado para consulta:

```txt
OPEN
DUE_TODAY
OVERDUE
PAID
PARTIALLY_PAID
CANCELED
```

Preferência: `OVERDUE` e `DUE_TODAY` devem ser calculados a partir de `dueDate`, `amountCents`, `paidAmountCents` e data de referência.

### Payment

Representa um pagamento registrado.

Campos sugeridos:

```txt
id
clinicId
installmentId
amountCents
method
externalReference
idempotencyKey
paidAt
createdAt
```

Métodos:

```txt
PIX
BOLETO
MANUAL
WEBHOOK_SIMULATED
```

### CommunicationAttempt

Representa uma tentativa de comunicação da régua.

Campos sugeridos:

```txt
id
clinicId
patientId
installmentId
type
channel
status
scheduledFor
sentAt
message
aiGenerated
createdAt
```

Tipos:

```txt
PRE_DUE_REMINDER
DUE_DATE_REMINDER
OVERDUE_SOFT_NOTICE
OVERDUE_FOLLOW_UP
OVERDUE_ESCALATION
PAYMENT_CONFIRMATION
```

Canais:

```txt
WHATSAPP
EMAIL
```

Status:

```txt
PENDING
GENERATED
SENT_SIMULATED
SKIPPED
FAILED
```

### PaymentWebhookEvent

Representa um evento de pagamento recebido por integração simulada.

Campos sugeridos:

```txt
id
provider
eventId
externalReference
payload
status
processedAt
errorMessage
createdAt
```

Status:

```txt
RECEIVED
PROCESSED
IGNORED_DUPLICATE
FAILED
```

## Relacionamentos

```txt
Clinic 1 --- N Patient
Clinic 1 --- N DebtAgreement
Patient 1 --- N DebtAgreement
DebtAgreement 1 --- N Installment
Installment 1 --- N Payment
Installment 1 --- N CommunicationAttempt
Patient 1 --- N CommunicationAttempt
```

## Invariantes

### Patient

- Paciente pertence a uma clínica.
- Paciente com `DO_NOT_CONTACT` não pode receber comunicação de cobrança.
- Dados devem ser sintéticos.

### DebtAgreement

- Valor total deve ser maior que zero.
- Quantidade de parcelas deve ser maior que zero.
- Soma das parcelas deve ser igual ao valor total.
- Diferenças de arredondamento devem ser distribuídas entre as parcelas.

### Installment

- `amountCents` deve ser maior que zero.
- `paidAmountCents` não pode ser negativo.
- `paidAmountCents` não pode ser maior que `amountCents`.
- Parcela com `paidAmountCents === amountCents` é paga.
- Parcela cancelada não pode receber novo pagamento no MVP.

### Payment

- Pagamento deve ter `idempotencyKey`.
- Pagamento não pode exceder saldo da parcela.
- Pagamento duplicado deve retornar o pagamento já existente.
- Pagamento confirmado deve atualizar o saldo da parcela.

### CommunicationAttempt

- Não repetir mesmo tipo de comunicação para a mesma parcela.
- Não gerar cobrança para parcela paga.
- Não gerar cobrança para paciente sem contato válido.
- Não gerar cobrança para paciente `DO_NOT_CONTACT`.
- Respeitar cooldown diário.

## Cálculos

### Saldo da parcela

```txt
remainingAmountCents = amountCents - paidAmountCents
```

### Dias em atraso

```txt
daysOverdue = max(0, referenceDate - dueDate)
```

A comparação deve usar data local de negócio quando relevante.

### Inadimplência

Um paciente é inadimplente quando existe ao menos uma parcela com:

```txt
dueDate < referenceDate
remainingAmountCents > 0
status != CANCELED
```

### Score de prioridade

Score base de 0 a 100.

Critérios:

- dias de atraso aumentam score;
- valor vencido aumenta score;
- múltiplas parcelas vencidas aumentam score;
- comunicação recente reduz score;
- pagamento parcial recente reduz score.

Exemplo conceitual:

```txt
score = overdueDaysScore + overdueAmountScore + overdueCountScore - recentCommunicationPenalty - recentPartialPaymentPenalty
```

O resultado deve ser limitado entre 0 e 100.
