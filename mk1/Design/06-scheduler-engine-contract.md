# G2 — Scheduler Engine Contract

## Status

**DESIGN CANDIDATE — PRE-BUILD**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle.

## 1. Responsibility

> **Given one immutable scheduling demand, determine feasible time/resource allocations and commit/release them safely under concurrency.**

Scheduler owns:

```text
resources
resource capabilities
schedule templates
schedule overrides
capacity
availability generation
holds
reservations
assignments
booking conflicts
reservation lifecycle
```

Scheduler does not own:

```text
Service/Offering commercial semantics
Customer profiles
Appointment conversation state
channel/provider rendering
payment execution
external provider integrations
```

## 2. Core domain

### 2.1 Resource

```ts
type SchedulerResource = Readonly<{
  resourceId: string;
  businessSlug: string;
  code: string;
  kind: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  timeZone: string;
  capacity: number;
  capabilities: readonly ResourceCapability[];
  revision: number;
}>;

type ResourceCapability = Readonly<{
  code: string;
  capacityUnits?: number;
  metadata?: Readonly<Record<string, unknown>>;
}>;
```

Examples of resource `kind` are data, not branches: `PERSON`, `ROOM`, `BAY`, `VEHICLE`, `MACHINE`, `POOL`.

### 2.2 Schedule template

```ts
type ScheduleTemplate = Readonly<{
  scheduleId: string;
  businessSlug: string;
  resourceId: string;
  timeZone: string;
  weeklyWindows: readonly WeeklyAvailabilityWindow[];
  revision: number;
}>;
```

A weekly window expresses recurring working availability, not bookings.

### 2.3 Schedule override

```ts
type ScheduleOverride = Readonly<{
  overrideId: string;
  businessSlug: string;
  resourceId: string;
  startAt: string;
  endAt: string;
  kind: 'AVAILABLE' | 'UNAVAILABLE' | 'CAPACITY';
  capacity?: number;
  reasonCode?: string;
  revision: number;
}>;
```

Overrides support holidays, leave, maintenance, exceptional opening, temporary capacity changes, etc.

### 2.4 Hold

```ts
type SchedulerHold = Readonly<{
  holdId: string;
  businessSlug: string;
  demandId: string;
  startAt: string;
  endAt: string;
  assignments: readonly ResourceAssignment[];
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'RELEASED' | 'CONSUMED';
}>;
```

### 2.5 Reservation

```ts
type SchedulerReservation = Readonly<{
  reservationId: string;
  businessSlug: string;
  demandId: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  assignments: readonly ResourceAssignment[];
  status: 'RESERVED' | 'CANCELLED' | 'COMPLETED';
  revision: number;
  createdAt: string;
  updatedAt: string;
}>;
```

## 3. Availability calculation

Availability is a pure read over current scheduling truth plus immutable demand.

Inputs:

```text
SchedulingDemand
query window
timezone
resource capability constraints
resource status
weekly schedule
schedule overrides
active holds
active reservations
buffers
capacity
```

Output is a deterministic ordered list of `SlotCandidate` values.

Default stable ordering:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

No randomness is required in G2 baseline.

## 4. Time semantics

All persisted instants use unambiguous timestamp-with-offset/UTC representations. Business and resource time zones are explicit IANA-style identifiers.

Rules:

- no server-local implicit timezone;
- daylight-saving transitions must not be silently flattened;
- human date parsing remains a CTA/domain adapter concern before Scheduler query;
- Scheduler receives canonical instants/windows.

## 5. Granularity

The first Scheduler implementation may use configurable slot granularity, e.g. 15 or 30 minutes, but the contract must not assume that Offering duration equals granularity.

Example:

```text
granularity 15m
offering duration 45m
candidate start 10:15
candidate end   11:00
```

## 6. Buffers

Demand may include pre/post buffers. Buffers consume scheduling capacity even when the customer-visible service interval excludes them.

```text
resource occupancy = bufferBefore + service duration + bufferAfter
```

The reservation should retain enough data to reconstruct the occupied interval and customer-visible interval if they differ.

## 7. Capacity model

Each Resource has positive integer capacity. Each assignment consumes positive units.

Baseline rule:

```text
sum(active reservation units + active hold units + requested units)
<= effective capacity for the interval
```

Effective capacity can be modified by an override.

## 8. Capability matching

A Resource satisfies a `CapabilityDemand` only when required capability code/kind constraints match deterministically.

No fuzzy matching, LLM inference or provider-specific business logic exists in this path.

## 9. Assignment scope

G2 baseline should certify one-resource demand first, but persistence/contracts should support multiple resource assignments because real businesses commonly require combinations such as:

```text
veterinarian + room
technician + workshop bay
vehicle + driver
machine + operator
```

Multi-resource search/optimization may be a later Scheduler gate; it must not force a schema rewrite.

## 10. Mutation commands

Minimum management operations:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
AddScheduleOverride
UpdateScheduleOverride
RemoveScheduleOverride
```

Minimum allocation operations:

```text
CreateHold
ReleaseHold
ConfirmReservation
CancelReservation
CompleteReservation
```

All mutations are business-scoped, idempotent and revision-aware where mutable existing state is changed.

## 11. Atomic reservation confirmation

`ConfirmReservation` is the critical correctness boundary.

Required transaction behavior:

```text
BEGIN
  lock/revalidate relevant scheduling capacity
  verify resource active
  verify schedule/override feasibility
  verify no conflicting capacity consumption
  consume valid hold if supplied
  insert reservation + assignments
COMMIT
```

A race loser receives a typed conflict and no partial reservation.

Implementation mechanism may evolve, but observable semantics are mandatory.

## 12. Persistence direction

PostgreSQL is canonical Scheduler truth.

Candidate tables:

```text
scheduler_resources
scheduler_resource_capabilities
scheduler_schedule_templates
scheduler_schedule_windows
scheduler_schedule_overrides
scheduler_holds
scheduler_hold_assignments
scheduler_reservations
scheduler_reservation_assignments
scheduler_commands
```

MongoDB may hold semantic/audit events but never active free/busy truth.

## 13. Expiry model

Hold expiry must be based on persisted timestamps, not adapter/browser memory.

A hold whose `expiresAt <= now` must not block new reservation confirmation even if cleanup has not physically deleted/updated the row yet. Cleanup is housekeeping; expiry semantics are logical truth.

## 14. Cancellation and completion

Cancellation releases future capacity according to reservation status/policy. Completion preserves historical allocation but no longer affects future scheduling.

Scheduler lifecycle does not imply refund/payment behavior.

## 15. Business isolation

Every query and mutation includes `businessSlug`. Resource IDs must not bypass scope validation.

The same resource code may exist in two businesses.

## 16. Deterministic recommendation vs scheduling optimization

Services recommendation answers **which Offering** is appropriate.

Scheduler optimization answers **which feasible slot/resource assignment** is preferable.

These are separate concerns and should remain separate algorithms/contracts.

G2 baseline may return chronologically sorted feasible candidates before introducing sophisticated optimization.

## 17. Observability projection

Every allocation mutation should expose/capture:

```text
operationId
businessSlug
demandId
resource assignment IDs
requested interval
resulting reservation/hold ID
conflict/error code
Temporal workflow correlation when supplied
```

Secrets/provider credentials do not belong in Scheduler audit.

## 18. Certification path proposal

```text
G2-S0 Scheduler contract + persistence
G2-S1 resource/schedule management
G2-S2 deterministic availability reads
G2-S3 atomic single-resource reservation conflict
G2-S4 holds + expiry/replay
G2-S5 multi-business generality
G2-S6 Services snapshot integration
G2-S7 Appointment Workflow integration
G2-S8 multi-resource assignment or explicit deferral proof
G2-S9 final clean certification
```

The exact gate numbering can be finalized in Plan before build.

## 19. Required negative cases

```text
unknown business
cross-business resource reference
inactive resource
invalid timezone
invalid/zero capacity
malformed schedule window
overlapping contradictory override
unsatisfied capability
no availability
stale candidate
expired hold
double confirm replay
same operation identity + different material
concurrent capacity conflict
cancel unknown reservation
stale reservation revision
```

## 20. Bounded future claim

Only executable evidence may eventually support:

> The Scheduler Engine deterministically computes business-scoped resource availability and safely manages holds/reservations under explicit time, capability and capacity constraints, preserving idempotency, isolation and atomic conflict semantics independently of channel/provider presentation.
