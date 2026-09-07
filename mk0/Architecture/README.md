# MK0 Architecture Index

MK0 predates the explicit `Architecture/` folder convention; its normative architecture artifacts remain preserved under `mk0/Design/` and must not be destructively moved after certification.

This index exists so MK0, MK1 and future generations share the same visible lifecycle vocabulary:

```text
Brainstorming
→ Mining Site / Quarries
→ Architecture
→ Design
→ Plan
→ Golden expectations
→ Build
→ Test / Evidence
→ Certification
```

## Canonical MK0 architecture

```text
channels / lab clients
        ↓
    CTA adapter
        ↓
canonical operations
        ↓
Temporal durable Workflow library
        ↓
Activities / Ports
   ├─ PostgreSQL business truth
   ├─ MongoDB semantic/audit context
   └─ AttachmentStore binary/document truth
```

Primary normative sources remain in `../Design/`; this folder is an index only and does not create a new MK0 runtime authority.

Frozen MK0 invariants include channel replaceability, Temporal orchestration authority, explicit persistence boundaries, idempotent business effects, durable recovery and atomic final capacity revalidation for appointment persistence.
