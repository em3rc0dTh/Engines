# G2 — Scheduler Engine Contract

## Status

**G2-S0 + G2-S1 CERTIFIED — G2-S2 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. G2-S0 freezes the contract and PostgreSQL foundation; G2-S1 certifies versioned/idempotent management of resources, capabilities, schedule templates and overrides. Availability, reservation concurrency, hold expiry and higher integrations remain bounded to later gates.

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

Resource kinds such as `PERSON`, `ROOM`, `BAY`, `VEHICLE`, `MACHINE`, `POOL` are data, not runtime branches.

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

Overrides represent holidays, leave, maintenance, exceptional opening or temporary capacity changes.

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

## 3. Certified management semantics — G2-S1

The management surface is now executable and independently certified:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

All operations are business-scoped and durable-operation-id based. Resource, schedule and override updates require an expected revision. The mutation and successful `scheduler_commands` ledger entry commit atomically in the same PostgreSQL transaction.

Replay contract:

```text
same operationId + same canonical material
→ return persisted result identity as replay
→ no duplicate mutation

same operationId + different canonical material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second mutation
```

Schedule and override identity cannot silently move to a different resource. Resource capability replacement and schedule-window replacement occur inside the same transaction as the parent revision update.

## 4. Availability calculation — G2-S2 target

Availability is a pure read over current scheduling truth plus immutable `SchedulingDemand`.

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

The output is a deterministic ordered list of advisory `SlotCandidate` values.

Stable ordering:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

No randomness or LLM inference belongs in the baseline availability path.

The first certified availability slice is deliberately **one-resource demand**. Persistence remains multi-assignment capable, but multi-resource search/optimization is not implied.

## 5. Time semantics

All persisted instants use unambiguous timestamp-with-offset/UTC representations. Business/resource time zones are explicit IANA-style identifiers.

```text
no implicit server-local timezone
no silent DST flattening
human date parsing remains outside Scheduler
Scheduler receives canonical instants/windows
```

## 6. Granularity

Availability may use configurable slot granularity; Offering duration is not assumed to equal granularity.

```text
granularity 15m
offering duration 45m
candidate start 10:15
candidate end   11:00
```

## 7. Buffers

Demand may include pre/post buffers. Buffers consume scheduling capacity even when customer-visible service time excludes them.

```text
occupied interval = bufferBefore + service duration + bufferAfter
```

## 8. Capacity model

Each Resource has positive integer capacity. Each assignment consumes positive units.

Baseline invariant:

```text
sum(blocking reservation units + blocking hold units + requested units)
<= effective capacity for the occupied interval
```

Overrides may change effective capacity.

G2-S2 may read currently persisted ACTIVE holds as blocking truth, but it does **not** earn the logical expiry semantics of G2-S4. Cleanup/expiry correctness remains a later certification boundary.

## 9. Capability matching

A Resource satisfies a `CapabilityDemand` only when capability code and optional resource-kind constraints match deterministically. No fuzzy matching, provider logic or LLM inference is permitted.

## 10. Assignment scope

G2-S2 certifies one-resource availability first. Contracts/persistence continue to support multiple resource assignments for later proof.

Examples of future combinations:

```text
veterinarian + room
technician + workshop bay
vehicle + driver
machine + operator
```

## 11. Mutation commands

Certified management operations:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

Future allocation operations:

```text
CreateHold
ReleaseHold
ConfirmReservation
CancelReservation
CompleteReservation
```

## 12. Atomic reservation confirmation — G2-S3 target

`ConfirmReservation` is the critical correctness boundary.

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

## 13. Persistence direction

PostgreSQL is canonical Scheduler truth.

```text
scheduler_resources
scheduler_resource_capabilities
scheduler_schedule_templates
scheduler_schedule_windows
scheduler_schedule_overrides
scheduler_demands
scheduler_holds
scheduler_hold_assignments
scheduler_reservations
scheduler_reservation_assignments
scheduler_commands
```

`scheduler_demands` stores the immutable Services → Scheduler handoff by value/hash, rather than linking scheduling truth to mutable catalog heads. MongoDB may hold semantic/audit evidence but never active free/busy truth.

## 14. Expiry model — G2-S4 target

Hold expiry is persisted-time based, not adapter/browser memory. A hold whose logical expiry has passed must eventually be proven non-blocking even before housekeeping updates physical state. This claim is intentionally not earned by G2-S2.

## 15. Cancellation and completion

Cancellation releases future capacity according to reservation status/policy. Completion preserves historical allocation. Scheduler lifecycle does not imply refund/payment behavior.

## 16. Business isolation

Every query and mutation includes `businessSlug`. Resource IDs never bypass scope. The same resource code may exist in different businesses.

## 17. Recommendation vs scheduling optimization

Services recommendation answers **which Offering** is appropriate. Scheduler answers **which feasible slot/resource assignment** is available/preferred. These remain distinct contracts and algorithms.

## 18. Observability projection

Allocation mutation evidence should expose:

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

Secrets/provider credentials never belong in Scheduler audit.

## 19. Certification path

```text
G2-S0 Scheduler contract + persistence                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ⏭️ NEXT
G2-S3 atomic single-resource reservation conflict           OPEN
G2-S4 holds + expiry/replay                                  OPEN
G2-S5 multi-business generality                              OPEN
G2-S6 Services snapshot integration                         OPEN
G2-S7 Appointment Workflow integration                      OPEN
G2-S8 multi-resource assignment or explicit deferral proof  OPEN
G2-S9 final clean certification                             OPEN
```

No gate may advance without its dedicated CI, predecessor regressions, terminal marker, artifact digest, receipt/non-claims, ledger transition and final-head rerun.

## 20. Required negative cases

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

G2-S0 certifies the foundation subset. G2-S1 certifies management replay/revision/business-isolation cases. Availability/conflict/expiry cases remain explicitly assigned to G2-S2–G2-S4 rather than claimed early.

## 21. Bounded future claim

Only executable evidence may eventually support:

> The Scheduler Engine deterministically computes business-scoped resource availability and safely manages holds/reservations under explicit time, capability and capacity constraints, preserving idempotency, isolation and atomic conflict semantics independently of channel/provider presentation.

G2-S0 and G2-S1 establish the contract, persistence and management prerequisites. G2-S2 is the next gate allowed to earn deterministic availability claims.
