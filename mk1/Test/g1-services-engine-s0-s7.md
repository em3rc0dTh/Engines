# G1 Services Engine — verification through S7

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
S7 Appointment integration           ✅ CERTIFIED
S8 Final clean G1 certification      🔧 NEXT

G1 SERVICES ENGINE                   ❌ NOT YET FULLY CERTIFIED
```

## S7 verification matrix

| Assertion | Proof | Verdict |
|---|---|---|
| Appointment Service list uses canonical Services read Activity | static boundary guard + runtime projection | PASS |
| Appointment Offering list uses canonical Services read Activity | static boundary guard + runtime projection | PASS |
| Service selection exposes canonical business scope/status/revision | Appointment A state | PASS |
| Offering selection exposes canonical revision/pricing/requirements/dependencies | Appointment A state | PASS |
| Active Appointment retains revision N after catalog publishes N+1 | N→N+1 probe | PASS |
| Active Appointment retains revision-N commercial semantics | QUOTE_REQUIRED remains after publication | PASS |
| New Appointment sees N+1 | Appointment B revision 2 | PASS |
| New Appointment sees N+1 commercial semantics | FIXED PEN 3100 | PASS |
| Appointment A completes after catalog publication | first Appointment `CREATED` | PASS |
| Appointment B completes on N+1 | second Appointment `CREATED` | PASS |
| S6 multi-business remains passing | S6 reprobe after reset | PASS |
| Customer Child Workflow path remains passing | inherited Appointment cert | PASS |
| human date normalization remains passing | inherited Appointment cert | PASS |
| exact Appointment replay remains passing | inherited Appointment cert | PASS |
| same-slot race remains one winner | inherited Appointment cert | PASS |
| C0/C1B projections/contracts remain passing | static tests | PASS |
| Scheduler authority remains outside Services | implementation boundary review | PASS |

## Successful authority

```text
Branch           build/mk1-s7-appointment-services-integration
Source SHA       6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
Run              33668593216
Job              100376325350
Result           SUCCESS
Artifact         9861631780
SHA256           e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a
```

Direct S7 markers:

```text
SERVICES_S7_CANONICAL_ACTIVITY_BOUNDARY_PASS
SERVICES_S7_CANONICAL_SELECTION_PASS
SERVICES_S7_CATALOG_N_PLUS_1_PASS
SERVICES_S7_ACTIVE_SNAPSHOT_STILL_N_PASS
SERVICES_S7_FIRST_APPOINTMENT_CREATED_PASS
SERVICES_S7_NEW_APPOINTMENT_SEES_N_PLUS_1_PASS
SERVICES_S7_APPOINTMENT_INTEGRATION_PASS
```

## Harness-isolation provenance

First run:

```text
Run       33668304438
Job       100375359804
Source    784bf57439512b69d941d9828f6c5abd5fc06225
Result    FAILURE
Artifact  9861484659
SHA256    d9f27f3d97639767cfc106d20eb319e1d96c43d1f6a28b94e71a9ed8f9365721
```

The direct S7 proof passed, then the inherited Appointment regression saw one fewer Friday slot because S7 had already booked it in the same DB. This was test-state contamination. The final gate runs inherited Appointment in pristine lab A, destroys volumes, then runs S6/S7 in pristine lab B.

## Human testing

No separate human test is required to certify S7. The claim is catalog authority + durable revision semantics inside Temporal, proven directly through runtime state and two Appointments. Existing WebChat C1A/C1B renderer compatibility remains static-test protected.

A human WebChat check becomes useful after a later UI/inspector change deliberately surfaces Service/Offering revision/pricing snapshot information as a first-class visual field. S7 did not require that UX change.

## S7 non-claims

S7 does not prove:

- Scheduler availability/capacity/hold/reservation behavior;
- full G1 closure (S8 remains);
- Telegram physical Bot API transport;
- Integration provider runtime;
- Agent/MCP;
- production readiness.

## S8 next

S8 must execute one clean G1 closure suite covering S1–S7 plus protected foundation regressions and produce the final Services Engine certification receipt. S8 must not introduce new product semantics merely to make the suite green.
