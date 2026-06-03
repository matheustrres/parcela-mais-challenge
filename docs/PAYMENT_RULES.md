# Regras de pagamento e idempotência

## Objetivo

Garantir que pagamentos sejam registrados de forma segura, previsível e sem duplicidade.

Pagamentos são uma área crítica porque webhooks e integrações reais podem reenviar eventos, usuários podem repetir requisições e falhas de rede podem gerar incerteza sobre o processamento.

## Princípios

- Todo pagamento deve ser idempotente.
- Todo pagamento deve estar associado a uma parcela.
- Valores devem ser armazenados em centavos.
- Pagamento não pode exceder saldo em aberto no MVP.
- Pagamento deve atualizar o saldo da parcela em transação.
- Eventos duplicados devem ser reconhecidos e não reprocessados.

## Métodos de pagamento

```txt
PIX
BOLETO
MANUAL
WEBHOOK_SIMULATED
```

## Status de parcela após pagamento

| Condição | Status |
|---|---|
| `paidAmountCents === 0` | `PENDING` |
| `paidAmountCents > 0 && paidAmountCents < amountCents` | `PARTIALLY_PAID` |
| `paidAmountCents === amountCents` | `PAID` |
| Parcela cancelada | `CANCELED` |

## Registro de pagamento

Endpoint:

```http
POST /payments
```

Request:

```json
{
  "clinicId": "clinic_001",
  "installmentId": "installment_001",
  "amountCents": 50000,
  "method": "PIX",
  "externalReference": "pix_sim_123",
  "idempotencyKey": "payment-installment-001-pix-sim-123",
  "paidAt": "2026-06-03T12:00:00.000Z"
}
```

## Idempotência

### Chave principal

```txt
clinicId + idempotencyKey
```

### Chave externa opcional

```txt
clinicId + externalReference
```

## Comportamento esperado

### Primeira requisição

- Criar pagamento.
- Atualizar `paidAmountCents` da parcela.
- Atualizar status da parcela.
- Retornar pagamento criado.

### Requisição duplicada com mesmo payload

- Não criar novo pagamento.
- Retornar pagamento existente.
- Não alterar saldo novamente.

### Requisição duplicada com mesma chave e payload diferente

- Retornar erro `409 Conflict`.

Exemplo:

```json
{
  "code": "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
  "message": "The idempotency key was already used with a different payload."
}
```

## Pagamento parcial

Pagamento parcial é permitido.

Exemplo:

```txt
amountCents = 50000
paidAmountCents = 20000
remainingAmountCents = 30000
status = PARTIALLY_PAID
```

A régua de cobrança ainda pode considerar a parcela inadimplente se houver saldo vencido em aberto.

## Pagamento excedente

No MVP, rejeitar pagamento maior que saldo.

Erro:

```json
{
  "code": "PAYMENT_AMOUNT_EXCEEDS_INSTALLMENT_BALANCE",
  "message": "Payment amount exceeds installment remaining balance."
}
```

Em uma versão futura, seria possível tratar crédito, repasse para próxima parcela ou reembolso.

## Parcela já paga

Se a parcela já estiver paga e uma nova chave de pagamento for enviada, retornar erro de negócio.

```json
{
  "code": "INSTALLMENT_ALREADY_PAID",
  "message": "Installment is already fully paid."
}
```

Se a mesma `idempotencyKey` for reenviada, retornar pagamento existente.

## Webhook simulado

Endpoint:

```http
POST /webhooks/payments/simulated
```

Request:

```json
{
  "provider": "PIX_SIMULATOR",
  "eventId": "evt_001",
  "externalReference": "pix_sim_123",
  "installmentId": "installment_001",
  "amountCents": 50000,
  "paidAt": "2026-06-03T12:00:00.000Z"
}
```

## Idempotência do webhook

Chave única:

```txt
provider + eventId
```

Se o mesmo evento chegar novamente:

- não registrar novo pagamento;
- marcar como duplicado ou retornar evento já processado;
- manter resposta segura.

## Transação recomendada

Fluxo de pagamento deve ocorrer em transação:

```txt
1. buscar parcela com lock lógico/transacional
2. validar saldo
3. verificar idempotência
4. criar pagamento
5. atualizar paidAmountCents
6. atualizar status da parcela
7. commitar
```

## Auditoria

Todo pagamento deve registrar:

- método;
- referência externa;
- chave de idempotência;
- valor;
- data de pagamento;
- data de criação no sistema.

## Casos de teste obrigatórios

- pagamento novo com valor total;
- pagamento parcial;
- pagamento duplicado com mesma idempotency key;
- pagamento duplicado com payload diferente;
- pagamento maior que saldo;
- pagamento em parcela inexistente;
- pagamento em parcela já paga;
- webhook duplicado.
