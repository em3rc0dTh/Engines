# 06 — mk0 Design Closure Decisions

## Status

**NORMATIVE DESIGN CLOSURE — 2026-08-24**

This document resolves cross-document drift discovered during the pre-Build architecture review.

When an older quarry, brainstorm note, example or Golden Dataset case conflicts with a decision below, this document plus the current `Design/`, `Plan/`, `Test/` and Golden Dataset contracts are authoritative for mk0.

These decisions do **not** authorize Build. They remove ambiguity so the remaining gates can be evaluated against one contract.

---

## DCD-001 — A legal registration session may start with incomplete Customer data

### Decision

The CTA Adapter validates the **start/session envelope**, not final Customer completeness.

Minimum legal start semantics are:

```text
recognized operation
businessSlug
start/session idempotency identity
structurally valid envelope
valid transport/attachment envelope when present
```

A legal start may contain an empty or partial Customer draft.

Policy-required Customer fields are resolved and evaluated inside the durable Temporal Workflow after `RegistrationPolicy` is loaded.

Expected incomplete-start behavior:

```text
CTA accepts legal session envelope
→ Temporal Workflow starts
→ RegistrationPolicy resolves
→ draft is incomplete
→ WAITING_FOR_REQUIRED_DATA
→ Query exposes missingFields
→ ProvideCustomerData Update(s)
→ same Workflow continues
```

Therefore missing Customer name/contact/document data is **not** automatically a pre-start rejection.

### Rationale

The purpose of mk0 is to prove a durable interactive workflow that can outlive a caller connection. Requiring all business fields before Temporal starts would move conversation/process state back into the CTA and weaken the architecture being tested.

Classification: `DESIGN_DECISION`.

---

## DCD-002 — Registration session idempotency is business-scoped

### Decision

The authoritative registration idempotency scope is:

```text
(operation, businessSlug, idempotencyKeyHash)
```

A caller may reuse the same opaque idempotency key value in another business without creating an idempotency conflict because `businessSlug` is part of the authority scope.

Conceptually:

```text
RegisterNewCustomer + business-a + key-X
!=
RegisterNewCustomer + business-b + key-X
```

The recommended Workflow identity follows the same scope:

```text
register-customer:{businessSlug}:{hash(idempotencyKey)}
```

The raw idempotency key should not be exposed in routine logs.

### Rationale

`businessSlug` is already part of Customer authority, policy resolution, workflow identity and the PostgreSQL idempotency tuple. Treating the key as globally unique would contradict that tenant/business boundary and create unnecessary cross-business coupling.

Classification: `DESIGN_DECISION`.

---

## DCD-003 — The evolving Customer draft is not the immutable start fingerprint

### Decision

`RegisterNewCustomer` is an interactive session whose Customer draft changes through Updates. Therefore the mutable draft cannot be treated as the immutable idempotency fingerprint of the session.

The immutable start fingerprint covers only start-envelope semantics that must not change for the same logical session, conceptually:

```text
operation
businessSlug
schemaVersion
explicit immutable session options, if introduced later
```

It excludes:

```text
customer draft contents
accepted ProvideCustomerData patches
correlationId
channel presentation metadata
request timestamp
```

Rules:

```text
same business + operation + idempotency key + compatible immutable fingerprint
→ resolve the same logical Workflow/session

same business + operation + idempotency key + incompatible immutable fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT

same opaque key in a different business
→ different business-scoped idempotency identity
```

Customer data changes must enter through the designed Temporal Update contract rather than by attempting to create a new meaning for the same start request.

### Golden Dataset consequence

`GD-006` must test an immutable **same-business session-envelope conflict**, not reuse the same key under a different `businessSlug`.

Classification: `DESIGN_DECISION` + `TEST_REQUIREMENT`.

---

## DCD-004 — MongoDB audit has explicit success-gating milestones

### Decision

MongoDB remains the application interaction/audit/context authority. mk0 distinguishes **success-gating audit milestones** from diagnostic detail.

### Success-gating audit milestones

The following logical evidence must be persisted exactly once or idempotently represented when applicable before a registration may be reported as successful:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED          when the workflow waits for data
CUSTOMER_DATA_ACCEPTED           for each logically accepted external input
DUPLICATE_CHECK_COMPLETED
EXISTING_CUSTOMER_RESOLVED       for ALREADY_EXISTS
or
CUSTOMER_CREATED                 for CREATED
ATTACHMENT_COMMITTED             when an attachment is mandatory/present in the enabled case
REGISTRATION_COMPLETED
```

The physical number of MongoDB documents is an implementation choice; the logical milestones and retry-safe identity are the contract.

`REGISTRATION_COMPLETED` must not exist as a false success marker before mandatory business effects are satisfied.

### Diagnostic/non-gating detail

Examples that may be recorded when useful but do not independently define business success:

```text
individual retry-attempt detail
worker process metadata
performance timings
sanitized driver diagnostics
non-authoritative intermediate projections
```

### MongoDB outage rule

If a success-gating audit milestone cannot be persisted after the frozen retry/failure policy is exhausted:

```text
registration MUST NOT be reported as successful
```

The Workflow exposes a typed failure such as:

```text
MONGO_AUDIT_STORE_UNAVAILABLE
```

Temporal Event History remains the durable orchestration evidence for that failure.

`REGISTRATION_FAILED` should be appended to MongoDB when the audit store is available, but persistence of a failure event in the very store whose outage caused the failure cannot be a prerequisite for truthfully reporting that failure.

This avoids an impossible self-dependency while preserving the rule that **success cannot silently lose mandatory audit evidence**.

### PII rule

Success-gating audit does not authorize unrestricted Customer payload duplication. Audit data should prefer stable IDs, classifications, field names, counts, hashes and safe projections according to the existing PII rule.

Classification: `DESIGN_DECISION` + `TEST_REQUIREMENT`.

---

## DCD-005 — Current/future channel vocabulary is intentionally narrow

### Decision

Current mk0 executable CTA surfaces remain:

```text
Postman
CLI
```

The currently documented future examples are:

```text
Form / Web
WhatsApp
Telegram
Mobile
Voice
API / Webhook
Email
```

Other protocols/channels may be introduced later through an explicit design decision, but they are not part of the present mk0 proof contract merely because the CTA architecture is extensible.

This keeps architectural extensibility separate from current release scope.

Classification: `PROJECT_DECISION`.

---

## DCD-006 — Attachment capability remains architecturally required but physically deferred

### Decision

The authority boundary remains frozen:

```text
binary/document truth → AttachmentStore
business reference     → PostgreSQL
orchestration          → Temporal
```

The physical AttachmentStore technology, limits, TTL, encryption profile and fixture binaries/hashes remain Build/golden-fixture closure items.

This deferral must not weaken the attachment tests when attachment cases are enabled. Before an attachment Golden Dataset case can be certified at runtime, its synthetic fixture and SHA-256 expectation must be frozen.

Classification: `DESIGN_DECISION` + `BUILD_REQUIREMENT`.

---

## Closure precedence

For mk0, interpret the documentation in this order when resolving a conflict:

```text
1. Explicit project decisions in mining-site / later closure decisions
2. Current Design contracts, including this document
3. Current Plan
4. Current Test contract
5. Golden Dataset expected behavior
6. Quarries as extracted evidence
7. Brainstorming/history
```

This is not permission for those layers to diverge. Any discovered conflict should still be corrected at the source. The precedence exists only to avoid silent ambiguity during closure.

## What remains before Build authorization

At minimum:

- update Golden Dataset `GD-006` to the business-scoped immutable-envelope rule;
- remove remaining stale channel vocabulary from current mk0 artifacts;
- ensure Test/Golden expectations encode the mandatory-audit success rule;
- record the approved Design commit;
- record the approved Golden Dataset version;
- freeze/mark the exact attachment fixture disposition for the Build sequence;
- then explicitly change `Build/README.md` authorization status only when the project decides the gate is passed.

Until that explicit authorization:

> **No production implementation is authorized.**
