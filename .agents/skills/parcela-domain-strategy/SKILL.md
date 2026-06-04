---
name: parcela-domain-strategy
description: Plan and constrain domain changes for Parcela Mais before editing entities, value objects, enums, or domain services. Trigger when a task changes business rules, invariants, status derivation, aggregate boundaries, clinic isolation, or rule ownership between entity and service.
---

# Parcela Domain Strategy

Use this skill before changing domain code.

## Read first

Read only the files needed for the current bounded context:

- `PARCELA_MAIS_CHALLENGE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/PAYMENT_RULES.md` when payment state or idempotency is involved
- `docs/COMMUNICATION_RULES.md` when collection logic is involved
- `docs/DATA_PRIVACY.md` when payloads, logs, prompts, or clinic isolation are involved

Then inspect only the affected source files and existing tests.

## Workflow

1. Identify the rule being changed and the public behavior it affects.
2. Decide the canonical rule owner:
   - entity for invariant and state transition logic
   - value object for constrained calculations or representation rules
   - domain service for cross-entity policy or orchestration without persistence concerns
   - application service for transactional flow and repository coordination
3. List invariants that must remain true after the change.
4. Check whether docs and code disagree. If they do, surface the mismatch before implementation.
5. Define the smallest public API change that keeps the model explicit.
6. Define mandatory unit tests and regression scenarios before editing.

## Output

Produce a compact implementation brief with:

- canonical owner of the rule
- affected invariants
- required API or type changes
- required tests
- mismatches or risks that must be resolved

## Guardrails

- Do not duplicate business rules across entity and service unless the task explicitly accepts temporary duplication.
- Prefer explicit domain terminology already established in `docs/DOMAIN_MODEL.md`.
- Treat `clinicId` isolation and synthetic-data constraints as domain-adjacent requirements, not optional details.
