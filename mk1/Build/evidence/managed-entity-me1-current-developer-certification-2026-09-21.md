# ME1 — current-developer reconciliation certification

Date: 2026-09-21

## Candidate

~~~text
branch: feature/managed-entity-resolution-policy
candidate SHA: d6cdd3a26f240a0f1191f2a4dded14aabb80bb8f
base: developer
behind developer: 0
~~~

## Why this recertification was required

ME1 was originally built before the current consolidated CTA/Meta baseline. Reconciling the branch onto modern `developer` exposed two stale assumptions in the shared CTA certification driver:

1. the pre-ME1 driver skipped the new required ManagedEntity lifecycle gate;
2. the compensation-only fixture inserted a ManagedEntity without the new required `display_name`.

Neither issue required weakening the production workflow or schema. Both were repaired in the certification driver so the probe now obeys the same ME1 invariants as production.

Detailed receipt:

~~~text
mk1/Build/evidence/managed-entity-me1-cta-regression-fix-2026-09-21.md
~~~

## Exact-head CI

All channel/runtime workflows triggered from the same candidate SHA completed successfully.

### ME1 Managed Entity Resolution

~~~text
run: 35656172152
artifact: mk1-me1-managed-entity-35656172152
artifact id: 10664920864
digest: sha256:3eaa368ae397a0887020d56a4f00c745d029f04c058d4515f8b0932e0212b064
result: PASS
~~~

Proves TypeScript, ManagedEntity policy/Appointment contracts, WebChat/channel regressions, deterministic physical fixture preparation, ManagedEntity persistence semantics and the real local WebChat runtime surface.

### Shared CTA -> Temporal -> persistence

~~~text
run: 35656172040
artifact: cta-orchestration-poc-35656172040
artifact id: 10663719181
digest: sha256:270fd0ba0258938cf8106baeb68af61220300238bf68f0bc6d1cb6170af646d9
result: PASS
~~~

The same candidate passed the baseline CTA graph and the signed Facebook Comment canonical CTA -> Temporal proof after the ME1 lifecycle/schema reconciliation.

### Provider regressions

~~~text
Telegram
run: 35656172052
artifact: mk1-c2-telegram-official-35656172052
digest: sha256:f933ef4c61d0154a0a1561a87d034bcd4d83c86e0ec206601ebec6bf26154531
PASS

WhatsApp / Kapso
run: 35656172130
artifact: mk1-c4p-kapso-35656172130
digest: sha256:4988c2d04d1125463dabb9aab1d72e9fdbb6e224795e47a3ce0d9309c8046288
PASS

WhatsApp / Meta Cloud API
run: 35656172059
artifact: mk1-c4p-whatsapp-cloud-api-35656172059
digest: sha256:a01a8179fcb9e5c0f56a4d96305d847a7917d705ba534bcf7f6433bd2f9b1a4e
PASS
~~~

## Current acceptance boundary

Automated reconciliation is green.

Still required before ME-SEAL / merge:

~~~text
human physical WebChat Case A
human physical WebChat Case B
human physical WebChat Case C
Case A persisted Renault Logan Car Wash verification
verify:me1:physical PASS
preserved physical evidence
~~~

Runbook:

~~~text
mk1/Test/MANAGED_ENTITY_ME1_PHYSICAL_RUNBOOK_2026-09-14.md
~~~

No Agent, MCP or LLM capability is claimed by this certification.
