# mk0 — Pre-Build Gate Status Ledger

## Purpose

This ledger answers one question:

> **What is specified, what is formally approved, and what still prevents `Build/` from becoming executable?**

It does not replace Design, Plan, Test or Golden Dataset. It prevents documentation maturity from being mistaken for Build authorization.

Status vocabulary:

```text
SPECIFIED             contract exists and is materially explicit
ALIGNED               known cross-document conflicts are resolved
OPEN                  a required decision/evidence item remains
APPROVAL_NOT_RECORDED  contract may be ready for review, but no approval record exists
BLOCKS_BUILD           Build authorization must not be declared while this remains
BUILD_TIME             intentionally selected during authorized Build, not a pre-Build architecture gap
RUNTIME_GATE           cannot be proven until implementation exists
```

---

## M0 — Reality / source lock

**Status: SPECIFIED / APPROVAL_NOT_RECORDED**

Materially present:

- TimeSlots/DataModel Customer source is identified;
- Temporal official documentation is identified as runtime source;
- no-framework project decision is explicit;
- first architecture slice is explicit;
- PostgreSQL/MongoDB/AttachmentStore authority split is explicit;
- evidence classifications exist in `mining-site`.

Open approval evidence:

- no explicit approved Design/source-lock commit is recorded yet.

Build impact:

```text
not an architecture-content blocker
but formal approval record is still absent
```

---

## M1 — Architecture lock

**Status: SPECIFIED / ALIGNED / APPROVAL_NOT_RECORDED**

Current locked spine:

```text
CTA
→ CTA Adapter
→ Temporal
→ Activities / ports
→ PostgreSQL + MongoDB + optional AttachmentStore
```

Closure fixes now recorded:

- incomplete Customer data may start a legal durable session;
- CTA does not become Customer-completeness authority;
- current/future channel vocabulary was narrowed consistently;
- Build remains framework-neutral.

Open approval evidence:

- architecture approval commit/tag has not been recorded.

---

## M2 — Interactive RegisterNewCustomer contract lock

**Status: SPECIFIED / ALIGNED / APPROVAL_NOT_RECORDED**

Specified:

- partial/intent-only start;
- versioned RegistrationPolicy;
- Query `GetRegistrationState`;
- Update `ProvideCustomerData`;
- multi-round collection;
- business-scoped session idempotency;
- initial-start fingerprint vs later Update semantics;
- hard/soft/non-unique duplicate policy;
- CREATED / ALREADY_EXISTS outcomes;
- zero scheduling side effects.

Known contradiction corrected:

```text
old quarry:
missing Customer fields → reject pre-start

current contract:
legal session → Temporal → WAITING_FOR_REQUIRED_DATA when incomplete
```

---

## M3 — Temporal orchestration lock

**Status: SPECIFIED AT ARCHITECTURE LEVEL / BUILD_TIME DETAILS REMAIN / APPROVAL_NOT_RECORDED**

Pre-Build invariants are explicit:

- real Temporal Service required;
- real Task Queue / Worker required;
- Workflow/Activity separation required;
- Query/Update semantics required;
- retry/restart durability required;
- CTA disconnect must not destroy accepted state;
- Workflow code cannot perform direct side effects;
- replay/version compatibility is mandatory.

The following are correctly **BUILD_TIME**, not reasons to select a framework or SDK prematurely:

- exact Temporal SDK language/version;
- exact versioning API/mechanism;
- exact retry/backoff numbers;
- exact Activity timeouts/heartbeats;
- exact namespace/topology;
- exact visibility/search-attribute configuration;
- exact payload codec/converter.

### Replay/versioning interpretation

Before Build, mk0 must freeze the invariant:

> A deployed Workflow change must preserve deterministic replay/version compatibility for executions whose history was created by an older implementation.

Build must then select and document the SDK-specific mechanism that satisfies that invariant before introducing a non-replay-compatible Workflow change.

This resolves the apparent conflict between `Plan` asking for a versioning/replay strategy and the Temporal quarry leaving the exact implementation mechanism open until Build.

---

## M4 — Persistence contract lock

**Status: SPECIFIED / ALIGNED / APPROVAL_NOT_RECORDED**

Frozen authority:

```text
PostgreSQL      → Customer + registration/idempotency business truth
MongoDB         → application interaction/audit/context
AttachmentStore → binary/document truth when attachments exist
Temporal        → orchestration/Event History
```

Closure decisions now explicit:

- idempotency scope is `(operation, businessSlug, idempotencyKeyHash)`;
- initial material start snapshot is fingerprinted;
- later `ProvideCustomerData` Updates do not rewrite the start fingerprint;
- mandatory audit milestones gate successful completion;
- audit-store exhaustion cannot become false success.

BUILD_TIME persistence choices:

- exact drivers/ORM/ODM;
- migrations/DDL names;
- database/container topology;
- AttachmentStore physical technology;
- attachment TTL/limits;
- production encryption/backup profile.

mk0 synthetic-data rule is already frozen; complete production PII retention/encryption policy is a production gate, not permission to put real PII into mk0 tests.

---

## M5 — Test contract lock

**Status: SPECIFIED / ALIGNED / APPROVAL_NOT_RECORDED**

The Test contract now covers:

- legal partial start;
- invalid session start;
- exact replay;
- same-session conflicting initial start;
- cross-business opaque-key isolation;
- Query/Update/multi-round collection;
- duplicate classification;
- PostgreSQL failures;
- MongoDB mandatory-audit failures;
- AttachmentStore failures when enabled;
- Worker restart;
- CTA disconnect/reconnect;
- real Temporal execution;
- zero scheduling side effects.

Runtime proof is intentionally unavailable until Build exists.

Classification: `RUNTIME_GATE` after Build authorization.

---

## M6 — Golden Dataset v0

**Status: SPECIFIED / MACHINE-READABLE / ALIGNED / APPROVAL_NOT_RECORDED**

Current machine-readable manifest freezes:

- architecture profile;
- RegistrationPolicy fixture;
- business-scoped idempotency profile;
- initial-start fingerprint profile;
- mandatory audit-success profile;
- GD-001 through GD-018 behavior.

Attachment fixture hashes remain explicitly marked `TO_BE_FROZEN*`.

Interpretation:

- this does not authorize fake attachment evidence;
- exact binary fixture hashes must be frozen before attachment runtime cases can be certified;
- AttachmentStore technology is a Build decision;
- attachment runtime certification remains blocked until fixture + technology are concrete.

This does not require choosing the whole application framework before B0.

---

# Current Build authorization verdict

```text
Architecture content            STRONG / materially specified
Known contract contradictions   corrected in current closure pass
Formal Design approval record   MISSING
Formal Golden approval record   MISSING
Build/README status             NOT AUTHORIZED YET
Runtime evidence                impossible until Build exists
```

Therefore:

> **Do not add production code yet.**

The next documentation milestone is a formal **pre-Build review/approval record**, not framework scaffolding.

## Proposed authorization record when the gate is actually approved

Record at minimum:

```text
approval date
approved repository commit SHA
approved Design package version/paths
approved Golden Dataset version
known BUILD_TIME decisions intentionally deferred
first authorized Build ticket
explicit statement that Build/README may change from NOT AUTHORIZED YET
```

No such approval is asserted by this ledger itself.
