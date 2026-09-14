# G2 — Scheduler Engine Contract

## Status

**G2-S0 + G2-S1 + G2-S2 CERTIFIED — G2-S3 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. G2-S0 freezes contracts and PostgreSQL foundation; G2-S1 certifies versioned/idempotent management; G2-S2 certifies deterministic one-resource availability. Atomic reservation conflict correctness is the next gate.

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

### Resource

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
```

Resource kind and capability remain data, not vertical branches.

### Schedule

Recurring weekly schedule and exceptional overrides remain separate truth surfaces. `AVAILABLE`, `UNAVAILABLE`, and `CAPACITY` overrides are evaluated explicitly rather than encoded into channel/business-specific workflow logic.

### Demand

`SchedulingDemand` is the immutable Services → Scheduler handoff. It freezes selected service/offering revisions, duration, required capabilities, requested capacity and buffers.

### SlotCandidate

`SlotCandidate` is an advisory read model. It is deterministic but never reservation truth and is not persisted as a booking object.

### Reservation

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

Certified commands:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

Successful business mutation and `scheduler_commands` operation identity commit atomically. Same operation + same canonical material replays. Same operation + different material fails closed. Stale expected revisions and cross-business mutation attempts do not partially mutate state.

## 4. Certified availability semantics — G2-S2

Availability is now certified as a deterministic read over immutable demand + current Scheduler truth for a **one-resource demand** baseline.

Inputs used by the certified engine:

```text
business scope
SchedulingDemand
query window + IANA timezone
ACTIVE resource status
capability code + quantity
optional resource-kind constraints
weekly schedule windows
AVAILABLE / UNAVAILABLE / CAPACITY overrides
RESERVED allocations
persisted ACTIVE holds
pre/post buffers
resource/window effective capacity
slot granularity
preferred resource IDs
limit
```

Deterministic ordering:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

Candidate ID derives from canonical business/demand/time/assignment material, not randomness or generated-at metadata.

## 5. Capacity calculation

Capacity is evaluated segment-by-segment across the occupied interval. Boundaries include candidate edges, blocking allocation edges, and CAPACITY override edges.

At every segment:

```text
reserved units + persisted ACTIVE-hold units + requested units
<= effective capacity
```

This avoids incorrectly combining usage from one sub-interval with reduced capacity from another.

## 6. Schedule and override semantics

A normal candidate must fit a weekly schedule window in the resource's timezone. An `AVAILABLE` override may exceptionally open an otherwise closed interval when it fully contains the occupied interval. Any overlapping `UNAVAILABLE` override blocks. `CAPACITY` overrides reduce effective capacity over their covered segments.

## 7. Time semantics

Persisted instants are offset-aware/UTC. Resource/business time zones are explicit IANA identifiers. Human date parsing is outside Scheduler. Availability projects canonical instants into resource-local weekday/time for weekly schedules.

## 8. Buffers

```text
occupied interval = before buffer + visible service duration + after buffer
```

Capacity/schedule feasibility applies to the occupied interval; returned customer-visible `startAt/endAt` remain the service interval.

## 9. Hold truth boundary

G2-S2 treats rows persisted as `ACTIVE` holds as blocking current truth. It does not infer logical expiry from wall clock. Logical hold expiry/restart semantics are reserved for G2-S4.

## 10. Assignment scope

The certified availability path is one-resource demand only. Contracts/persistence remain multi-assignment capable but no multi-resource search/optimization is claimed.

## 11. G2-S3 — atomic reservation confirmation target

`ConfirmReservation` is the next correctness boundary. A returned `SlotCandidate` is not authority; all relevant current truth must be revalidated inside the reservation transaction.

Required transaction shape:

```text
BEGIN
  establish deterministic business/resource lock scope
  load immutable demand
  verify target resource exists and is ACTIVE
  verify capability/resource-kind requirements
  verify schedule + overrides for occupied interval
  recompute effective capacity for occupied interval
  read current blocking reservations / current hold truth
  reject conflict if requested units no longer fit
  insert reservation
  insert assignment
  persist scheduler_commands operation identity/result
COMMIT
```

The critical G2-S3 invariant is:

```text
two concurrent confirmations for last capacity
→ one RESERVED success
→ one typed SCHEDULER_CAPACITY_CONFLICT
→ exactly one persisted reservation
→ no partial loser assignment/command effect
```

Winner replay with the same operation/material must return the same reservation identity without a duplicate reservation. Same operation identity with different material must fail closed.

## 12. Locking and stale-candidate rule

The one-resource G2-S3 slice should serialize capacity commitments on a deterministic business+resource lock identity. The reservation path must not trust an earlier candidate's availability snapshot. Commit-time revalidation is mandatory.

This gate remains independent from Appointment. Passing conflict correctness does not migrate Appointment automatically.

## 13. PostgreSQL authority

PostgreSQL remains canonical transactional truth:

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

MongoDB may hold semantic/audit evidence but not active free/busy truth.

## 14. Later lifecycle gates

G2-S4 owns logical hold expiry/replay/restart semantics. G2-S5 owns multi-business proof. G2-S6 owns Services runtime demand integration. G2-S7 owns Appointment integration. G2-S8 owns multi-resource proof/deferral. G2-S9 owns final clean Scheduler certification.

## 15. Business isolation

Every read/mutation remains `businessSlug` scoped. Resource identifiers cannot bypass tenant scope.

## 16. Recommendation vs Scheduler

Services answers which commercial Offering is appropriate. Scheduler answers which concrete time/resource allocation is feasible. Neither may silently absorb the other's authority.

## 17. Observability projection

Allocation mutation evidence should expose operation ID, business, demand, resource assignments, requested interval, resulting reservation/hold ID, typed conflict/error code and orchestration correlation when available—never provider secrets.

## 18. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ⏭️ NEXT
G2-S4 holds + expiry/replay                                  OPEN
G2-S5 multi-business generality                              OPEN
G2-S6 Services snapshot integration                         OPEN
G2-S7 Appointment Workflow integration                      OPEN
G2-S8 multi-resource assignment or explicit deferral proof  OPEN
G2-S9 final clean certification                             OPEN
```

No gate advances without dedicated CI, predecessor regressions, terminal marker, artifact digest, receipt/non-claims, ledger transition and final-head rerun.

## 19. Required negative cases

```text
unknown business
cross-business resource reference
inactive resource
invalid timezone
invalid/zero capacity
malformed schedule window
unsatisfied capability
no availability
stale candidate
same operation identity + different material
concurrent last-capacity conflict
double confirm replay
expired hold (G2-S4)
cancel unknown reservation
stale reservation revision
```

## 20. Bounded claim

G2-S2 earns the claim that Scheduler can deterministically compute business-scoped one-resource availability from certified scheduling truth. It does **not** yet earn the claim that reservation commits are race-safe. G2-S3 is the next gate allowed to earn that claim.
