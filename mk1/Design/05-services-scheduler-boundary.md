# G1→G2 — Services / Scheduler Boundary Contract

## Status

**DESIGN CANDIDATE — PRE-BUILD**

This contract freezes the semantic handoff between Step 3 Services and Step 4 Scheduler.

## 1. Authority split

```text
Services Engine owns
- what the offering is
- nominal duration
- pricing descriptor
- requirements/dependencies
- eligibility/recommendation
- immutable selected revision snapshot
- abstract resource/capacity demand

Scheduler Engine owns
- concrete resources
- capabilities available on resources
- schedules and overrides
- capacity/free-busy
- candidate slots
- holds
- reservations
- assignment/conflict lifecycle
```

Neither engine owns channel presentation.

## 2. Immutable handoff

Scheduler must receive immutable material derived from the selected Offering snapshot rather than looking up mutable catalog head.

```ts
type SchedulingDemand = Readonly<{
  schemaVersion: 1;
  businessSlug: string;
  demandId: string;
  service: {
    serviceId: string;
    revision: number;
  };
  offering: {
    offeringId: string;
    revision: number;
    durationMinutes: number;
  };
  capacityUnits: number;
  requiredCapabilities: readonly CapabilityDemand[];
  buffers: {
    beforeMinutes: number;
    afterMinutes: number;
  };
}>;

type CapabilityDemand = Readonly<{
  code: string;
  quantity: number;
  resourceKinds?: readonly string[];
}>;
```

`demandId` is durable Workflow-owned identity for this scheduling demand.

## 3. Snapshot invariant

If a Workflow selected Offering revision `N`, all Scheduler operations for that selection use the derived demand from `N` until an explicit Workflow operation reselects/refreshed the offering.

```text
catalog head N+1 != silent scheduling demand mutation
```

## 4. Resource abstraction

Services may require abstract capabilities such as:

```text
WASH_BAY
VETERINARIAN
XRAY_MACHINE
DELIVERY_VEHICLE
CONSULTATION_ROOM
```

Services must not embed concrete Scheduler identities such as `employee_42` or `bay_3` as general catalog semantics.

If a specific concrete resource is itself part of the commercial offering, that explicit relationship must be modeled separately rather than smuggled into generic capability requirements.

## 5. Query contract

```ts
type QueryAvailabilityInput = Readonly<{
  businessSlug: string;
  requestId: string;
  demand: SchedulingDemand;
  window: {
    startAt: string;
    endAt: string;
    timeZone: string;
  };
  preferredResourceIds?: readonly string[];
  limit?: number;
}>;
```

Output:

```ts
type AvailabilityResult = Readonly<{
  requestId: string;
  generatedAt: string;
  slots: readonly SlotCandidate[];
}>;
```

The result is advisory and does not reserve capacity.

## 6. Candidate contract

```ts
type SlotCandidate = Readonly<{
  candidateId: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  assignments: readonly ResourceAssignmentCandidate[];
}>;

type ResourceAssignmentCandidate = Readonly<{
  resourceId: string;
  capacityUnits: number;
}>;
```

`candidateId` is an opaque Scheduler-generated reference useful for selection/revalidation, not a reservation ID.

## 7. Hold contract

Hold is optional in early G2 but the contract is reserved now.

```ts
type CreateHoldInput = Readonly<{
  businessSlug: string;
  operationId: string;
  demandId: string;
  candidateId: string;
  expiresInSeconds: number;
}>;
```

A hold protects capacity temporarily and expires automatically.

## 8. Reservation contract

```ts
type ConfirmReservationInput = Readonly<{
  businessSlug: string;
  operationId: string;
  demand: SchedulingDemand;
  candidateId?: string;
  holdId?: string;
  requestedStartAt: string;
}>;
```

Confirmation must recompute/revalidate all material constraints atomically. Candidate or hold references are evidence/optimization, not permission to skip revalidation.

## 9. Result identity

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
}>;
```

Appointment/business records may reference `reservationId`, but Scheduler does not become the Customer/Appointment authority.

## 10. Failure semantics

Minimum typed outcomes:

```text
BUSINESS_SCOPE_NOT_FOUND
SCHEDULING_DEMAND_INVALID
CAPABILITY_UNSATISFIED
NO_AVAILABILITY
SLOT_NO_LONGER_AVAILABLE
CAPACITY_CONFLICT
RESOURCE_INACTIVE
HOLD_NOT_FOUND
HOLD_EXPIRED
RESERVATION_NOT_FOUND
RESERVATION_REVISION_CONFLICT
IDEMPOTENCY_MATERIAL_CONFLICT
```

## 11. Idempotency

All mutation operations use business-scoped explicit operation identity.

```text
same operationId + same canonical material
→ exact replay

same operationId + different material
→ conflict
```

This follows the same discipline already certified in Customer, Services and C1B channel work.

## 12. Appointment composition target

```text
Appointment Workflow
  → Get/Select OfferingSnapshot
  → derive SchedulingDemand
  → QueryAvailability
  → choose SlotCandidate
  → optional CreateHold
  → explicit Finalize
  → ConfirmReservation atomically
  → persist/reference Appointment result
```

Final appointment creation must not assume that previously displayed availability is still valid.

## 13. Non-claims

This design does not yet certify Scheduler implementation, real concurrency behavior, multi-resource assignment, optimization, production scale, or Appointment migration to G2.
