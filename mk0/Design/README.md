# Design — mk0

This folder freezes the design of the first stable vertical before code exists.

## Design package

1. [`01-system-architecture.md`](01-system-architecture.md)
   - component responsibilities;
   - authority boundaries;
   - sequence of control;
   - forbidden couplings.

2. [`02-register-new-customer-contract.md`](02-register-new-customer-contract.md)
   - API command contract;
   - request/response envelope;
   - normalization;
   - idempotency;
   - error taxonomy.

3. [`03-temporal-workflow.md`](03-temporal-workflow.md)
   - workflow state machine;
   - Activity boundaries;
   - retry/recovery semantics;
   - workflow identity;
   - observability contract.

4. [`04-persistence-boundaries.md`](04-persistence-boundaries.md)
   - MongoDB customer authority;
   - MongoDB audit authority;
   - attachment authority;
   - cross-store consistency;
   - attachment integrity.

5. [`05-mk0-persistence-profile.md`](05-mk0-persistence-profile.md)
   - MongoDB physical collections for customer/idempotency/audit;
   - SQLite local attachment database;
   - attachment ingress staging;
   - committed attachment BLOB semantics;
   - crash-window recovery.

## Design acceptance gate

Design is considered closed only when all statements below are true:

- A Postman request has exactly one legal business-command entry path.
- NestJS responsibility ends before durable sequencing begins.
- The Temporal Workflow can be replayed without direct side effects in Workflow code.
- Every business persistence side effect has an explicit Activity/port boundary.
- Customer data and audit data have different MongoDB collections/contracts.
- Attachment binary storage is SQLite-local and outside MongoDB Customer documents.
- Staged attachment ingress cannot itself finalize a customer attachment.
- Optional attachments have deterministic retry behavior.
- Idempotency prevents duplicate customer creation.
- `RegisterNewCustomer` cannot create scheduling entities implicitly.
- Test cases can be derived from the design without looking at implementation.
- The golden dataset can express all success, duplicate, invalid, attachment, and failure cases.

## Rule

When implementation begins, code must conform to these documents. If runtime evidence forces a change, update Design first and record the reason in a quarry/mining artifact rather than silently drifting the code.
