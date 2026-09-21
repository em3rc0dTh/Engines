# G1 Services Engine — verification through S6

Date: 2026-09-02

## Current verdict

```text
S0 Runtime promotion                 ✅ CERTIFIED
S1 Contracts + persistence           ✅ CERTIFIED
S2 Deterministic read engine         ✅ CERTIFIED
S3 Eligibility + recommendation      ✅ CERTIFIED
S4 Versioned management mutations    ✅ CERTIFIED
S5 Running-Workflow snapshots        ✅ CERTIFIED
S6 Multi-business generality         ✅ CERTIFIED
S7 Appointment integration           🔧 NEXT
S8 Final clean G1 certification      ⏭ QUEUED

G1 SERVICES ENGINE                   ❌ NOT YET FULLY CERTIFIED
```

## S6 verification matrix

| Assertion | Evidence | Verdict |
|---|---|---|
| Same Temporal Services management Workflow handles two materially different businesses | `certify-services-s6-multibusiness.ts` | PASS |
| Same Service code may exist in separate business scopes | automotive + veterinary `primary-service` | PASS |
| Same Offering code may exist in separate business scopes | automotive + veterinary `standard` | PASS |
| Service read is business-isolated | cross-business ID/code lookup returns no Service | PASS |
| Offering read is business-isolated | cross-business ID/code lookup returns no Offering | PASS |
| Idempotency identity is business-scoped | shared create key applies once in each business | PASS |
| Exact replay remains one logical effect | repeat automotive CreateService returns `REPLAYED` | PASS |
| Cross-business dependency cannot bind | veterinary Offering referencing automotive Offering returns `NOT_FOUND` | PASS |
| Rejected dependency leaves no partial Offering | follow-up read returns no invalid Offering | PASS |
| Eligibility remains deterministic | repeated automotive and veterinary recommendations deep-equal | PASS |
| No fixture/vertical branch leaked into implementation | CI implementation guard | PASS |
| Mongo audit covers S6 management executions | six Workflow IDs / six audit records | PASS |
| S4 management/rejection semantics remain valid | dynamic S4 probes | PASS |
| Inherited Appointment behavior remains valid | full Appointment certification | PASS |

## Successful authority

```text
Branch           build/mk1-s6-services-multibusiness
Source SHA       3eed68b45036154bcf1776564f479cd02e30d0d4
Run              33666790884
Job              100370414068
Result           SUCCESS
Artifact         9860927146
Artifact SHA256  543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564
```

Direct marker:

```text
SERVICES_S6_MULTIBUSINESS_PASS
```

## Failure provenance

```text
Run              33666702773
Job              100370123359
Source           1cf6c133c33eaabfd9539fffcf8b4568e6dc8d34
Result           FAILURE
Cause            static guard scanned a test fixture and produced a false positive
Runtime executed no
```

The fix narrowed the guard to implementation TypeScript files and excluded `*.test.ts`. It did not change Services runtime semantics.

## Human-test requirement

No human/manual test is required to close S6. S6 is a deterministic engine-isolation/generalization gate whose acceptance criteria are executable repository, Temporal, PostgreSQL, Mongo and regression assertions. Human UX observation would not strengthen the specific bounded claim.

Manual testing becomes useful again at S7 when the Appointment interaction can expose the selected revision-aware Service/Offering snapshot through CLI/WebChat/inspector surfaces.

## S6 non-claims

S6 does not prove:

- Appointment consumes the canonical `OfferingSnapshot`;
- Scheduler owns availability/reservation yet;
- Telegram transport works;
- Integration providers work;
- Agent/MCP behavior;
- production readiness.

## Next verification target — S7

S7 must prove:

```text
RegisterNewAppointment
  ↓
Services read engine
  ↓
selected Service + Offering revision-aware snapshot
  ↓
running Workflow state
  ↓
legacy Appointment-compatible date/slot/finalize path for now
```

Required protection:

- selected snapshot is immutable even if catalog head changes;
- Appointment happy path remains passing;
- slot conflict/idempotency regressions remain passing;
- Scheduler ownership is not accidentally moved into Services.
