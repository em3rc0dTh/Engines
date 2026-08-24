# Build — mk0

## Status

**NOT AUTHORIZED YET**

This directory is intentionally documentation-only.

The user decision for mk0 is to design the architecture in detail before implementation. No NestJS application, Temporal worker, MongoDB repository, attachment database, Docker configuration, or Postman collection should be added here until the Build Authorization Gate in `../Plan/README.md` is closed.

## Future build target

When authorized, the implementation must realize exactly this contract:

```text
Postman CTA
→ NestJS Boundary
→ Orchestration Engine / Temporal
→ Persistence
   ├── Customer → MongoDB
   ├── Audit    → MongoDB
   └── Attachment content → local attachment database/store
```

First Workflow:

`RegisterNewCustomer`

## Expected future code boundaries

The following is a **logical target**, not a scaffold to create now:

```text
application-edge/
  nest-api/

orchestration/
  temporal/
    workflows/
    activities/

persistence/
  mongo/
    customers/
    command-receipts/
    execution-audit/
  attachments/
    local-store/

contracts/
  register-new-customer/
```

## Build constraints already frozen

- Postman never accesses persistence directly.
- NestJS controllers do not directly execute the registration persistence sequence.
- Temporal Workflow code contains no direct database/filesystem/network side effects.
- Activities are retry-safe/idempotent.
- Customer data and audit data remain distinct authorities.
- Attachment bytes remain outside MongoDB Customer documents.
- The public API exposes opaque attachment IDs, never host-local paths.
- RegisterNewCustomer creates no Appointment or ResourceReservation.
- Same idempotent command produces one registration outcome.
- Tests and golden cases are written from Design contracts, not reverse-engineered from implementation behavior.

## Authorization record

When Build is approved, update this file with:

- approval date;
- approved Design revision/commit;
- approved Golden Dataset version;
- selected attachment-store technology and ADR;
- selected MongoDB deployment profile for local mk0;
- Temporal development/runtime profile;
- exact Build ticket sequence.

Until then:

> **No code in Build.**
