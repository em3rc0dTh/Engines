# Test — MK0

This folder contains test contracts and certification notes for the MK0 specimens.

## Specimen test documents

1. [`register-new-customer.md`](register-new-customer.md) — original detailed Customer test contract covering start/session semantics, Temporal durability, PostgreSQL, MongoDB, AttachmentStore, recovery and full laboratory scenarios.
2. [`register-new-appointment.md`](register-new-appointment.md) — second-specimen test contract covering Customer reuse/Child Workflow, catalog, dates, availability, explicit finalization and slot conflict behavior.

## Evidence index

Runtime receipts are indexed separately under:

[`../Build/evidence/README.md`](../Build/evidence/README.md)

Keeping Test and Evidence separate matters:

```text
Test = what must be true
Evidence = what was actually observed against an identified runtime revision
```

## MK0 test discipline

```text
UNKNOWN != PASS
documented != verified
observed != supported
CI green != product-ready unless the gate proves the claim
```

Future Engines stages should freeze their test/Golden expectations before Build when possible. The Appointment closure manifest explicitly records that its formal repository expectation manifest was captured post-certification rather than retroactively pretending it was predeclared.
