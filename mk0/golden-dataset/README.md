# Golden Dataset — mk0

## Version

`mk0.golden.register-customer.v0`

## Purpose

The golden dataset freezes expected behavior **before implementation**.

Each case defines:

- command intent;
- relevant headers;
- input data;
- injected environment/failure condition when applicable;
- expected HTTP acceptance behavior;
- expected Temporal outcome;
- expected MongoDB Customer effect;
- expected MongoDB audit effect;
- expected local attachment-store effect;
- scheduling non-effect.

Implementation is wrong when it disagrees with an approved golden case unless Design and Golden Dataset are intentionally revised first.

---

## Case inventory

### GD-001 — Minimal valid customer

Input:

- businessSlug;
- person name;
- one email;
- no document;
- no attachments.

Expected:

- 202 accepted;
- workflow completes;
- exactly one customer;
- zero attachment references;
- audit milestones present;
- zero Appointment/ResourceReservation side effects.

### GD-002 — Full customer

Input includes:

- document;
- phone;
- email;
- notes.

Expected canonical persisted normalization without inventing missing data.

### GD-003 — One attachment

One valid staged `identity_document`.

Expected:

- one committed local attachment;
- one MongoDB customer attachment reference;
- matching SHA-256;
- no binary embedded in Customer.

### GD-004 — Multiple attachments

Expected:

- every requested attachment committed;
- every committed attachment referenced once;
- customer finalized only after all required links exist.

### GD-005 — Exact idempotent replay

Run GD-001 twice with same `Idempotency-Key` and identical material command.

Expected:

- same logical workflow/outcome;
- one customer only;
- no duplicate logical audit milestones caused solely by the replay;
- no duplicate attachment side effects.

### GD-006 — Idempotency key conflict

Same key, changed material command.

Expected:

- 409 conflict;
- no second customer;
- no second workflow side effect for changed command.

### GD-007 — Invalid request

Missing customer name.

Expected:

- rejected at API edge;
- no workflow start;
- no Customer write;
- no committed attachment.

### GD-008 — Transient Mongo customer-write failure

Injected temporary failure before successful Customer Activity completion.

Expected:

- workflow retries;
- completes after recovery;
- exactly one customer.

### GD-009 — Transient local attachment-store failure

Expected:

- workflow retries attachment commit;
- customer not finalized during failure;
- completes after store recovers;
- one committed attachment.

### GD-010 — Permanent attachment hash mismatch

Expected:

- typed permanent workflow failure;
- no false ACTIVE/success outcome;
- mismatched attachment not linked as valid;
- terminal audit failure event.

### GD-011 — Worker restart

Restart the Temporal worker after Customer base persistence and before finalization.

Expected:

- workflow resumes;
- one customer;
- correct completion;
- no lost accepted command.

### GD-012 — Scheduling isolation

Execute successful registration and explicitly inspect scheduling persistence.

Expected:

- Appointment count delta = 0;
- ResourceReservation count delta = 0;
- AvailabilitySlot mutation delta = 0.

---

## Data rules

Golden fixtures use synthetic people and identifiers only.

Do not place real customer PII in this dataset.

Attachment fixtures, when later added, should be tiny synthetic files with fixed SHA-256 hashes.

---

## Approval rule

`v0` is approved when:

- every case has a machine-readable fixture;
- expected outcomes are reviewed;
- unresolved fields are removed or explicitly marked;
- Design documents and case expectations agree;
- no implementation output was used as the sole reason for expected behavior.

The companion machine-readable manifest is `register-new-customer-v0.json`.
