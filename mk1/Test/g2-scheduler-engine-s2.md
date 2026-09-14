# G2 Scheduler Engine — S2 Deterministic Availability

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + persistence foundation   ✅ CERTIFIED
G2-S1 Resource/capability/schedule mgmt    ✅ CERTIFIED
G2-S2 Deterministic availability           🟡 IMPLEMENTED — CERTIFICATION PENDING
G2-S3 Atomic reservation conflict          OPEN
G2-S4 Holds + expiry/replay                OPEN
G2-S5 Multi-business generality            OPEN
G2-S6 Services snapshot integration        OPEN
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

This receipt remains provisional until the dedicated G2-S2 workflow passes, evidence is sealed, the machine ledger advances, and the same gate is rerun on the exact final branch head.

## Implemented scope

G2-S2 adds a read-only deterministic availability engine for the first certified **one-resource demand** slice. It evaluates:

```text
business scope
ACTIVE resources
required capability codes + quantities
resource-kind constraints
weekly schedule windows
AVAILABLE / UNAVAILABLE / CAPACITY overrides
resource/window effective capacity
RESERVED allocations
persisted ACTIVE holds
pre/post buffers
configurable slot granularity
deterministic candidate IDs
stable candidate ordering
preferred resource filters
result limit
```

`SlotCandidate` remains advisory and non-persisted.

## Determinism contract

For unchanged scheduling truth and the same canonical input, `slots` are deterministic. Candidate identity is derived from canonical business/demand/time/assignment material. Ordering is:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

`generatedAt` is response observation metadata and can be injected in certification; it is not candidate identity.

## Capacity semantics

Capacity is evaluated segment-by-segment across the candidate occupied interval. The engine splits on blocking allocation boundaries and CAPACITY override boundaries, then requires at every segment:

```text
used reserved units + used ACTIVE-hold units + requested units
<= effective capacity
```

Buffers extend the occupied interval around customer-visible service time.

## Truth boundary

G2-S2 treats rows persisted as `ACTIVE` holds as blocking current truth. It does not infer logical expiry from wall clock; logical expiry/restart correctness belongs to G2-S4.

G2-S2 does not certify reservation mutation, stale-candidate revalidation at commit time, concurrent winner/loser correctness, hold creation/expiry lifecycle, Services runtime demand creation, Appointment integration or multi-resource search/optimization.

## Required terminal marker

```text
SCHEDULER_G2_S2_CERTIFICATION_PASS
```
