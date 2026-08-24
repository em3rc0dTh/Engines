# Test — mk0

## Purpose

Tests are specified before Build so implementation cannot redefine success.

```text
T0 — start/session contract
T1 — Temporal interaction contract
T2 — Temporal workflow/runtime
T3 — PostgreSQL persistence + duplicate lookup
T4 — MongoDB interaction/audit persistence
T5 — AttachmentStore persistence when enabled
T6 — full CTA → Temporal → persistence laboratory runtime
```

No web framework test layer is required.

## T0 — Start/session contract

Accept Workflow start with:

- recognized `RegisterNewCustomer` operation;
- businessSlug;
- start/session idempotency identity;
- optional partial Customer draft;
- optional correlation/channel metadata.

Reject before Workflow start only when the registration session itself is structurally invalid, including:

- malformed start envelope;
- unknown operation;
- missing businessSlug;
- missing session idempotency identity;
- invalid attachment transport envelope.

Important: missing policy-required Customer data is **not** a pre-start failure. It must produce a running Workflow waiting for data.

### T0-IDEM-001 exact start replay

Repeat the same:

```text
operation
businessSlug
idempotency key
normalized initial-start fingerprint
```

Expected:

- same logical Workflow/session identity;
- no second registration receipt;
- no second Customer effect;
- later Workflow state remains the authority.

### T0-IDEM-002 same-session conflicting initial start

Use the same `operation`, `businessSlug` and idempotency key but materially change the normalized **initial start snapshot**.

Expected:

```text
secondStartAccepted = false
error = SESSION_IDEMPOTENCY_CONFLICT
additional business effect = 0
```

The initial fingerprint may include the normalized initial Customer draft and initial attachment ingress identity. Later `ProvideCustomerData` Updates do not rewrite that fingerprint.

### T0-IDEM-003 cross-business opaque key isolation

Reuse the same opaque idempotency key value under a different `businessSlug`.

Expected: no idempotency collision solely because the opaque key text is the same. The authority scope is `(operation, businessSlug, idempotencyKeyHash)`.

## T1 — Temporal interaction contract

### RQ-001 Query missing fields

Start with intent-only/partial draft.

Expected:

```text
workflowStarted = true
phase = WAITING_FOR_REQUIRED_DATA
missingFields = policy-defined list
nextAction = PROVIDE_CUSTOMER_DATA
```

### RU-001 ProvideCustomerData Update

Submit a valid patch to the same Workflow.

Expected:

- patch accepted once logically;
- durable draft changes;
- known/missing fields recalculate;
- Query reflects same new state;
- original initial-start fingerprint remains unchanged;
- MongoDB interaction audit is emitted according to policy.

### RU-002 repeated input delivery

Repeat same stable input/Update identity.

Expected: no duplicate logical interaction or duplicate Customer effect.

### RU-003 multiple rounds

Provide data in multiple messages.

Expected: Workflow remains the same execution/session and advances only when policy-required fields are complete.

## T2 — Temporal workflow/runtime

Must use real:

- Temporal Service;
- Task Queue;
- Worker;
- Workflow Execution;
- Event History;
- Activities;
- Query;
- Update;
- retry/restart semantics.

Happy interactive path:

```text
start
→ load registration policy
→ wait for required data
→ receive Update(s)
→ complete draft
→ check existing Customer
→ reserve registration
→ persist Customer or resolve existing Customer
→ persist required audit/context
→ finalize
```

Failure/recovery injection covers:

- Worker restart while `WAITING_FOR_REQUIRED_DATA`;
- Worker restart after Customer persistence;
- PostgreSQL outage during duplicate lookup/create;
- MongoDB outage during required audit;
- AttachmentStore outage when enabled;
- Activity side effect completed but acknowledgement lost;
- CTA disconnect between start/query/update rounds.

Expected: same logical Workflow and no duplicate business effects.

## T3 — PostgreSQL persistence and duplicate policy

Prove:

- Customer projection follows approved TimeSlots semantics;
- `findExistingCustomer` is read-only;
- hard-unique policy match returns existing Customer and creates no second row;
- soft-match policy is distinguishable from hard duplicate;
- name alone does not become a hard uniqueness key;
- registration identity is scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- exact start replay resolves the same registration command;
- same-business conflicting initial-start fingerprint is rejected;
- cross-business reuse of the same opaque key does not collide solely on raw key text;
- session/create idempotency prevents duplicate insert;
- new valid Customer creates exactly one record;
- final result references the correct Customer;
- no Appointment/ResourceReservation/availability mutation occurs.

## T4 — MongoDB interaction/audit

### Success-gating evidence

Prove the applicable logical evidence exists for every successful registration:

- `REGISTRATION_SESSION_STARTED`;
- `REGISTRATION_POLICY_LOADED`;
- `REQUIRED_DATA_REQUESTED` when waiting occurs;
- `CUSTOMER_DATA_ACCEPTED` for each logically accepted external input;
- `DUPLICATE_CHECK_COMPLETED`;
- `EXISTING_CUSTOMER_RESOLVED` for `ALREADY_EXISTS` **or** `CUSTOMER_CREATED` for `CREATED`;
- `ATTACHMENT_COMMITTED` when an enabled case requires/persists attachments;
- `REGISTRATION_COMPLETED`.

The physical document layout is not prescribed, but logical event identity must make retries safe.

### Success rule

A registration cannot be reported as successful while a required success-gating audit milestone is missing.

Inject a MongoDB outage and exhaust the frozen retry policy.

Expected:

```text
workflow does not report CREATED/ALREADY_EXISTS success
failureCode = MONGO_AUDIT_STORE_UNAVAILABLE
Temporal Event History preserves failure evidence
```

`REGISTRATION_FAILED` should be appended when MongoDB is available, but inability to write a failure event to the failed audit store must not prevent Temporal from truthfully exposing the failure.

### Additional audit requirements

Also prove:

- events are queryable by Workflow/correlation/customer where applicable;
- retries do not duplicate logical audit milestones unintentionally;
- individual Activity retry detail is diagnostic and does not itself define success;
- raw attachments are not copied into audit;
- secrets/unrestricted request dumps are absent;
- MongoDB is not the canonical Customer authority.

## T5 — AttachmentStore integration

Once physical technology is selected, prove:

- stage/resolve ingress;
- stable attachment identity;
- SHA-256/length integrity;
- content retrieval/streaming;
- retry after commit returns same logical object;
- expired ingress rejection;
- corruption/hash mismatch detection;
- orphan/reconciliation discovery;
- no storage internals leak into caller contract.

Synthetic fixture binaries and expected hashes must be frozen before attachment runtime cases are certified.

## T6 — Full laboratory scenarios

### LAB-001 Interactive new Customer

```text
Postman/CLI: RegisterNewCustomer intent
→ Temporal WAITING_FOR_REQUIRED_DATA
→ Query shows missing fields
→ CTA sends one or more ProvideCustomerData Updates
→ Temporal CHECKING_EXISTING_CUSTOMER
→ no hard duplicate
→ PostgreSQL Customer created
→ required MongoDB interaction/audit evidence
→ COMPLETED / CREATED
```

Proof includes Temporal Web UI/Event History evidence and database reads.

### LAB-002 Existing Customer

Run LAB-001 once, then open another registration session with data matching a policy-defined hard unique key.

Expected:

```text
CHECKING_EXISTING_CUSTOMER
→ ALREADY_EXISTS
created = false
existing customerId returned
PostgreSQL Customer delta = 0
required audit milestones complete before success
```

### LAB-003 Soft duplicate

Use a policy/data fixture where a phone or email is classified as a soft match.

Expected: Workflow does not silently invent a hard rejection. It exposes the policy-defined possible-duplicate state/outcome.

### LAB-004 CTA disconnect/reconnect

Start Workflow, disconnect CTA while waiting, reconnect and Query/update same Workflow.

Expected: state is preserved.

### LAB-005 Worker restart while waiting

Restart Worker while Workflow is awaiting Customer data.

Expected: same Workflow resumes and still reports the same missing fields.

### LAB-006 PostgreSQL outage

Inject outage during duplicate lookup or create.

Expected: Temporal handles retry/recovery according to Activity policy; CTA does not own retry loop.

### LAB-007 MongoDB outage

Inject audit-store outage while a success-gating milestone is required.

Expected: transient outage may recover through Activity retry; exhausted failure cannot become successful registration.

### LAB-008 Scheduling isolation

Expected:

- Appointment delta = 0;
- ResourceReservation delta = 0;
- AvailabilitySlot mutation delta = 0.

### LAB-009 Same-session start conflict

Start a registration, then retry the same business-scoped session identity with a materially different initial start snapshot.

Expected:

```text
SESSION_IDEMPOTENCY_CONFLICT
same original Workflow/session remains authoritative
additional Customer delta = 0
```

### LAB-010 Cross-business key isolation

Use the same opaque key text for two different `businessSlug` values.

Expected: independent business-scoped registration identities; no false conflict caused solely by the key text.

## Required runtime evidence

Capture:

- git commit SHA;
- Golden Dataset case ID;
- start/session input fixture;
- business-scoped session idempotency identity/hash;
- initial-start fingerprint evidence when replay/conflict is tested;
- Temporal Workflow ID + Run ID;
- Task Queue + Worker evidence;
- Event History showing Query/Update-related workflow progression where applicable;
- state projection before/after each accepted input;
- PostgreSQL duplicate lookup/result and Customer verification;
- MongoDB required interaction/audit evidence;
- attachment metadata/hash when applicable;
- reconnect/restart evidence;
- zero-scheduling assertion.

## Release gate

mk0 is stable only when the complete interactive CTA → full Temporal → persistence laboratory behavior matches predeclared Golden Dataset expectations, including business-scoped idempotency and mandatory audit-before-success semantics.
