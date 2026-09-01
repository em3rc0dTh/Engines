# MK1 Runtime

Executable Stage-2 laboratory for Engines. S0 promoted the exact certified MK0 runtime tree into this directory; subsequent gates evolve `mk1/runtime` without modifying the frozen `mk0/runtime` evidence base.

## Current status

```text
Inherited MK0 runtime             ✅ certified baseline
RegisterNewCustomer               ✅ regression protected
AttachmentStore/B7                ✅ regression protected
RegisterNewAppointment            ✅ regression protected
Services S1 contracts/persistence ✅ certified
Services S2 deterministic reads   ✅ certified
Services S3 recommendation        ✅ certified
Services S4 management mutations  ✅ certified
Services S5 durable snapshots     🔧 next
G1 Services Engine                ❌ not yet fully certified
Scheduler Engine                  ❌ not certified
Production deployment             ❌ not certified
```

Canonical MK1 status: [`../README.md`](../README.md)

Services gate plan: [`../Plan/01-services-engine-gates.md`](../Plan/01-services-engine-gates.md)

Test/evidence ledger: [`../Test/g1-services-engine-s0-s4.md`](../Test/g1-services-engine-s0-s4.md)

## Runtime profile

```text
Node.js            >= 20
Certified CI Node  24.19.0
TypeScript         7.0.2
Temporal TS SDK    1.22.0
Temporal CLI       1.8.1 in Compose image
Task Queue         engines-mk0-registration
PostgreSQL         17.8
MongoDB            8.0.29
CTA HTTP           127.0.0.1:8787
Temporal gRPC      localhost:7233
Temporal UI        localhost:8233
```

The inherited package/task-queue names still contain `mk0` because S0 promoted the certified runtime exactly. Renaming those identifiers is a separate compatibility decision and is not required for G1 correctness.

## Runtime structure

```text
src/
├── contracts/
│   ├── register-new-customer/
│   ├── register-new-appointment/
│   └── services-engine/
│       ├── types.ts
│       ├── validation.ts
│       └── management.ts
├── services/
│   ├── appointment-catalog.compat.ts
│   └── eligibility-engine.ts
├── cta/
├── lab-console/
├── observability/
├── orchestration/temporal/
│   ├── activities/
│   ├── clients/
│   ├── workers/
│   └── workflows/
└── persistence/
    ├── attachments/
    ├── mongo/
    │   └── services-audit.repository.ts
    └── postgres/
        ├── services.repository.ts
        ├── services-management.repository.ts
        └── services-management-preflight.repository.ts

migrations/
scripts/
postman/
```

## Install and typecheck

```bash
cd mk1/runtime
npm ci
npm run check
```

Inherited regression surface:

```bash
npm run test:b1
npm run test:b3
npm run test:b7
npm run test:lab-console
npm run test:appointment
```

Services surface:

```bash
npm run test:services:s1
npm run test:services:s2
npm run test:services:s3
npm run test:services:s4
```

## Start the local laboratory

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://127.0.0.1:8787/health
```

For a deliberately clean/destructive certification run:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d
```

Compose dependency chain remains:

```text
PostgreSQL + MongoDB
        ↓
      migrate
        ↓
      Temporal
        ↓
       Worker
        ↓
        CTA
```

The inherited CTA currently advertises the certified operational Customer and Appointment workflows. Services management is certified through direct Temporal execution in the S4 laboratory; a public/admin HTTP management surface has deliberately not been added merely to prove S4.

## Services domain through S4

Canonical entities:

```text
ServiceDefinition
  serviceId / businessSlug
  code / name / description
  status ACTIVE | INACTIVE
  revision
  tags

ServiceOffering
  offeringId / serviceId / businessSlug
  code / name / description
  status / revision
  durationMinutes
  pricing
  priority / tags
  requirements
  dependencies
  eligibilityRuleSet
```

Pricing kinds:

```text
FREE
FIXED
FROM
QUOTE_REQUIRED
```

Eligibility operators:

```text
EXISTS
EQ
IN
GTE
LTE
```

The current rule-set mode remains deterministic `ALL`; arbitrary JavaScript/SQL is not an eligibility rule format.

## S2 — deterministic reads

PostgreSQL-backed operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

List operations are deterministic and lifecycle-aware; explicit identity lookups remain business-scoped and can hydrate historical inactive definitions. Offering projections include pricing, requirements, dependencies and eligibility data.

## S3 — deterministic eligibility/recommendation

Pure Services functions:

```text
evaluateOfferingEligibility
recommendOfferings
```

Recommendation is independent of input ordering and ranks by:

```text
priority DESC
name ASC
offeringId ASC
```

Malformed rules fail closed and no Agent/LLM is part of the decision authority.

## S4 — versioned management

Temporal Workflow:

```text
servicesManagementWorkflow
```

Certified commands:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

Execution boundary:

```text
command
  ↓
Workflow deterministic validation
  ↓
reference-preflight Activity
  ↓
PostgreSQL mutation Activity
  ↓
service_mutation_commands
+ canonical Service/Offering rows
  ↓
Mongo services_mutation_audit Activity
  ↓
terminal outcome
```

### Idempotency

`service_mutation_commands` stores a business-scoped command identity and material fingerprint. Semantics:

```text
same operation + business + idempotency key + same material
→ REPLAYED
→ no second business effect

same logical identity + different material
→ IDEMPOTENCY_CONFLICT
→ no overwrite
```

### Revision control

Versioned updates require `expectedRevision`. Successful update/status commands increment the revision. A stale expected revision returns `REVISION_CONFLICT` instead of last-write-wins.

### Lifecycle

Services and Offerings move through explicit `ACTIVE` / `INACTIVE` state. S4 does not implement destructive delete as lifecycle behavior.

### Reference safety

Create/Update Offering dependency targets are preflighted inside the same business scope before mutation. The S4 safety probe proves a missing dependency returns `NOT_FOUND` with:

```text
partial Offering row     none
mutation command row     none
Mongo terminal audit     present
```

### Audit

Mongo collection:

```text
services_mutation_audit
```

records terminal APPLIED/REPLAYED/REJECTED semantic evidence. PostgreSQL remains canonical catalog truth.

## Services migrations

```text
005_services_engine_contracts.sql
006_services_management.sql
```

`npm run migrate:services` applies both in order.

## Services certification probes

```bash
npm run probe:services:s1
npm run probe:services:s2
npm run probe:services:s3
npm run probe:services:s4
npm run probe:services:s4:safety
```

Final S4 certification:

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Job              99959020329
Artifact         9812703293
Artifact SHA256  275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

## Persistence authority through S4

### PostgreSQL

Canonical business truth includes inherited Customer/Appointment tables plus:

```text
service_catalog
service_products
service_requirements
service_dependencies
service_eligibility_rules
service_mutation_commands
```

### MongoDB

Semantic audit includes:

```text
execution_audit
appointment_audit
services_mutation_audit
```

MongoDB is not canonical Customer/Appointment/Services truth.

### AttachmentStore

The local laboratory continues using the certified filesystem provider. Binary truth does not move into Services tables.

## Current next gate — S5

S5 must start a consumer Workflow, select revision `N`, wait durably, publish `N+1` through the certified S4 management Workflow, prove the waiting Workflow still exposes and uses `N`, and prove a new Workflow sees `N+1`.

## Stop vs reset

Preserve data/history:

```bash
docker compose down
```

Destructive laboratory reset:

```bash
docker compose down -v --remove-orphans
```

## Scope boundary

This runtime is still a Stage-2 local architecture laboratory. S4 does not certify S5 snapshots, S6 generality, S7 final Appointment integration, S8 G1 closure, Scheduler, multi-channel CTA adapters, Agent/Hermes or production deployment.
