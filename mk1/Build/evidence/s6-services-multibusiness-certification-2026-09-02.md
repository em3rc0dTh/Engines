# S6 — Services multi-business generality certification

Date: 2026-09-02

## Verdict

**S6 MULTI-BUSINESS GENERALITY — CERTIFIED**

This receipt certifies a bounded claim: the MK1 Services Engine executes the same contracts, persistence model, Temporal management Workflow, read repository, deterministic eligibility engine, idempotency semantics and audit boundary for two materially different synthetic businesses without introducing vertical-specific implementation branches.

It does **not** certify S7 Appointment→Services integration, S8 full G1 closure, Scheduler, Telegram, Agent/MCP, production deployment or production security.

## Authority

```text
Branch           build/mk1-s6-services-multibusiness
Certified SHA    3eed68b45036154bcf1776564f479cd02e30d0d4
Workflow         mk1 S6 Services multi-business certification
Run              33666790884
Job              100370414068
Result           SUCCESS
Artifact         9860927146
Artifact name    mk1-s6-services-multibusiness-33666790884
Artifact bytes   3586
Artifact SHA256  543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564
```

Later documentation commits on the branch are indexing only. They do not replace `3eed68b...` as the source that was actually executed by the successful certification run.

## Certified specimens

The runtime probe used two materially different business scopes through the same Services path:

```text
s6-golden-auto
  Service   Vehicle Care
  code      primary-service
  Offering  Basic Wash
  code      standard
  duration  30 minutes
  pricing   FIXED PEN 3000 minor units
  required  vehicle-profile
  eligibility fact: vehicle.type exists

s6-golden-vet
  Service   Consultation
  code      primary-service
  Offering  General Consultation
  code      standard
  duration  45 minutes
  pricing   FIXED PEN 7000 minor units
  required  pet-profile
  eligibility fact: pet.species exists
```

The shared Service and Offering codes are intentional. They prove code uniqueness is business-scoped rather than globally coupled to a vertical.

## Direct S6 runtime proof

The successful run emitted:

```text
SERVICES_S6_NO_VERTICAL_FIXTURE_BRANCHING_PASS

SERVICES_S6_MULTIBUSINESS_PASS {
  "businesses":["s6-golden-auto","s6-golden-vet"],
  "sharedServiceCode":"primary-service",
  "sharedOfferingCode":"standard",
  "businessScopedReads":true,
  "businessScopedIdempotency":true,
  "crossBusinessDependencyRejected":true,
  "deterministicEligibility":true,
  "autoDurationMinutes":30,
  "vetDurationMinutes":45,
  "workflowAuditCount":6
}
```

The probe proves:

- both businesses use the same `servicesManagementWorkflow`;
- both businesses use the same PostgreSQL Service/Offering repositories;
- the same opaque idempotency key may be used independently in two business scopes;
- exact replay in one business returns `REPLAYED` rather than creating a second effect;
- Service reads cannot cross business scope;
- Offering reads cannot cross business scope;
- an Offering in one business cannot satisfy a dependency reference in another business;
- the rejected cross-business dependency leaves no invalid Offering behind;
- materially different eligibility contexts are deterministic across repeated evaluation;
- the implementation contains no S6 fixture/vertical identity branch;
- all six S6 Temporal management executions have corresponding Mongo Services audit records.

## Inherited management safety

S6 re-ran the dynamic S4 proofs before its own probe:

```text
SERVICES_S4_MANAGEMENT_PASS {
  "workflows":11,
  "exactReplay":true,
  "materialConflict":true,
  "businessScopedIdempotency":true,
  "serviceRevision":3,
  "offeringRevision":3,
  "staleServiceRejected":true,
  "staleOfferingRejected":true,
  "auditCompleteBeforeResults":true
}

SERVICES_S4_REJECTION_SAFETY_PASS {
  "missingDependencyRejected":true,
  "partialOfferingCreated":false,
  "mutationCommandPersisted":false,
  "auditPersisted":true
}
```

Therefore S6 does not weaken revision conflict, idempotency conflict, dependency preflight or mandatory semantic-audit behavior previously certified at S4.

## Inherited Appointment regression

The same clean laboratory also executed the inherited Appointment certification. Markers included:

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

This is a regression proof only. At S6, Appointment still uses the inherited compatibility/catalog path. It is **not yet evidence for S7 canonical Services snapshot consumption**.

## Static implementation guard

The CI scans runtime implementation `.ts` files while excluding `*.test.ts` and rejects S6 fixture identities in implementation code.

Successful marker:

```text
SERVICES_S6_NO_VERTICAL_FIXTURE_BRANCHING_PASS
```

This is a bounded anti-hardcoding guard. It does not prove that every conceivable future vertical is supported; it proves the certified specimens do not require vertical-name branching in the current implementation.

## First-run failure provenance

The first run is retained rather than erased:

```text
Run              33666702773
Job              100370123359
Source SHA       1cf6c133c33eaabfd9539fffcf8b4568e6dc8d34
Result           FAILURE
Failed step      Guard against vertical fixture branching in runtime source
Artifact         9860853124
Artifact SHA256  a9e04c9e69742fddf9d8fc567546c90adc7ce629f58801ea112c17411479dc41
```

Cause: the first guard scanned all `src` files and matched an already-existing unit-test fixture string (`validateBusinessScope('golden-auto')`). The false positive occurred before Compose startup and before the S6 runtime probe.

The guard was corrected to scan implementation TypeScript while excluding test files. No Services business invariant was weakened and no runtime behavior was changed by that fix.

## Expectation provenance

The S6 assertions were already declared in the pre-Build design contract:

- `mk1/Design/09-services-engine-completion-contract.md`

A machine-readable transcription now exists at:

- `mk1/golden-dataset/services-s6-multibusiness-v0.json`

That JSON file explicitly records that it was created after Build had started. It must not be represented as an independently predeclared Golden file; the earlier Design contract is the pre-Build expectation authority.

## Evidence artifact contents

The successful artifact captures the executed source SHA and runtime evidence including:

```text
git-sha.txt
compose-ps.txt
worker.log
cta.log
postgres-services.txt
postgres-offerings.txt
postgres-commands.txt
mongo-services-audit.txt
```

## Bounded certification claim

The strongest allowed statement after this gate is:

> **Services S0–S6 are certified. The same Services Engine implementation has executable multi-business isolation/generality proof across materially different automotive and veterinary specimens.**

The following remain open:

```text
S7 Appointment consumes canonical revision-aware Services snapshots   OPEN
S8 clean full G1 certification                                       OPEN
G1 Services Engine overall                                           NOT YET CERTIFIED
G2 Scheduler Engine                                                  NOT CERTIFIED
Telegram                                                             NOT CERTIFIED
Integration Engine runtime                                           NOT CERTIFIED
Agent / MCP                                                           ABSENT BY DESIGN
Production readiness                                                 NOT CERTIFIED
```
