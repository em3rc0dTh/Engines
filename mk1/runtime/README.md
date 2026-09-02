# MK1 Runtime

Executable Stage-2 laboratory for Engines. S0 promoted the certified MK0 runtime into this directory; later gates evolve `mk1/runtime` while frozen `mk0/runtime` remains untouched.

## Current status

```text
Inherited MK0 runtime                 ✅ certified baseline
RegisterNewCustomer                   ✅ regression protected
AttachmentStore/B7                    ✅ regression protected
RegisterNewAppointment                ✅ regression protected
Services S1–S6                        ✅ certified
WebChat C0A workflow view             ✅ certified
WebChat C1A visible E2E flow          ✅ certified + human verified
WebChat C1B durable channel           ✅ certified + human restart verified
Services S7                           🔧 next Services gate
Telegram C2 runtime                   ❌ physical proof deferred
Scheduler Engine                      ❌ not certified
Agent / MCP                           ❌ intentionally absent
Production deployment                 ❌ not certified
```

Canonical status: [`../README.md`](../README.md)

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
Channel Core       127.0.0.1:8788
WebChat            127.0.0.1:8790
Temporal gRPC      localhost:7233
Temporal UI        localhost:8233
```

Inherited package/task-queue names still contain `mk0` because S0 promoted the certified runtime exactly. Renaming is a separate compatibility decision.

## Install and static verification

```bash
cd mk1/runtime
npm ci
npm run check
```

Frozen/inherited regression:

```bash
npm run test:b1
npm run test:b3
npm run test:b7
npm run test:lab-console
npm run test:appointment
```

Services regression:

```bash
npm run test:services:s1
npm run test:services:s2
npm run test:services:s3
npm run test:services:s4
```

Channel regression:

```bash
npm run test:channel:c0
npm run test:channel:c1b
```

## Start local laboratory

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1:8788/health
```

Destructive clean run:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d
```

Dependency shape:

```text
PostgreSQL + MongoDB
        ↓
      migrate
        ↓
      Temporal
        ↓
       Worker
      ↙     ↘
    CTA    Channel Core
```

Current migrations include inherited Customer/Appointment data plus Services management and durable channel correlation. PostgreSQL remains canonical business truth; Mongo remains semantic/execution audit.

## Services runtime

### Canonical responsibilities

```text
Service
Offering
pricing
requirements
dependencies
eligibility
recommendation
revision/lifecycle
immutable Service/Offering snapshots for Workflow consumers
```

Services does **not** own concrete resources, staff calendars, slot capacity, holds, reservations or conflicts. Those belong to Scheduler.

### Services commands

Versioned management executes through Temporal:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

Flow:

```text
caller
  ↓
servicesManagementWorkflow
  ↓
command validation
  ↓
reference preflight Activity
  ↓
PostgreSQL mutation Activity
  ↓
service_mutation_commands + catalog truth
  ↓
Mongo services_mutation_audit
  ↓
terminal outcome
```

Reads remain deterministic and business-scoped:

```text
ListServices
GetService
ListOfferings
GetOffering
```

### Services S6 — certified multi-business generality

Run locally inside a healthy Compose laboratory:

```bash
docker compose exec -T worker npm run probe:services:s6
```

Certification authority:

```text
Source SHA       3eed68b45036154bcf1776564f479cd02e30d0d4
Run              33666790884
Job              100370414068
Artifact         9860927146
SHA256           543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564
```

Expected marker:

```text
SERVICES_S6_MULTIBUSINESS_PASS
```

The probe creates materially different automotive and veterinary Service/Offering data through the same Temporal Workflow and proves:

```text
same Service code across businesses       PASS
same Offering code across businesses      PASS
business-scoped reads                     PASS
business-scoped idempotency               PASS
exact replay                              PASS
cross-business dependency rejection       PASS
no partial invalid Offering               PASS
deterministic eligibility                 PASS
Mongo audit coverage                      PASS
```

The CI also emits:

```text
SERVICES_S6_NO_VERTICAL_FIXTURE_BRANCHING_PASS
```

which ensures S6 fixture business identities are absent from runtime implementation TypeScript files.

S6 receipt: [`../Build/evidence/s6-services-multibusiness-certification-2026-09-02.md`](../Build/evidence/s6-services-multibusiness-certification-2026-09-02.md)

S6 verification: [`../Test/g1-services-engine-s0-s6.md`](../Test/g1-services-engine-s0-s6.md)

## Current Appointment boundary

At S6, the inherited Appointment E2E still passes, including:

```text
existing/new Customer resolution
Service/Product selection
human date normalization
slot loading
explicit finalization
exact Workflow replay
atomic same-slot race
```

But this is still compatibility/regression evidence. S7 is responsible for making Appointment consume the canonical Services read/snapshot contract directly.

S7 target:

```text
RegisterNewAppointment
  ↓
canonical Services reads
  ↓
selected revision-aware Service/Offering snapshot
  ↓
existing date/slot/finalize compatibility path
```

Scheduler is not implemented inside S7.

## Durable channel runtime

C1B path:

```text
WebChatAdapter
      ↓
CanonicalChannelEnvelope
      ↓
ChannelExecutionCore
      ↓
PostgreSQL
  channel_conversation_bindings
  channel_inbound_events
      ↓
Temporal
      ↓
RegisterNewAppointment
```

Certified semantics:

```text
same event identity + same material       exact replay
same event identity + different material  conflict / no mutation
WebChat adapter restart                    same durable Workflow recovery
```

C1B authority:

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Artifact         9853555059
SHA256           efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

WebChat manual start:

```bash
npm run webchat:server
```

Open:

```text
http://127.0.0.1:8790/webchat/
```

The inspector remains:

```text
/webchat/workflow.html?workflowId=<workflowId>
```

## Scheduler / Integration / Agent boundaries

```text
Scheduler
  designed, not certified
  concrete resources/schedules/capacity/availability/holds/reservations/conflicts

Integration
  designed provider boundary only
  no certified payment/ERP/notification provider runtime yet

Agent / MCP
  intentionally absent
```

## Evidence discipline

```text
runtime source SHA != later docs SHA
regression pass != new integration certification
Services != Scheduler
availability shown != reservation persisted
browser/process memory != durable channel authority
provider-specific code != business policy
```

## Current next branch

After S6 documentation closure, the next bounded build branch is:

```text
build/mk1-s7-appointment-services-integration
```

Its job is canonical Appointment→Services consumption, not Scheduler implementation.
