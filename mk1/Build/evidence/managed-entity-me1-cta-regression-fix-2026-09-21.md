# ME1 — CTA orchestration regression discovered after reconciliation

Date: 2026-09-21

## Symptom

After reconciling ME1 with the current developer baseline, the shared CTA orchestration workflow failed at the runtime certification step even though TypeScript and adapter tests passed.

Observed failure:

~~~text
CTA_POC_TIMEOUT:service
workflowStatus=RUNNING
phase=WAITING_FOR_MANAGED_ENTITY
managedEntity.status=NEEDS_CREATION
nextAction=CREATE_MANAGED_ENTITY
~~~

## Root cause

The historical CTA runtime certification script encoded the pre-ME1 lifecycle:

~~~text
Customer -> Service -> Offering -> Date -> Slot -> Finalize
~~~

ME1 deliberately inserts a required operational-subject gate:

~~~text
Customer
  -> ManagedEntity
  -> Service
  -> Offering
  -> Date
  -> Slot
  -> Finalize
~~~

The production workflow was behaving correctly. The stale certification driver was waiting directly for `WAITING_FOR_SERVICE`, so it timed out while the workflow correctly waited for ManagedEntity creation.

## Fix

`mk1/runtime/scripts/certify-cta-orchestration-poc.ts` now waits for either:

~~~text
WAITING_FOR_MANAGED_ENTITY
or
WAITING_FOR_SERVICE
~~~

When ManagedEntity resolution is required, the probe deterministically:

1. selects an available candidate when the state requires explicit selection and a candidate exists;
2. otherwise creates a deterministic vehicle using `CREATE_MANAGED_ENTITY`;
3. waits for `WAITING_FOR_SERVICE` and continues the unchanged CTA proof.

This keeps the shared CTA certification aligned with the new domain contract instead of weakening the ManagedEntity requirement.

## Why the workflow was not changed

The runtime state proved ME1 was enforcing the intended policy. Bypassing ManagedEntity in the workflow would have hidden a real domain invariant. The correct repair was to update the test/certification driver.

## Reproduction

Run the CTA orchestration GitHub workflow or locally:

~~~bash
cd mk1/runtime
docker compose down -v --remove-orphans || true
docker compose up --build -d postgres mongo temporal migrate worker cta channel-core
docker compose run --rm --no-deps -T \
  -e ENGINES_CHANNEL_URL=http://channel-core:8788 \
  -e POSTGRES_URL=postgresql://engines:engines@postgres:5432/engines_mk0 \
  cta npm run probe:cta:poc
~~~

Required terminal marker after the repair:

~~~text
CTA_ORCHESTRATION_POC_PASS
~~~

## Truth boundary

This repair proves compatibility between the shared CTA certification driver and the ME1 ManagedEntity lifecycle. It does not replace the separate human WebChat ME1 physical gate.
