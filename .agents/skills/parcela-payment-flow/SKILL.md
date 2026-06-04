---
name: parcela-payment-flow
description: Guide payment and webhook changes in Parcela Mais. Trigger when a task touches Payment, PaymentWebhookEvent, installment balance updates, idempotency keys, duplicate detection, transactional payment registration, or webhook replay handling.
---

# Parcela Payment Flow

Use this skill for any payment-path change.

## Read first

Load these docs before deciding implementation details:

- `docs/PAYMENT_RULES.md`
- `docs/DOMAIN_MODEL.md`
- `docs/OBSERVABILITY.md`
- `docs/DATA_PRIVACY.md` when logs or payload exposure are affected

Then inspect the touched entities, services, repositories, and unit tests.

## Workflow

1. Confirm the payment entry path:
   - direct payment registration
   - simulated webhook
   - duplicate replay or retry
2. Identify the idempotency keys in play:
   - primary `clinicId + idempotencyKey`
   - optional `clinicId + externalReference`
   - webhook `provider + eventId`
3. Verify the transactional sequence:
   - fetch installment
   - validate remaining balance
   - validate idempotency
   - create payment or return existing payment
   - update installment paid amount and status
4. Decide duplicate behavior explicitly:
   - same key + same payload returns existing payment
   - same key + different payload returns stable conflict
5. Confirm no invalid path can create a partial side effect.
6. Add or update logs, error codes, and tests for the affected path.

## Output

Produce a compact checklist with:

- idempotency contract
- transaction contract
- installment state transitions
- required stable errors
- mandatory tests from `docs/PAYMENT_RULES.md`

## Guardrails

- Never allow payment amount to exceed remaining installment balance in the MVP.
- Treat duplicate detection as a business contract, not just a persistence detail.
- Reject or safely absorb retries without mutating balance twice.
- Keep values in cents and avoid logging full sensitive payloads.
