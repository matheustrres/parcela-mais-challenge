---
name: parcela-privacy-guardrails
description: Review privacy, synthetic-data, and clinic-isolation constraints in Parcela Mais. Trigger when a task touches payloads, logs, prompts, fixtures, seeds, examples, webhooks, list endpoints, or any data exposed across clinics.
---

# Parcela Privacy Guardrails

Use this skill whenever a change can expose or move operational data.

## Read first

Read these docs before implementation or review:

- `docs/DATA_PRIVACY.md`
- `docs/OBSERVABILITY.md`
- `PARCELA_MAIS_CHALLENGE.md`

Read `docs/DOMAIN_MODEL.md` too when the change affects entity fields or query scope.

## Workflow

1. Identify every data surface touched by the change:
   - request payload
   - response body
   - logs
   - test fixtures
   - seed data
   - documentation examples
   - AI prompts
2. Verify all examples and fixtures are synthetic.
3. Check minimization:
   - store only data needed for cobrança
   - avoid clinical details
   - avoid full webhook payload logging where not needed
4. Check isolation:
   - operational queries must respect `clinicId`
   - no cross-clinic leakage in list or summary endpoints
5. Check logging:
   - no authorization headers
   - no API keys
   - no full sensitive payloads
   - mask identifiers when useful
6. Check AI prompt safety:
   - only minimal synthetic financial context
   - no diagnosis, procedure, notes, or real identifiers

## Output

Produce a short audit with:

- exposed surfaces reviewed
- blockers found
- minimum safe correction
- remaining privacy or isolation risks

## Guardrails

- Treat any real patient data as a release blocker.
- Treat missing `clinicId` scoping on operational data as a high-severity flaw.
- Prefer redaction and minimization over verbose observability.
- If privacy and convenience conflict, choose privacy.
