# S3 — Services Eligibility + Recommendation Certification

## Verdict

**S3 PASS — CERTIFIED**

S3 adds a pure deterministic eligibility and recommendation layer on top of the S1/S2 Services catalog without introducing Agent/LLM authority or vertical-specific policy branching.

## Certified source

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Branch           build/mk1-s3-services-eligibility
GitHub run       33531884206
Job              99936776923
Result           success
Artifact ID       9810084527
Artifact SHA-256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

The earlier run `33531803288` failed at strict typecheck due only to an `exactOptionalPropertyTypes` test-fixture construction error. The test helper was corrected; no runtime domain rule was weakened to obtain the passing result.

## Certified behavior

The implementation provides:

```text
evaluateOfferingEligibility
recommendOfferings
```

Certified properties:

- same Offering + same context -> same decision;
- recommendation output is independent of input ordering;
- stable rank is `priority DESC`, then `name ASC`, then `offeringId ASC`;
- inactive Offerings fail closed;
- malformed eligibility rules fail closed with an explicit reason code;
- configured eligibility failure codes remain visible in the decision;
- required Service requirements participate in eligibility;
- `REQUIRES` and `EXCLUDES` Offering dependencies participate in eligibility;
- PostgreSQL-hydrated Offering definitions flow into the pure evaluation engine;
- no Agent/LLM dependency is required for eligibility or recommendation;
- inherited Appointment certification remains passing.

## Golden coverage exercised

```text
ELG-001 deterministic evaluation
ELG-002 explicit configured failure reason
ELG-004 malformed rule fails closed
REQ-004 requirements/dependencies affect eligibility
REC-001 stable deterministic ranking
REC-002 ineligible/inactive definitions excluded from recommendations
REC-003 recommendation independent of input ordering
```

## Runtime integration proof

The clean Compose certification seeded one generic Service with three Offerings, including persisted requirements, dependencies, and eligibility rules. The S3 probe returned:

```text
SERVICES_S3_RECOMMENDATION_PASS
```

and certified:

```text
recommendationOrder           deterministic
stableAcrossInputOrdering     true
explicitReasonCodes           true
requirementEvaluation         true
dependencyEvaluation          true
databaseHydrationToPureEngine true
agentDependency               false
```

## Boundary preserved

S3 does **not** certify management mutations, optimistic catalog revision updates, durable running-Workflow snapshot behavior, or the final G1 integration surface. Those remain S4–S8.

S3 therefore closes only the deterministic eligibility/recommendation gate.
