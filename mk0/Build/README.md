# Build — mk0

## Status

**NOT AUTHORIZED YET**

This directory is intentionally documentation-only.

No application framework is selected or required for mk0.

## Future build target

When authorized, Build must realize only:

```text
CTA / controlled entry
   Postman | CLI | minimal test harness
        ↓
Temporal RegisterNewCustomer
        ↓
Persistence Activities
   ├── PostgreSQL → Customer + registration/idempotency truth
   ├── MongoDB    → execution/audit/workflow context
   └── AttachmentStore → optional binary/document persistence
```

## Preferred first runtime proof

The cheapest valid proof is acceptable:

```text
CLI/test harness
→ Temporal client
→ Temporal worker
→ PostgreSQL + MongoDB
```

Postman may be added through the thinnest practical adapter only if it improves testing. That adapter must not own orchestration or business persistence.

## Expected logical boundaries

```text
contracts/
  register-new-customer/

cta/
  cli-or-test-client/

orchestration/
  temporal/
    workflows/
    activities/

persistence/
  postgres/
    customer/
    registration-command/
    attachment-reference/

  mongo/
    execution-audit/
    workflow-context/

  attachments/
    attachment-store-adapter/
```

This is conceptual and does not authorize scaffolding yet.

## Frozen constraints

- no framework dependency in the architecture;
- CTA validates structural input before Temporal start;
- CTA never writes persistence directly;
- Temporal owns durable sequencing;
- Workflow code calls no DB/file/network driver directly;
- Activities are retry-safe/idempotent;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- Customer persistence follows approved DataModel v3 / TimeSlots semantics;
- MongoDB stores execution/audit/workflow context, not a shadow Customer truth;
- attachments use a separate persistence contract;
- CTA disconnect must not stop an accepted workflow;
- CTA reconnect/query must resolve the same durable outcome;
- RegisterNewCustomer creates zero scheduling side effects.

## Authorization record

When Build is approved, record:

- approval date;
- approved Design commit;
- approved Golden Dataset version;
- Temporal runtime topology;
- PostgreSQL topology;
- MongoDB topology;
- chosen AttachmentStore technology if attachment cases are enabled;
- chosen minimal CTA harness;
- exact Build ticket sequence.

Until then:

> **No code in Build.**
