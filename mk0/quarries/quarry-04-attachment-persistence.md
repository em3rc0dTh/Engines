# Quarry 04 — Attachment Persistence

## Status

**PROJECT REQUIREMENT CAPTURED / TECHNOLOGY OPEN**

## Project requirement

When RegisterNewCustomer includes attachments:

- customer business data is persisted in MongoDB;
- application/workflow log is persisted in MongoDB;
- attachment binary content is persisted in another local database/store.

Classification: `PROJECT_DECISION`.

---

## Design interpretation

Attachments require two different truths:

### Binary truth

Owned by the local attachment database/store:

- bytes;
- integrity hash;
- size;
- media type;
- opaque storage identity.

### Business reference truth

Owned by the MongoDB Customer record:

- opaque attachment ID;
- attachment kind/role;
- display metadata;
- integrity hash;
- committed timestamp.

MongoDB should not embed the binary content in the Customer document.

Classification: `DESIGN_DECISION`.

---

## Why technology remains open

The user specified a separate local database, but not which one.

Selecting SQLite, filesystem+index, embedded object DB, or another technology before the contract is frozen would make the storage engine drive the architecture.

mk0 instead freezes the required interface first.

Classification: `DESIGN_DECISION`.

---

## Required local-store properties

A Build candidate must be evaluated against:

1. deterministic opaque IDs;
2. binary-safe writes;
3. atomic commit of one attachment object where possible;
4. integrity hashing;
5. idempotent retry semantics;
6. ability to read/stream content;
7. metadata query;
8. orphan/staged-data discovery;
9. explicit cleanup/retention;
10. crash recovery;
11. reasonable local development ergonomics;
12. migration/export path.

---

## Binary ingress problem

Temporal should coordinate attachment persistence, but Workflow payload/history should not become the binary storage channel.

Therefore mk0 proposes an ingress lifecycle:

```text
HTTP binary ingress
→ opaque ingressRef
→ Temporal command contains ingressRef
→ Activity resolves ingressRef
→ local attachment store commit
→ attachmentId + hash
→ MongoDB customer reference
```

Classification: `DESIGN_PROPOSAL`.

The exact ingress staging technology must be selected during Build planning.

---

## Failure windows to test

### F1

Ingress accepted, Workflow never starts.

Expected:

- staged object expires/cleans up later;
- no Customer side effect.

### F2

Customer base persisted, attachment commit fails transiently.

Expected:

- workflow retries;
- customer not finalized early.

### F3

Attachment committed, Activity completion lost.

Expected:

- retry resolves same committed object;
- no accidental duplicate logical attachment.

### F4

Attachment committed, Mongo link fails.

Expected:

- retry links existing attachment;
- committed object remains discoverable.

### F5

Hash mismatch.

Expected:

- permanent typed failure;
- no false success;
- corrupt/mismatched content not linked as valid.

### F6

Workflow fails permanently after one of several attachments commits.

Expected:

- committed orphan candidates are discoverable;
- cleanup is explicit/reconcilable, not silent deletion during retry.

---

## Open decision for Build gate

Choose and record the local attachment-store technology in an ADR only after comparing candidates against this contract.

Until then:

> `AttachmentStore` is a capability contract, not a product name.
