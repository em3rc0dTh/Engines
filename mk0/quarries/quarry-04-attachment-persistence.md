# Quarry 04 — Attachment Persistence

## Status

**PROJECT REQUIREMENT CAPTURED / mk0 TECHNOLOGY DECIDED**

## Project requirement

When RegisterNewCustomer includes attachments:

- customer business data is persisted in MongoDB;
- application/workflow log is persisted in MongoDB;
- attachment binary content is persisted in another local database.

Classification: `PROJECT_DECISION`.

---

## Design decision

For mk0 the separate local attachment database is:

> **SQLite**, behind an `AttachmentStore` infrastructure contract.

Classification: `DESIGN_DECISION`.

This does not make SQLite part of the public API or permanent product identity. A later store can replace it if it preserves the contract and attachment identities/migration path.

---

## Two truths

### Binary truth — SQLite

Owns:

- staged and committed bytes;
- integrity hash;
- size;
- media type;
- opaque storage identity;
- storage lifecycle state.

### Business reference truth — MongoDB Customer

Owns:

- opaque attachment ID;
- attachment kind/role;
- display metadata;
- integrity hash;
- committed timestamp.

MongoDB Customer documents do not embed the binary content.

---

## Required SQLite properties

The implementation must satisfy:

1. opaque stable IDs;
2. binary-safe writes;
3. atomic row/object commit where possible;
4. SHA-256 integrity verification;
5. idempotent Activity retry semantics;
6. content read/stream capability;
7. metadata query;
8. staged/orphan discovery;
9. explicit retention/cleanup;
10. crash recovery;
11. reasonable local development ergonomics;
12. migration/export path.

---

## Binary ingress design

Temporal coordinates commitment, but its Workflow history is not the binary transport/store.

mk0 uses:

```text
HTTP binary ingress
→ SQLite attachment_ingress / STAGED
→ opaque ingressRef
→ Temporal command contains ingressRef
→ Activity resolves ingressRef
→ SQLite attachments / COMMITTED
→ attachmentId + hash
→ MongoDB customer reference
```

Classification: `DESIGN_DECISION`.

The staging write is transport data-plane persistence. It does not make the attachment a committed Customer attachment and cannot finalize Customer registration.

---

## Failure windows to test

### F1 — staged, no workflow

Expected:

- staged row expires/cleans up later;
- no Customer side effect.

### F2 — customer base persisted, SQLite unavailable

Expected:

- Activity retries;
- Customer is not finalized early.

### F3 — SQLite attachment committed, Activity completion lost

Expected:

- retry resolves the same committed attachment identity;
- no accidental duplicate logical attachment.

### F4 — SQLite committed, Mongo reference fails

Expected:

- retry links existing attachment;
- committed object remains discoverable.

### F5 — hash mismatch

Expected:

- permanent typed failure;
- no false registration success;
- mismatched content is not linked as valid.

### F6 — workflow terminally fails after partial attachment commits

Expected:

- committed orphan candidates are discoverable;
- cleanup is explicit/reconcilable, not silent deletion during retry.

---

## Remaining Build choices

Still intentionally open:

- Node SQLite driver/library;
- migration library;
- maximum attachment size/count;
- BLOB streaming strategy;
- encryption-at-rest requirements;
- backup/retention profile;
- ingress TTL;
- cleanup/reconciliation cadence.

Those choices must not change the Design contract above.
