# MK1 — Platform Steps 3–4–5 Architecture Brainstorming

## Status

**DESIGN PHASE — NO NEW CERTIFICATION CLAIM**

This document translates the platform architecture diagram into the next concrete Engines design work after C1B.

Current emphasis:

```text
3. Services Engine      PRIMARY DESIGN TARGET
4. Scheduler Engine     PRIMARY DESIGN TARGET
5. Integration Engine   BOUNDARY DESIGN ONLY

C2 Telegram             CONTINUES AS CHANNEL WORK, NOT YET HUMAN-TESTED
```

The Agent / Intelligence Layer remains outside the current phase.

---

## 1. Why Steps 3 and 4 must be separated

The platform needs two different kinds of truth:

```text
Services Engine
"What does this business offer and what does that offering mean?"

Scheduler Engine
"When, where and with which capacity/resources can it actually happen?"
```

Combining those responsibilities would create vertical-specific scheduling logic inside the catalog and make Services impossible to reuse across automotive, veterinary, rentals, workshops, clinics, consulting, etc.

The existing G1 Services design already establishes the right boundary: nominal duration and abstract requirements belong to Services; concrete resources, schedules, capacity and booking conflicts belong to Scheduler.

---

## 2. Target composition

```text
Channel / CTA
    ↓
Temporal Workflow
    ├──────────────→ Services Engine
    │                  ↓
    │          OfferingSnapshot
    │          requirements
    │          nominal duration
    │          pricing descriptor
    │
    └──────────────→ Scheduler Engine
                       ↓
                 availability
                 holds
                 reservations
                 conflicts
```

Neither Services nor Scheduler decides conversational presentation. Telegram, WebChat and future transports remain adapters around the same canonical operations.

---

## 3. Services Engine — intended final responsibility

Services owns business-scoped catalog semantics:

- Service and Offering identity;
- lifecycle;
- descriptions/tags;
- nominal duration;
- pricing descriptor;
- requirements;
- dependencies;
- deterministic eligibility;
- deterministic recommendation;
- revisions and immutable selection snapshots;
- abstract scheduling/resource requirements.

Services does **not** own:

- actual staff records;
- actual rooms/bays/vehicles/equipment;
- opening hours;
- employee shifts;
- holidays;
- concrete slot computation;
- capacity reservation;
- booking conflicts.

A Service may state **what kind of capacity is needed**, but not which concrete person/resource must be assigned.

Example:

```text
Offering: Executive Car Wash
Duration: 30 min
Needs:
  - 1 wash bay capability=WASH_BAY
  - capacity units=1

Scheduler decides:
  Bay 2 is free at 10:30
```

---

## 4. Scheduler Engine — intended responsibility

Scheduler becomes the authority for **resource/time feasibility and reservation lifecycle**.

Core concepts:

```text
Resource
ResourceGroup
Capability
ScheduleTemplate
ScheduleOverride
CapacityPolicy
AvailabilityQuery
SlotCandidate
Hold
Reservation
Assignment
Conflict
```

Scheduler answers three different questions which must not be collapsed:

```text
1. AVAILABILITY
   "What could be booked?"

2. HOLD
   "Temporarily protect this candidate while a Workflow continues."

3. RESERVATION
   "Commit this booking atomically as canonical scheduling truth."
```

Frozen invariant:

> **availability shown != reservation persisted**

A visible slot is advisory. Final confirmation must revalidate capacity atomically.

---

## 5. Service → Scheduler contract

The important design object is not a raw Service row. It is an immutable scheduling requirement derived from a selected Offering snapshot.

Candidate contract:

```ts
type SchedulingDemand = {
  businessSlug: string;
  operationId: string;
  offeringSnapshot: {
    offeringId: string;
    offeringRevision: number;
    serviceId: string;
    serviceRevision: number;
    durationMinutes: number;
  };
  requiredCapabilities: readonly CapabilityDemand[];
  capacityUnits: number;
  buffers?: {
    beforeMinutes?: number;
    afterMinutes?: number;
  };
};
```

The Scheduler consumes this demand. It must not re-read mutable catalog head semantics after the Workflow has already frozen an Offering revision.

This preserves S5 snapshot semantics across the Services → Scheduler boundary.

---

## 6. Resource model direction

Scheduler should avoid hard-coding `staffId` as the universal resource concept.

A schedulable Resource may represent:

```text
person
room
workshop bay
vehicle
machine
equipment
virtual capacity bucket
```

Proposed generic structure:

```ts
type SchedulerResource = {
  resourceId: string;
  businessSlug: string;
  kind: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  capacity: number;
  capabilities: readonly string[];
  timeZone: string;
  revision: number;
};
```

Vertical meaning remains configuration/data, not `if automotive` / `if veterinary` code.

---

## 7. Availability design direction

Availability should be generated from:

```text
resource schedules
+ overrides
+ capability matching
+ duration
+ buffers
+ capacity
+ existing holds/reservations
+ business timezone
+ query window
```

A `SlotCandidate` must be explicit about the interval and Scheduler revision/context that produced it, but it must not imply a persisted reservation.

Candidate:

```ts
type SlotCandidate = {
  startAt: string;
  endAt: string;
  timeZone: string;
  assignmentCandidates: readonly ResourceAssignmentCandidate[];
};
```

The first executable Scheduler gate may use one-resource assignments while keeping the contract extensible to multi-resource demand.

---

## 8. Holds and reservation lifecycle

Proposed scheduling lifecycle:

```text
AVAILABLE
   ↓
optional HOLD
   ↓
CONFIRM
   ↓
RESERVED
   ↓
COMPLETED / CANCELLED
```

A Hold should have an expiry and idempotency identity. Expired holds do not remain capacity truth.

Reservation confirmation must be atomic in PostgreSQL and fail with a typed conflict when the candidate is stale.

Examples:

```text
SLOT_NO_LONGER_AVAILABLE
CAPACITY_CONFLICT
RESOURCE_INACTIVE
HOLD_EXPIRED
RESERVATION_ALREADY_EXISTS
```

---

## 9. Appointment Workflow target shape

The current Appointment lab directly exposes seeded slot behavior. The eventual architecture should become:

```text
RegisterNewAppointment
  ↓
Customer resolution
  ↓
Services Engine
  ↓
selected OfferingSnapshot
  ↓
Scheduler QueryAvailability
  ↓
user selects candidate
  ↓
optional Hold
  ↓
READY_TO_FINALIZE
  ↓
Scheduler ConfirmReservation
  ↓
Appointment business persistence / terminal result
```

The precise ownership of `Appointment` vs `Reservation` must remain explicit:

- Scheduler reservation = time/resource allocation truth.
- Appointment = business transaction/workflow result referencing scheduling allocation.

They may be committed in one transaction boundary or coordinated safely, but one must never silently impersonate the other.

---

## 10. Integration Engine — Step 5 boundary

Integration Engine is **not** another business-logic engine. It exists to communicate with external systems through explicit contracts.

Candidate responsibilities:

```text
payment gateway adapters
ERP / POS / accounting connectors
maps/location providers
email/SMS/notification delivery
external webhooks/events
third-party APIs
provider credential references
inbox/outbox delivery state
retry/circuit/rate-limit mechanics
external identifier mapping
```

Integration Engine does not own:

```text
Customer truth
Services truth
Scheduler truth
Appointment truth
payment business decision truth
workflow policy
```

Temporal remains the orchestration coordinator for business workflows that call external integrations.

---

## 11. Telegram is not Step 5

Telegram conversational ingress remains part of **Step 1 — CTA / Channel Adapter**, even though Telegram is technically an external API.

```text
Telegram user message
→ TelegramAdapter
→ CanonicalChannelEnvelope
→ ChannelExecutionCore
→ Temporal
```

Do not move Telegram into Integration Engine merely because it is third-party.

Future outbound notification delivery *to Telegram* could be implemented behind Integration/Notification ports, but the interactive conversation binding remains a CTA concern.

---

## 12. Near-term design order

```text
A. Finish Services architectural closure for S6–S8
B. Freeze Scheduler domain + authority boundary
C. Design Services → Scheduler immutable demand contract
D. Design Scheduler availability / hold / reservation semantics
E. Replace seeded Appointment slot logic only after Scheduler gates exist
F. Define Integration Engine contract surface without building provider sprawl
G. Continue Telegram adapter design/build independently over certified C1B core
```

No step requires Agent/MCP.
