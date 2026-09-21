# MK1 Runtime

Executable Stage-2 laboratory for Engines. S0 promoted the certified MK0 runtime into this directory; later gates evolve `mk1/runtime` while frozen `mk0/runtime` remains untouched.

## Current status

```text
Inherited MK0 runtime                 ✅ certified baseline
RegisterNewCustomer                   ✅ regression protected
AttachmentStore/B7                    ✅ regression protected
RegisterNewAppointment                ✅ regression protected
Services S1–S7                        ✅ certified
Services S8                           ⏭ final G1 closure pending
WebChat C0A workflow view             ✅ certified
WebChat C1A visible E2E flow          ✅ certified + human verified
WebChat C1B durable channel           ✅ certified + human restart verified
Telegram local registration          ✅ automated + human verified
WhatsApp local registration          ✅ automated + human verified
C2/C4 local interactive E2E          ✅ human verified
B2 soft-duplicate resolution         ✅ certified
Real Telegram Bot API                ❌ not certified
Real Meta Cloud API / Kapso          ❌ not certified
Scheduler Engine                     ❌ not certified
Agent / MCP                          ❌ intentionally absent
Production deployment                ❌ not certified
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

PostgreSQL remains canonical business truth and durable channel-event authority. Mongo remains semantic/execution audit.

## Services runtime

Canonical Services responsibilities:

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

Versioned management executes through Temporal:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

Reads remain deterministic and business-scoped:

```text
ListServices
GetService
ListOfferings
GetOffering
```

### S7 — Appointment consumes canonical Services

S7 authority:

```text
Source SHA       6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
Run              33668593216
Job              100376325350
Artifact         9861631780
SHA256           e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a
```

S7 proves:

```text
Appointment Service list        canonical Services read path
Appointment Offering list       canonical Services read path
active Appointment snapshot N   remains N after N+1 publication
new Appointment                 sees N+1
inherited Appointment E2E       remains green
Scheduler semantics             not moved into Services
```

Receipt: [`../Build/evidence/s7-appointment-services-integration-certification-2026-09-02.md`](../Build/evidence/s7-appointment-services-integration-certification-2026-09-02.md)

S8 remains the final clean accumulated G1 certification gate.

## Durable channel runtime

Canonical path:

```text
ChannelAdapter
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
same Workflow Library
```

Certified C1B semantics:

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

## Telegram / WhatsApp local messaging laboratory

Human interactive command:

```bash
docker compose run --rm --no-deps messaging-lab
```

The laboratory uses real PostgreSQL + Temporal + `RegisterNewCustomer` without provider credentials.

### Telegram local behavior

```text
initial knownFields   (none)
initial missingFields name + phone + email
phone source          shared-contact-shaped event or typed phone
invalid phone         CHANNEL_EVENT_INVALID
recovery              same Temporal Workflow remains active
terminal              CREATED
```

The user manually verified both normal completion and invalid-phone recovery.

### WhatsApp local behavior

```text
verified sender phone supplied at Workflow start
knownFields   = customer.contact.phone
missingFields = customer.name, customer.contact.email
phone re-prompt absent
terminal      CREATED for unique Customer material
```

The user manually verified the real Temporal path through `CREATED` and `MESSAGING_LOCAL_E2E_PASS`.

C2/C4 automated authority:

```text
Source SHA       bfccd4a795400d2311201a880453b61b08d0b56a
Run              33896424897
Job              101100019937
Artifact         9945929946
SHA256           92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e
```

Human receipt:
[`../Test/c2-c4-local-interactive-human-verification-2026-09-04.md`](../Test/c2-c4-local-interactive-human-verification-2026-09-04.md)

## B2 — Customer soft-duplicate resolution

A soft match now projects a deterministic shared action:

```text
WAITING_FOR_DUPLICATE_DECISION
nextAction = RESOLVE_DUPLICATE
        ↓
RESOLVE_CUSTOMER_DUPLICATE
  ├── USE_EXISTING
  └── CREATE_NEW
```

The channel does not decide duplicate truth. Candidate membership remains Temporal/Customer authority.

B2 authority:

```text
Source SHA       36afff68af3237bd6431fd643d7d969e5452a296
Run              33899907141
Job              101111281727
Artifact         9947248334
SHA256           2c02680d9e268957924303ab1113d71f0d872319b611a6ede3faca0a01ed678a
```

Expected direct probe markers:

```text
CUSTOMER_B2_INVALID_CANDIDATE_REJECTED_PASS
CUSTOMER_B2_DUPLICATE_DECISION_REPLAY_PASS
CUSTOMER_B2_USE_EXISTING_PASS
CUSTOMER_B2_CREATE_NEW_PASS
CUSTOMER_B2_SOFT_DUPLICATE_RESOLUTION_PASS
```

Receipt: [`../Build/evidence/b2-customer-soft-duplicate-resolution-certification-2026-09-04.md`](../Build/evidence/b2-customer-soft-duplicate-resolution-certification-2026-09-04.md)

The final human WhatsApp run used unique material and therefore did not separately show the duplicate-decision UI. That optional UI observation is not required for the certified B2 runtime claim or the closed C2/C4 local human gate.

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
local provider-shaped proof != external-provider certification
```

## Current next gates

```text
Channel   real Telegram Bot API proof
Services  S8 final clean G1 certification
Then      Scheduler runtime build gates
Later     real WhatsApp provider proof
Last      Agent / MCP
```
