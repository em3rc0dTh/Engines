# G2 Scheduler Engine — S2 Deterministic Availability

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + persistence foundation   ✅ CERTIFIED
G2-S1 Resource/capability/schedule mgmt    ✅ CERTIFIED
G2-S2 Deterministic availability           ✅ CERTIFIED
G2-S3 Atomic reservation conflict          ⏭️ NEXT
G2-S4 Holds + expiry/replay                OPEN
G2-S5 Multi-business generality            OPEN
G2-S6 Services snapshot integration        OPEN
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

G2-S2 is independently certified on its implementation candidate. The same dedicated workflow must still pass again on the exact final documentation/ledger head before the G2-S3 branch is created.

## Certified scope

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

`generatedAt` is observation metadata and may be injected in certification; it is not part of candidate identity.

## Capacity semantics

Capacity is evaluated segment-by-segment across the occupied interval. The engine splits on blocking allocation boundaries and CAPACITY override boundaries, then requires at every segment:

```text
used reserved units + used ACTIVE-hold units + requested units
<= effective capacity
```

Buffers extend the occupied interval around customer-visible service time.

## Candidate executable certification

```text
branch  build/g2-s2-deterministic-availability
head    147b9dc941a974d6da3d668ccbb8dcd52624366a
push    34901265173  SUCCESS
PR      34901279787  SUCCESS
```

Both candidate runs completed:

```text
g2-s2-contracts-boundaries   PASS
g2-s2-postgres-availability  PASS
scheduler-g2-s2-seal         PASS
```

Proven behavior includes G2-S0/G2-S1 predecessor regressions, generic/provider-agnostic boundary checks, one-resource capability/kind filtering, weekly schedules, exceptional AVAILABLE opening, UNAVAILABLE blocking, CAPACITY reduction, reservation and ACTIVE-hold blocking capacity, buffers, deterministic replay, stable ordering and advisory SlotCandidate non-persistence.

Terminal markers:

```text
SCHEDULER_G2_S2_CONTRACTS_PASS
SCHEDULER_G2_S2_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S2_AVAILABILITY_PASS
SCHEDULER_G2_S2_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S2_CERTIFICATION_PASS
```

Candidate push evidence:

```text
scheduler-g2-s2-34901265173
id      10371390716
sha256  2f7eb80f708817bdf852d3a8a9244478c7df440ebfdfb3b06eeb3b99c75a606d

scheduler-g2-s2-seal-34901265173
id      10371031732
sha256  e16bd156bf9c3e351f20158a4a3d8567124df39609a6c8180360a86c3c30c18a
```

Candidate PR evidence:

```text
scheduler-g2-s2-34901279787
id      10371325955
sha256  df4c5c1d57de14e160f2405127d12835ba63a04b0fb4d04e27f3a5a3d7f7992d

scheduler-g2-s2-seal-34901279787
id      10370567514
sha256  18cb434b53849822f75d9f5febf7b7a6abff2ec5a50b7d285d461da0cbd31596
```

## Truth boundary

G2-S2 treats rows persisted as `ACTIVE` holds as blocking current truth. It does **not** infer logical expiry from wall clock; logical expiry/restart correctness belongs to G2-S4.

G2-S2 does not certify reservation mutation, stale-candidate revalidation at commit time, concurrent winner/loser correctness, hold creation/expiry lifecycle, Services runtime demand creation, Appointment integration or multi-resource search/optimization.

## Advancement rule

The machine ledger may expose G2-S3 as `NEXT` only while G2-S0 through G2-S2 form the contiguous certified prefix. The exact final branch head—including this receipt, ledger, design, roadmap and evidence—must pass the same G2-S2 workflow again before G2-S3 implementation begins.
