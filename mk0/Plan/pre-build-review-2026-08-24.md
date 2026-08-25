# mk0 — Formal Pre-Build Review

## Status

**READY FOR PROJECT AUTHORITY DECISION — NOT BUILD AUTHORIZATION**

Review date: `2026-08-24`

Reviewed repository commit:

```text
2f1515c39470141985df3adba28e8d9d61e7bef3
```

Review posture:

> Agnostic architecture review. This record evaluates whether the current mk0 documentation is coherent enough to be formally approved. It does not approve Build and does not replace the project authority decision.

---

## 1. Review conclusion

### Recommendation

**APPROVE the mk0 architecture/test/golden contract for Build entry, with staged attachment authorization.**

Recommended first authorization envelope:

```text
B0  runtime/repository skeleton
B1  canonical contracts + versioned RegistrationPolicy
B2  real Temporal local/runtime topology + visibility
B3  first CLI CTA Adapter
B4  Temporal Worker + Task Queue + interactive RegisterNewCustomer
B5  PostgreSQL policy/duplicate/customer persistence Activities
B6  MongoDB mandatory interaction/audit Activities
```

Recommended hold:

```text
B7  AttachmentStore implementation
```

B7 remains gated until:

- physical AttachmentStore technology is selected;
- synthetic attachment fixture binaries exist;
- expected SHA-256 values are frozen;
- size/count/TTL rules required by the enabled mk0 attachment cases are recorded.

This staged authorization does not remove attachment cases from mk0. It only prevents unresolved binary-storage choices from blocking proof of the reusable orchestration spine.

---

## 2. Architecture contract reviewed

Current approved-candidate spine:

```text
Postman / CLI
→ CTA Adapter
→ real Temporal Service
→ RegisterNewCustomer Workflow
→ Activities / ports
→ PostgreSQL + MongoDB + optional AttachmentStore
→ canonical result/state
```

Findings:

- CTA is a replaceable channel boundary, not orchestration authority;
- incomplete Customer business data may start a legal durable session;
- versioned `RegistrationPolicy` determines Customer completeness inside Temporal;
- Temporal owns durable state, waiting, retry/recovery and workflow progress;
- Workflow code performs no direct DB/network/file side effects;
- PostgreSQL owns canonical Customer + registration/idempotency truth;
- MongoDB owns application interaction/audit/context evidence;
- AttachmentStore owns binary/document truth when enabled;
- Temporal Event History remains separate orchestration truth;
- `RegisterNewCustomer` creates zero scheduling side effects;
- Agent/Hermes, Scheduler, Services and wider Integration engines remain outside mk0.

Review result:

```text
ARCHITECTURE CONTRACT: READY FOR APPROVAL
```

---

## 3. Interactive registration contract reviewed

Confirmed behavior:

```text
legal partial start
→ Temporal starts
→ policy loads
→ missing data produces WAITING_FOR_REQUIRED_DATA
→ GetRegistrationState exposes missingFields
→ ProvideCustomerData Update(s) evolve the same durable draft
→ duplicate classification occurs through Activities
→ CREATED or ALREADY_EXISTS
→ required audit/finalization
→ terminal success
```

Confirmed idempotency semantics:

```text
scope = (operation, businessSlug, idempotencyKeyHash)
```

Confirmed initial-start fingerprint semantics:

- the normalized material initial Customer/attachment snapshot participates in the initial fingerprint;
- later accepted Temporal Updates do not rewrite that start fingerprint;
- same business + same key + same initial fingerprint resolves the same logical session;
- same business + same key + materially different initial fingerprint is a session conflict;
- the same opaque key in another business does not create a cross-business conflict.

Review result:

```text
INTERACTIVE CONTRACT: READY FOR APPROVAL
```

---

## 4. Temporal contract reviewed

Non-negotiable runtime requirements are coherent:

- real Temporal Service;
- real Task Queue;
- real Worker;
- real Workflow execution;
- real Activities;
- Query + Update semantics;
- durable Event History;
- worker restart recovery;
- Activity retry behavior;
- CTA disconnect/reconnect continuity;
- deterministic replay/version compatibility.

Correctly deferred to Build:

- exact Temporal SDK language/version;
- namespace/topology;
- Task Queue naming;
- Activity retry numeric values;
- timeouts/heartbeats;
- payload converter/codec;
- SDK-specific workflow versioning mechanism;
- visibility/search-attribute implementation.

These deferred items may implement the contract but may not redefine it.

Review result:

```text
TEMPORAL CONTRACT: READY FOR APPROVAL
```

---

## 5. Persistence contract reviewed

Authority split is coherent:

```text
PostgreSQL      → Customer + registration/idempotency business truth
MongoDB         → interaction/audit/context
AttachmentStore → binary/document objects when enabled
Temporal        → orchestration/Event History
```

Success semantics are explicit:

- both `CREATED` and `ALREADY_EXISTS` require mandatory audit/finalization before successful completion;
- exhausted required MongoDB audit failure cannot become false success;
- retry after an already-completed business side effect must recover the existing logical effect rather than duplicate it;
- cross-store partial effects remain diagnosable/reconcilable.

Review result:

```text
PERSISTENCE CONTRACT: READY FOR APPROVAL
```

---

## 6. Test contract reviewed

The predeclared suite covers the architectural risks that matter for mk0:

- partial/intent-only start;
- invalid session envelope;
- exact start replay;
- conflicting same-session initial start;
- cross-business key isolation;
- Query/Update/multi-round collection;
- hard duplicate;
- soft duplicate;
- PostgreSQL transient failure/recovery;
- MongoDB mandatory-audit failure;
- AttachmentStore failure/integrity when enabled;
- worker restart;
- CTA disconnect/reconnect;
- real Temporal runtime evidence;
- zero scheduling side effects.

No implementation exists yet, so runtime PASS/FAIL is intentionally unavailable.

Review result:

```text
TEST CONTRACT: READY FOR APPROVAL
RUNTIME EVIDENCE: FUTURE GATE
```

---

## 7. Golden Dataset reviewed

Dataset:

```text
mk0.golden.register-customer.v0
```

Current status:

- machine-readable manifest exists;
- RegistrationPolicy fixture exists;
- business-scoped idempotency behavior is explicit;
- initial-start fingerprint behavior is explicit;
- mandatory audit-success profile is explicit;
- GD-001 through GD-018 are defined;
- synthetic data only;
- attachment hashes are deliberately marked unresolved until fixture closure.

Review recommendation for attachment disposition:

```text
OPTION B

B0–B6 may proceed after formal Build authorization.
B7 and attachment runtime certification remain gated until
AttachmentStore technology + fixture binaries + SHA-256 expectations are frozen.
```

Review result:

```text
GOLDEN DATASET CORE: READY FOR APPROVAL
ATTACHMENT RUNTIME SUB-GATE: DEFERRED TO B7 ENTRY
```

---

## 8. Pre-Build blockers found by this review

```text
ARCHITECTURE CONTRADICTIONS: NONE KNOWN AFTER CLOSURE PASS
CORE GOLDEN CONTRADICTIONS: NONE KNOWN AFTER CLOSURE PASS
TEST-CONTRACT CONTRADICTIONS: NONE KNOWN AFTER CLOSURE PASS
```

Items still requiring a project authority decision/record:

```text
1. Accept or reject this review recommendation.
2. Accept staged attachment disposition (recommended Option B) or choose Option A.
3. Record the approved repository commit SHA.
4. Record the approved Golden Dataset version.
5. Record the first authorized Build ticket.
6. Only then change Build/README.md from NOT AUTHORIZED YET.
```

These are authorization actions, not unresolved architecture content.

---

## 9. Recommended first Build ticket after approval

### B0 — Runtime / repository skeleton

B0 should create only the minimum executable foundation required to support the later proof, without implementing business behavior prematurely.

B0 must establish/record:

```text
chosen Temporal SDK language/version
real local Temporal Service topology
Temporal namespace
Task Queue naming/topology
Worker process boundary
PostgreSQL local topology
MongoDB local topology
repository/module boundaries
configuration/secrets convention for local mk0
repeatable local start/stop commands
Temporal Web UI / visibility access
```

B0 must **not** yet claim:

```text
RegisterNewCustomer PASS
Customer persistence PASS
Golden Dataset PASS
runtime certification PASS
```

B0 success means only:

> the real mk0 runtime foundation exists, starts repeatably, preserves the frozen architecture boundaries and is ready for B1/B2 implementation.

---

## 10. Reviewer recommendation

```text
RECOMMENDATION: READY_FOR_APPROVAL
BUILD AUTHORIZED BY THIS FILE: NO
RECOMMENDED FIRST AUTHORIZED TICKET: B0
RECOMMENDED ATTACHMENT DISPOSITION: OPTION B / B7 GATED
```

The repository should remain documentation-only until a separate explicit project authority approval record is committed.
