# Quarry 04 — Attachment Persistence

## Status

**PROJECT REQUIREMENT CAPTURED / AUTHORITY BOUNDARY DECIDED / PHYSICAL TECHNOLOGY OPEN**

## Project requirement

For `RegisterNewCustomer`:

- Customer/registration business truth → PostgreSQL;
- execution/audit/workflow context → MongoDB;
- optional attachments/documents → separate `AttachmentStore` capability;
- business attachment reference → PostgreSQL.

Classification: `PROJECT_DECISION`.

## Why AttachmentStore is separate

Attachment binaries/documents have different lifecycle, integrity, streaming, retention and retry behavior from canonical Customer relational data and from routine audit/context documents.

Therefore mk0 freezes a capability contract instead of prematurely choosing the physical technology.

Classification: `DESIGN_DECISION`.

## Two truths

### Attachment object truth — AttachmentStore

Owns:

- staged/committed content;
- content hash;
- byte length;
- media type;
- opaque attachment identity;
- storage lifecycle/reconciliation metadata.

### Business reference truth — PostgreSQL

Owns:

- `customerId`;
- opaque `attachmentId`;
- attachment kind/role;
- display metadata;
- hash/length facts needed for verification;
- committed timestamp/link state.

PostgreSQL does not become the raw binary store.

## Physical implementation remains open

Build may evaluate:

- MongoDB GridFS;
- local/object storage;
- another database/storage mechanism appropriate for binary objects.

Any candidate must satisfy:

1. opaque stable IDs;
2. binary-safe writes;
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
CTA attachment ingress
→ AttachmentStore STAGED object
→ opaque ingressRef
→ Temporal command contains ingressRef
→ commitAttachment Activity
→ AttachmentStore COMMITTED object
→ attachmentId + integrity metadata
→ PostgreSQL Customer attachment reference
```

Staging cannot itself mark Customer registration successful.

## Failure windows to test

### F1 — staged, workflow never starts

Expected: ingress expires/cleans up later; no PostgreSQL Customer business side effect from the abandoned command.

### F2 — PostgreSQL Customer base exists, AttachmentStore unavailable

Expected: Activity retries; Customer is not falsely finalized.

### F3 — AttachmentStore commit succeeds, Activity acknowledgement is lost

Expected: retry returns/reuses the same logical attachment identity.

### F4 — AttachmentStore commit succeeds, PostgreSQL reference fails

Expected: retry links the existing attachment; no duplicate object is required.

### F5 — integrity/hash mismatch

Expected: permanent typed failure; mismatched content is not linked as valid; no successful Customer finalization.

### F6 — terminal workflow failure after partial attachment commits

Expected: committed orphan candidates remain discoverable and are handled by explicit reconciliation/retention policy.

## Remaining Build choices

- exact AttachmentStore technology;
- driver/library;
- maximum attachment size/count;
- streaming strategy;
- encryption-at-rest requirements;
- ingress TTL;
- retention/reconciliation cadence;
- backup profile.

These choices may refine implementation but cannot change the authority boundary without a new Design decision.
