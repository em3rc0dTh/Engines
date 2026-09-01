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
Services S4 management mutations  🔧 next
G1 Services Engine                ❌ not yet fully certified
Scheduler Engine                  ❌ not certified
Production deployment             ❌ not certified
```

Canonical MK1 status: [`../README.md`](../README.md)

Services gate plan: [`../Plan/01-services-engine-gates.md`](../Plan/01-services-engine-gates.md)

Test/evidence ledger: [`../Test/g1-services-engine-s0-s3.md`](../Test/g1-services-engine-s0-s3.md)

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

The inherited package/task-queue names still contain `mk0` because S0 promoted the certified runtime exactly. Renaming those identifiers is a separate compatibility decision and is not required for S0–S3 certification.

## Runtime structure

```text
src/
├── contracts/
│   ├── register-new-customer/
│   ├── register-new-appointment/
│   └── services-engine/
├── services/
│   ├── appointment-catalog.compat.ts
│   └── eligibility-engine.ts
├── cta/
├── lab-console/
├── observability/
├── orchestration/temporal/
└── persistence/

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

The inherited CTA currently advertises the certified operational workflows `RegisterNewCustomer` and `RegisterNewAppointment`. Services S1–S3 are exercised by domain tests and certification probes. S4 is the gate that introduces versioned Services management workflows; do not infer them from S1–S3.

## Services domain through S3

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

The current rule-set mode is deliberately constrained to deterministic `ALL`. Arbitrary executable JavaScript or SQL is not an eligibility rule format.

## S2 — deterministic reads

PostgreSQL-backed operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

Certified behavior:

```text
new-selection lists -> ACTIVE definitions only
explicit lookup     -> may retrieve INACTIVE historical identity
all reads           -> business scoped
Service order       -> name ASC, id ASC
Offering order      -> priority DESC, name ASC, id ASC
```

The compatibility layer projects generic `ServiceDefinition` / `ServiceOffering` values into inherited Appointment catalog types without moving Scheduler logic into Services.

`ServiceOfferingSnapshot` captures both Service and Offering revisions for later durable-snapshot certification.

## S3 — deterministic eligibility/recommendation

Pure operations:

```text
evaluateOfferingEligibility
recommendOfferings
```

Evaluation consumes canonical facts plus explicit satisfied-requirement and selected-offering identities. It does not call an Agent or LLM.

Certified rank:

```text
priority DESC
name ASC
offeringId ASC
```

Certified fail-closed behavior covers inactive Offerings, malformed rules, unsatisfied required requirements, missing `REQUIRES` dependencies and present `EXCLUDES` dependencies.

## Persistence

PostgreSQL remains canonical business truth. Current inherited + Services tables include:

```text
customers
customer_contacts
customer_phones
customer_documents
registration_commands
customer_attachment_refs
service_catalog
service_products
service_availability_rules
service_requirements
service_dependencies
service_eligibility_rules
appointment_commands
appointments
```

MongoDB remains execution/audit context (`execution_audit`, `appointment_audit`), not canonical Customer, Appointment or Services catalog truth.

AttachmentStore remains the shared filesystem laboratory implementation with staged ingress, content-addressed committed objects and SHA-256 integrity.

## Current migrations

```text
001_b5_registration_customer.sql
002_b6_registration_finalization.sql
003_b7_customer_attachment_refs.sql
004_appointment_catalog_and_booking.sql
005_services_engine_contracts.sql
```

## Services certification probes

```bash
npm run probe:services:s1
npm run probe:services:s2
npm run probe:services:s3
```

Expected success markers:

```text
SERVICES_S1_PERSISTENCE_PASS
SERVICES_S2_READ_ENGINE_PASS
SERVICES_S3_RECOMMENDATION_PASS
```

A probe alone is not the full gate. GitHub Actions also executes strict typecheck, regression tests, clean Compose and inherited Appointment certification.

## Interactive inherited laboratories

```bash
npm run lab:console
npm run lab:appointment
```

These remain useful regression/manual surfaces but do not independently certify a new Services gate.

## Scope boundary

S0–S3 do **not** certify:

```text
Create/Update/Status Services management workflows
mutation idempotency and optimistic revision conflicts
running-Workflow snapshot isolation across catalog revisions
full multi-business material generality gate
final Appointment-to-G1 Services integration
Scheduler Engine
Agent/LLM authority
production deployment / public exposure
```

The next executable boundary is S4, not an end-user manual test.
