---
name: parcela-collection-rules
description: Shape collection-rule and communication policy changes for Parcela Mais. Trigger when a task changes delinquency logic, communication eligibility, cooldown, business-hour checks, channel choice, deduplication, decision objects, or overdue prioritization.
---

# Parcela Collection Rules

Use this skill for any cobrança or communication-policy change.

## Read first

Read these sources before designing behavior:

- `docs/COMMUNICATION_RULES.md`
- `docs/DOMAIN_MODEL.md`
- `docs/DATA_PRIVACY.md`
- `docs/OBSERVABILITY.md` when logs, reasons, or metrics are affected

Then inspect current policy services, entities, and tests related to installments, patients, debt agreements, and communication attempts.

## Workflow

1. Identify the decision surface:
   - eligibility to generate
   - communication type
   - channel selection
   - reason for skip or generation
2. Model the result as a decision object, not an ad-hoc boolean or string.
3. Check all mandatory blockers:
   - paid installment
   - zero open balance
   - canceled installment or debt agreement
   - patient without valid contact
   - `DO_NOT_CONTACT`
   - duplicate communication type for the installment
   - recent communication in cooldown
   - recent partial payment in the last 24h
   - invalid due date
4. Validate time behavior:
   - persist timestamps in UTC
   - evaluate the business window in `America/Sao_Paulo`
   - enforce 09:00-18:00
5. Map the rule to the documented milestones:
   - D-3
   - D0
   - D+2
   - D+7
   - D+15
6. Define tests for both generation and skip reasons.

## Output

Produce a compact policy brief with:

- decision object contract
- milestone mapping
- blocker matrix
- timezone and cooldown assumptions
- mandatory tests

## Guardrails

- Keep the rule deterministic and audit-friendly.
- Separate business eligibility from message generation details.
- Do not emit threatening, clinical, or non-MVP messaging behavior.
- Surface doc/code mismatches before implementation when communication states or channels differ.
