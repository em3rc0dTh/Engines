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
→ persist Customer
→ audit/context
→ finalize
```

Failure/recovery injection covers:

- Worker restart while `WAITING_FOR_REQUIRED_DATA`;
- Worker restart after Customer persistence;
- PostgreSQL outage during duplicate lookup/create;
- MongoDB outage during audit;
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
- session/create idempotency prevents duplicate insert;
- new valid Customer creates exactly one record;
- final result references the correct Customer;
- no Appointment/ResourceReservation/availability mutation occurs.

## T4 — MongoDB interaction/audit

Prove required application evidence for:

- registration session started;
- policy loaded/version;
- required data requested;
- Customer data accepted;
- duplicate check classified;
- existing Customer resolved OR new Customer persisted;
- registration completed/failed.

Also prove:

- events are queryable by Workflow/correlation/customer where applicable;
- retries do not duplicate logical audit milestones unintentionally;
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
→ MongoDB interaction/audit evidence
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

Inject audit-store outage under the frozen mandatory/diagnostic policy.

Expected: no silent loss or false success relative to that policy.

### LAB-008 Scheduling isolation

Expected:

- Appointment delta = 0;
- ResourceReservation delta = 0;
- AvailabilitySlot mutation delta = 0.

## Required runtime evidence

Capture:

- git commit SHA;
- Golden Dataset case ID;
- start/session input fixture;
- stable session idempotency identity/hash;
- Temporal Workflow ID + Run ID;
- Task Queue + Worker evidence;
- Event History showing Query/Update-related workflow progression where applicable;
- state projection before/after each accepted input;
- PostgreSQL duplicate lookup/result and Customer verification;
- MongoDB interaction/audit evidence;
- attachment metadata/hash when applicable;
- reconnect/restart evidence;
- zero-scheduling assertion.

## Release gate

mk0 is stable only when the complete interactive CTA → full Temporal → persistence laboratory behavior matches predeclared Golden Dataset expectations.
