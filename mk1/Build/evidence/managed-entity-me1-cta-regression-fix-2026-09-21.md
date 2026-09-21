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


## Second reconciliation regression — compensation fixture schema drift

After the lifecycle repair above, the exact-head CTA workflow advanced further and exposed a second stale assumption in the certification-only compensation fixture.

Observed failure:

~~~text
null value in column "display_name" of relation "managed_entities" violates not-null constraint
~~~

The ME1 migration intentionally upgrades `managed_entities.display_name` to `NOT NULL`. The production ManagedEntity repository already satisfies that contract, but the historical failure/compensation probe inserted a fixture row directly with the pre-ME1 column set:

~~~text
managed_entity_id
business_slug
customer_id
entity_type
external_ref
~~~

The fixture was therefore invalid against the reconciled schema.

### Repair

The CTA compensation probe now writes an explicit deterministic `display_name` for its synthetic `COMPENSATION_FIXTURE` row.

This is a certification-driver repair only. No production ManagedEntity invariant was relaxed and no migration was weakened.

Repair commit:

~~~text
27ebf8ec4c568c40fdb28bbf5a58936dcf17ec2d
~~~

The exact-head workflows were automatically re-triggered from that commit. Final acceptance still requires the CTA orchestration workflow and ME1 workflow to both return green on the same branch head.
