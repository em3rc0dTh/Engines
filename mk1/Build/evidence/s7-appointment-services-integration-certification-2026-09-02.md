# S7 — Appointment → canonical Services integration certification

Date: 2026-09-02

## Verdict

**S7 APPOINTMENT → CANONICAL SERVICES INTEGRATION — CERTIFIED**

S7 certifies a bounded composition claim: `RegisterNewAppointment` now obtains Service and Offering selection data through the canonical MK1 Services read activities and freezes revision-aware selected Service/Offering semantics in durable Temporal Workflow state. A catalog publication from revision N to N+1 does not silently mutate an already-running Appointment; a new Appointment sees N+1.

S7 does **not** certify G1 final closure, Scheduler, Telegram physical transport, Integration Engine runtime, Agent/MCP, production deployment or production security.

## Authority

```text
Branch           build/mk1-s7-appointment-services-integration
Certified SHA    6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
Workflow         mk1 S7 Appointment Services integration
Run              33668593216
Job              100376325350
Result           SUCCESS
Artifact         9861631780
Artifact name    mk1-s7-appointment-services-33668593216
Artifact bytes   4039
Artifact SHA256  e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a
```

Later documentation commits are indexing only and do not replace `6fc8814...` as the source actually executed by the successful certification run.

## Authority change proven

Before S7, the Appointment activity facade still used the inherited Appointment catalog repository path for Service/Product-shaped selection data.

S7 changes the catalog-selection boundary to:

```text
RegisterNewAppointment Workflow
        ↓
Appointment Activities
        ↓
servicesReadActivities.listServices
servicesReadActivities.listOfferings
        ↓
PostgresServicesRepository
        ↓
canonical Services tables/revisions
```

The existing Appointment-compatible projection remains so channel/rendering contracts do not need to understand the complete Services domain type directly.

Static CI marker:

```text
SERVICES_S7_CANONICAL_ACTIVITY_BOUNDARY_PASS
```

## Revision-aware durable projection

Appointment-compatible Service projection now retains canonical Services semantics including:

```text
businessSlug
description
status
revision
tags
```

Appointment-compatible Offering/Product projection now retains:

```text
businessSlug
status
revision
pricing
priority
tags
requirements
dependencies
eligibilityRuleSet
```

Because the existing Workflow stores the chosen Service/Product objects in durable Workflow state at selection time, these enriched objects are revision-aware selected snapshots rather than live views of mutable catalog head.

## Direct S7 experiment

The successful run executed two Appointments around a real Services catalog publication.

### Appointment A — revision N

The first Appointment selected canonical Car Wash / Basic Clean at revision 1 and observed canonical pricing:

```text
SERVICES_S7_CANONICAL_SELECTION_PASS {
  serviceRevision: 1,
  offeringRevision: 1,
  offeringPricing: { "kind": "QUOTE_REQUIRED" }
}
```

### Publish N+1

Through the certified Services management Workflow, Basic Clean was updated from Offering revision 1 to revision 2. The deliberately changed semantic was pricing only:

```text
N    QUOTE_REQUIRED
N+1  FIXED PEN 3100 minor units
```

Duration was intentionally kept at 30 minutes so the S7 proof does not conflate Services snapshot semantics with future Scheduler duration/capacity semantics.

Marker:

```text
SERVICES_S7_CATALOG_N_PLUS_1_PASS {
  "beforeRevision": 1,
  "publishedRevision": 2
}
```

### Active Appointment remains N

After N+1 publication, Appointment A was queried again and still held Offering revision 1 with `QUOTE_REQUIRED` pricing:

```text
SERVICES_S7_ACTIVE_SNAPSHOT_STILL_N_PASS
```

Appointment A then completed successfully to `CREATED` using its selected revision-N identity/projection:

```text
SERVICES_S7_FIRST_APPOINTMENT_CREATED_PASS
```

### New Appointment sees N+1

Appointment B was started after publication, reused the resolved existing Customer, and selected the same canonical Offering. It observed revision 2 with `FIXED PEN 3100`:

```text
SERVICES_S7_NEW_APPOINTMENT_SEES_N_PLUS_1_PASS
```

Both Appointments completed:

```text
SERVICES_S7_APPOINTMENT_INTEGRATION_PASS {
  "serviceRevision":1,
  "firstOfferingRevision":1,
  "publishedOfferingRevision":2,
  "secondOfferingRevision":2,
  "firstCompleted":true,
  "secondCompleted":true
}
```

## Inherited Appointment regression

The final successful CI intentionally used two pristine laboratories so state created by one proof could not contaminate the other.

Pristine phase 1 executed the complete inherited Appointment certification before S7 mutation data existed:

```text
APPOINTMENT_NEW_CUSTOMER_CHILD_PASS
APPOINTMENT_CATALOG_PASS
APPOINTMENT_PAST_DATE_REJECTED
APPOINTMENT_DATE_AND_SLOTS_PASS
APPOINTMENT_BOOKING_PASS
APPOINTMENT_IDEMPOTENCY_REPLAY_PASS
APPOINTMENT_SLOT_CONFLICT_PASS
MK0_REGISTER_NEW_APPOINTMENT_PASS
```

Then Docker volumes were removed and a second pristine laboratory was started for S6 + S7 composition proof.

This preserves the important distinction:

```text
regression fixture truth
!=
state intentionally created by composition proof
```

## S6 re-certification

After the laboratory reset, the same S7 source re-ran S6 and emitted:

```text
SERVICES_S6_MULTIBUSINESS_PASS
```

Thus the Appointment integration did not destroy the previously certified multi-business Services boundary.

## Static/unit regression surface

The successful run also passed:

- strict TypeScript type-check;
- Services S1 contract tests;
- revision-aware Appointment projection tests;
- deterministic eligibility/recommendation tests;
- S4 management contract tests;
- Customer B1 contract tests;
- CLI B3 adapter tests;
- AttachmentStore B7 tests;
- Appointment date contract tests;
- C0 workflow-view tests;
- C1B idempotency/WebChat adapter tests.

## First S7 run failure provenance

The first S7 run is retained explicitly:

```text
Run              33668304438
Job              100375359804
Source SHA       784bf57439512b69d941d9828f6c5abd5fc06225
Result           FAILURE
Artifact         9861484659
Artifact SHA256  d9f27f3d97639767cfc106d20eb319e1d96c43d1f6a28b94e71a9ed8f9365721
```

Important: the direct S7 integration probe itself passed in that run. The overall job failed because the inherited Appointment certification executed **after** S7 in the same database. Appointment A had legitimately consumed Friday `06:00`; the inherited regression subsequently expected its pristine three-slot fixture and observed only two remaining slots.

This was a certification-harness isolation defect, not a Services/Appointment runtime failure.

The fix was to execute the inherited Appointment certification in a pristine laboratory, remove volumes, start a second pristine laboratory, and then run S6 + S7. No business invariant or runtime behavior was relaxed.

## Scheduler boundary preserved

S7 intentionally does not move slot/capacity/reservation ownership into Services.

Current composition is:

```text
Services
  canonical Service/Offering selection and revision snapshot

Appointment compatibility boundary
  inherited date/slot/final booking behavior

Scheduler
  still future authority for concrete availability, holds,
  resources, capacity, reservation and conflict semantics
```

The strongest allowed S7 claim is therefore **canonical Appointment→Services catalog/snapshot integration**, not Scheduler integration.

## Evidence artifact

The successful artifact contains the executed source SHA and final S7 laboratory evidence including:

```text
git-sha.txt
compose-ps.txt
worker.log
cta.log
postgres-services.txt
postgres-offerings.txt
postgres-appointments.txt
mongo-services-audit.txt
mongo-appointment-audit.txt
```

## Bounded certification claim

The strongest current Services statement is:

> **Services S0–S7 are certified. RegisterNewAppointment now consumes canonical Services reads and retains revision-aware selected Service/Offering semantics in durable Workflow state; active selection remains stable across N→N+1 catalog publication while a new Appointment sees N+1.**

Open:

```text
S8 clean full G1 certification       OPEN / NEXT
G1 Services Engine overall           NOT YET CERTIFIED
G2 Scheduler                         NOT CERTIFIED
Telegram physical transport          NOT CERTIFIED
Integration Engine runtime           NOT CERTIFIED
Agent / MCP                           ABSENT BY DESIGN
Production readiness                 NOT CERTIFIED
```
