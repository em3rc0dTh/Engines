# S7 — Appointment → canonical Services integration gate

Date: 2026-09-02

## Status

**✅ CERTIFIED**

```text
Branch           build/mk1-s7-appointment-services-integration
Certified SHA    6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
Run              33668593216
Job              100376325350
Artifact         9861631780
SHA256           e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a
```

Receipt: [`../Build/evidence/s7-appointment-services-integration-certification-2026-09-02.md`](../Build/evidence/s7-appointment-services-integration-certification-2026-09-02.md)

## Purpose

S7 removes the remaining catalog-authority ambiguity between the inherited MK0 Appointment compatibility path and the standalone MK1 Services Engine.

`RegisterNewAppointment` now obtains Service/Offering selections from canonical Services reads and freezes revision-aware selected semantics into durable Workflow state while preserving the inherited date/slot/finalization behavior until Scheduler assumes that authority in Step 4.

## Certified flow

```text
RegisterNewAppointment
        ↓
Customer resolution
        ↓
Services.ListServices
        ↓
select canonical Service revision N
        ↓
Services.ListOfferings
        ↓
select canonical Offering revision N
        ↓
freeze revision-aware selection in Workflow state
        ↓
existing date / availability compatibility boundary
        ↓
slot selection
        ↓
explicit finalize
        ↓
inherited atomic Appointment persistence
```

## Authority boundary

Services owns:

```text
Service identity/revision
Offering identity/revision
name/description/tags
price semantics
duration
requirements
dependencies
eligibility metadata
selected immutable semantics
```

S7 does **not** authorize Services to own:

```text
staff/resource assignment
concrete schedule templates
capacity
availability conflict truth
holds
reservations
resource assignments
```

Those remain Step 4 Scheduler responsibilities.

## Durable selected projection

The existing renderer-compatible state objects remain:

```text
selectedService
selectedProduct
```

but now carry canonical Services fields. Service selection retains business scope/status/revision/tags; Offering selection retains business scope/status/revision/pricing/requirements/dependencies/eligibility metadata in addition to existing Appointment-compatible fields.

Because the objects are copied into Workflow state at selection, mutable catalog head cannot silently replace the chosen revision.

## Certified N → N+1 experiment

```text
Appointment A selects Basic Clean revision 1
  pricing = QUOTE_REQUIRED
        ↓
Services management publishes revision 2
  pricing = FIXED PEN 3100
        ↓
Appointment A queried again
  still revision 1 / QUOTE_REQUIRED
        ↓
Appointment A completes to CREATED
        ↓
Appointment B starts after publication
  sees revision 2 / FIXED PEN 3100
        ↓
Appointment B completes to CREATED
```

Markers:

```text
SERVICES_S7_CANONICAL_ACTIVITY_BOUNDARY_PASS
SERVICES_S7_CANONICAL_SELECTION_PASS
SERVICES_S7_CATALOG_N_PLUS_1_PASS
SERVICES_S7_ACTIVE_SNAPSHOT_STILL_N_PASS
SERVICES_S7_FIRST_APPOINTMENT_CREATED_PASS
SERVICES_S7_NEW_APPOINTMENT_SEES_N_PLUS_1_PASS
SERVICES_S7_APPOINTMENT_INTEGRATION_PASS
```

S6 was also re-run successfully after a clean reset:

```text
SERVICES_S6_MULTIBUSINESS_PASS
```

## Appointment regression

The successful S7 workflow deliberately uses two pristine Docker/DB laboratories:

```text
pristine lab A
  → inherited full Appointment certification
  → destroy volumes

pristine lab B
  → S6 re-proof
  → S7 N→N+1 composition proof
```

Inherited markers all pass:

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

## First-run provenance

The first CI attempt is retained:

```text
Run              33668304438
Job              100375359804
Source           784bf57439512b69d941d9828f6c5abd5fc06225
Result           FAILURE
Artifact         9861484659
SHA256           d9f27f3d97639767cfc106d20eb319e1d96c43d1f6a28b94e71a9ed8f9365721
```

The S7 probe itself passed. The job later failed because S7 had legitimately consumed a Friday slot before the inherited regression expected a pristine three-slot fixture. The certification harness was corrected to isolate the two proof phases with a full volume reset. No runtime/business rule was relaxed.

## Golden cases — result

```text
S7-CAT-001  canonical Service read path                         PASS
S7-CAT-002  canonical Offering read path                       PASS
S7-REV-001  selected revision semantics recorded               PASS
S7-REV-002  active selection survives N → N+1                 PASS
S7-REV-003  new Appointment sees N+1                           PASS
S7-CMP-001  compatibility projections remain correct           PASS
S7-CMP-002  inherited Appointment E2E                           PASS
S7-CMP-003  exact replay                                       PASS
S7-CMP-004  same-slot race one winner                          PASS
S7-BND-001  Scheduler authority not introduced into Services   PASS
S7-BND-002  no channel-specific Services policy                PASS
```

## Verdict boundary

Allowed statement:

> **S7 Appointment → canonical Services integration is certified.**

Still open:

```text
S8 full clean G1 closure    NEXT
G1 Services overall         not yet certified until S8
Scheduler                   not certified
Telegram physical           not certified
Integration runtime         not certified
Agent / MCP                  absent
production                   not certified
```
