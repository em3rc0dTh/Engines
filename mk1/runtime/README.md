# MK1 Runtime

Executable Stage-2 laboratory for Engines. This runtime was promoted from the exact certified MK0 runtime tree at S0 and is being evolved gate-by-gate for MK1 without modifying `mk0/runtime`.

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
Task Queue         engines-mk0-registration   # inherited topology name
PostgreSQL         17.8
MongoDB            8.0.29
Web framework      none
CTA HTTP           127.0.0.1:8787
Temporal gRPC      localhost:7233
Temporal UI        localhost:8233
```

The historical package/task-queue names still contain `mk0` because S0 promoted the certified runtime exactly. They are not evidence that this directory is still the MK0 source tree; renaming inherited runtime identity is a separate compatibility decision and is not required for S0–S3 certification.

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
│   ├── cli/
│   └── http/
├── lab-console/
├── observability/
├── orchestration/temporal/
│   ├── activities/
│   ├── clients/
│   ├── ports/
│   ├── workers/
│   └── workflows/
└── persistence/
    ├── attachments/
    ├── mongo/
    └── postgres/

migrations/
scripts/
postman/
```

## Install and typecheck

From WSL/Linux:

```bash
cd mk1/runtime
npm ci
npm run check
```

## Fast regression surface

Inherited foundation:

```bash
npm run test:b1
npm run test:b3
npm run test:b7
npm run test:lab-console
npm run test:appointment
```

Services gates:

```bash
npm run test:services:s1
npm run test:services:s2
npm run test:services:s3
```

S3's script intentionally includes both compatibility and eligibility/recommendation tests under the current `src/services/*.test.ts` surface.

## Start the complete local laboratory

```bash
docker compose down -v --remove-orphans   # only when a clean/destructive run is intended
docker compose up --build -d
docker compose ps
```

Compose dependency chain:

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

Health:

```bash
curl -fsS http://127.0.0.1:8787/health
```

The inherited CTA still advertises the certified operational workflows:

```text
RegisterNewCustomer
RegisterNewAppointment
```

Services S1–S3 are currently exercised by domain tests and certification probes. S4 is the gate that introduces versioned management mutation workflows; do not infer those operations from S1–S3.

## Services Engine domain boundary through S3

Canonical domain:

```text
ServiceDefinition
  serviceId
  businessSlug
  code / name / description
  status ACTIVE | INACTIVE
  revision
  tags

ServiceOffering
  offeringId
  serviceId / businessSlug
  code / name / description
  status
  revision
  durationMinutes
  pricing
  priority
  tags
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

Eligibility operators currently supported by the deterministic contract:

```text
EXISTS
EQ
IN
GTE
LTE
```

The current rule-set mode is deliberately constrained to deterministic `ALL`. Arbitrary JavaScript/SQL rules are not accepted.

## S2 — read engine

PostgreSQL-backed Services repository supports:

```text
ListServices
GetService
ListOfferings
GetOffering
```

Important behavior:

```text
new-selection lists -> ACTIVE definitions only
explicit identity lookup -> may retrieve INACTIVE historical definitions
all reads -> business scoped
service order -> name ASC, id ASC
offering order -> priority DESC, name ASC, id ASC
```

The compatibility layer projects generic `ServiceDefinition` / `ServiceOffering` values into the inherited Appointment catalog types without transferring Scheduler logic into Services.

A `ServiceOfferingSnapshot` captures both Service and Offering revisions for later durable-snapshot work.

## S3 — deterministic eligibility and recommendation

Pure evaluator operations:

```text
evaluateOfferingEligibility
ecommendOfferings
```

The executable function name is `recommendOfferings`.

Evaluation inputs are canonical facts plus explicit satisfied-requirement and selected-offering identities. The evaluator does not call an Agent or LLM.

Certified ranking:

```text
priority DESC
name ASC
offeringId ASC
```

Certified fail-closed behavior includes:

- inactive Offerings;
- malformed eligibility rules;
- unsatisfied required requirements;
- missing `REQUIRES` dependencies;
- present `EXCLUDES` dependencies.

## Persistence

### PostgreSQL — canonical business truth

Inherited + Services tables include:

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

### MongoDB — execution/audit context

```text
execution_audit
appointment_audit
```

MongoDB is not canonical Customer, Appointment or Services catalog truth.

### AttachmentStore

The laboratory uses the shared filesystem volume under `/data/attachments` with staged ingress, content-addressed committed objects and SHA-256 integrity.

## Current migrations

```text
001_b5_registration_customer.sql
002_b6_registration_finalization.sql
003_b7_customer_attachment_refs.sql
004_appointment_catalog_and_booking.sql
005_services_engine_contracts.sql
```

Compose executes all current migrations before Worker startup.

## Services certification probes

```bash
npm run probe:services:s1
npm run probe:services:s2
npm run probe:services:s3
```

Expected successful markers by gate:

```text
SERVICES_S1_PERSISTENCE_PASS
SERVICES_S2_READ_ENGINE_PASS
SERVICES_S3_RECOMMENDATION_PASS
```

These probes do not replace the full GitHub Actions gate, which also runs strict typecheck, regression tests, clean Compose and inherited Appointment certification.

## Interactive inherited laboratories

Customer:

```bash
npm run lab:console
```

Appointment:

```bash
npm run lab:appointment
```

These remain useful regression surfaces but do not by themselves certify new Services gates.

## Stop vs reset

Preserve data/history:

```bash
docker compose down
```

Destructive laboratory reset:

```bash
docker compose down -v --remove-orphans
```

Do not use the destructive reset casually when a physical/manual run is still useful as evidence.

## Current scope boundary

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

The next executable boundary is S4, not a manual end-user test.
