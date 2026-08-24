# Quarry 04 — Attachment Persistence

## Status

**PROJECT REQUIREMENT CAPTURED / mk0 AUTHORITY DECIDED / PHYSICAL MONGO MECHANISM OPEN**

## Project requirement

The first persistence zone uses PostgreSQL + MongoDB.

For RegisterNewCustomer:

- Customer/registration business truth → PostgreSQL;
- execution/audit/workflow context → MongoDB;
- optional attachments/documents → MongoDB persistence capability;
- business attachment reference → PostgreSQL.

Classification: `PROJECT_DECISION`.

## Why MongoDB owns the optional attachment/document capability

This keeps the first mk0 persistence zone within the selected two technologies while maintaining a clear separation between relational business truth and document/binary lifecycle concerns.

Classification: `DESIGN_DECISION`.

## Two truths

### Document/object truth — MongoDB capability

Owns:

- staged/committed content;
- content hash;
- byte length;
- media type;
- opaque attachment identity;
- document lifecycle/reconciliation metadata.

### Business reference truth — PostgreSQL

Owns:

- `customerId`;
- opaque `attachmentId`;
- attachment kind/role;
- display metadata;
- hash/length facts needed for verification;
- committed timestamp/link state.

PostgreSQL does not become the raw binary store.

## Exact MongoDB mechanism remains open

The Design does not yet freeze GridFS or another MongoDB-backed representation.

Build must compare the implementation options against this contract:

1. opaque stable IDs;
2. binary/document-safe writes;
3. SHA-256 integrity verification;
4. retry-idempotent commit;
5. stream/read capability;
6. metadata query;
7. staged ingress TTL;
8. orphan/reconciliation discovery;
9. explicit retention/cleanup;
10. crash recovery;
11. reasonable local mk0 operation;
12. future migration/export path.

## Binary ingress design

```text
HTTP attachment ingress
→ MongoDB STAGED object
→ opaque ingressRef
→ Temporal command contains ingressRef
→ commitAttachment Activity
→ MongoDB COMMITTED object
→ attachmentId + hash
→ PostgreSQL Customer attachment reference
```

The staging write is technical data-plane persistence. It cannot itself mark the Customer registration successful.

## Failure windows to test

### F1 — staged, workflow never starts

Expected: ingress expires/cleans up later; no PostgreSQL Customer side effect from the abandoned registration command.

### F2 — PostgreSQL Customer base exists, MongoDB unavailable

Expected: Activity retries; Customer is not falsely finalized.

### F3 — MongoDB attachment commits, Activity acknowledgement is lost

Expected: retry returns/reuses the same logical attachment identity.

### F4 — MongoDB attachment commits, PostgreSQL reference fails

Expected: retry links the existing attachment; no duplicate document object is required.

### F5 — integrity/hash mismatch

Expected: permanent typed failure; mismatched content is not linked as valid; no successful Customer finalization.

### F6 — terminal workflow failure after partial attachment commits

Expected: committed orphan candidates remain discoverable and are handled by explicit reconciliation/retention policy.

## Remaining Build choices

- exact MongoDB binary/document mechanism;
- driver/ODM/library;
- maximum attachment size/count;
- streaming strategy;
- encryption-at-rest requirements;
- ingress TTL;
- retention/reconciliation cadence;
- backup profile.

These choices may refine implementation but cannot change the authority boundary without a new Design decision.
