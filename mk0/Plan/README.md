# Plan — MK0

## Planning state

**CLOSED**

MK0 has completed its intended planning/build/certification cycle.

The authoritative final ledger is:

[`mk0-gate-status.md`](mk0-gate-status.md)

## What was planned and proven

```text
M0–M6 architecture/contracts                  ✅ closed
B0–B7 Customer foundation                     ✅ certified
Customer Golden effective accounting          ✅ 18 / 18 PASS
Physical Customer Postman laboratory           ✅ 37 / 37 PASS
Observability / Lab Console                    ✅ certified
Second specimen RegisterNewAppointment         ✅ certified
Workflow composition through Child Workflow   ✅ proven
Production deployment                          ❌ outside MK0
```

## Planning history retained

Historical decision/approval records remain in this folder:

- [`pre-build-review-2026-08-24.md`](pre-build-review-2026-08-24.md)
- [`pre-build-approval-2026-08-24.md`](pre-build-approval-2026-08-24.md)
- [`pre-build-approval-template.md`](pre-build-approval-template.md)
- [`b7-attachmentstore-authority-decision.md`](b7-attachmentstore-authority-decision.md)
- [`b7-approval-2026-08-25.md`](b7-approval-2026-08-25.md)

These remain provenance; they do not override the final closure ledger.

## Final MK0 architecture decision

```text
replaceable channel / CTA
→ canonical operation
→ Temporal durable Workflow
→ Activities / explicit ports
→ PostgreSQL + MongoDB + AttachmentStore
```

The second specimen added one crucial proof:

```text
RegisterNewAppointment
→ reuses RegisterNewCustomer as Child Workflow when needed
→ does not duplicate Customer persistence authority
```

## Planning lessons carried forward

Future Engines stages should explicitly freeze:

1. operation contract;
2. authority boundaries;
3. Temporal interaction model;
4. persistence effects;
5. failure/recovery semantics;
6. mining-site/quarry evidence;
7. Golden expectations **before Build** when a Golden gate is planned;
8. build/certification gates;
9. evidence provenance.

The Appointment specimen's repository expectation manifest was captured after implementation and is therefore explicitly labelled a post-certification closure manifest. That history must not be rewritten.

## What is not authorized by MK0 closure

MK0 completion does not automatically authorize:

- production deployment;
- public exposure/security hardening;
- final Scheduler/ResourceReservation model;
- Agent/Hermes;
- Services Engine as a separate subsystem;
- Integration Engine;
- arbitrary new Workflows;
- final product UI/control room.

Those require a new planning cycle.

## Repository integration

The completed cumulative state is consolidated on:

```text
release/mk0-complete
```

and should integrate to `main` through one canonical closure PR. Historical stage PRs are provenance rather than independent pending releases.

> **MK0 planning is complete. New work should begin from the certified MK0 reference, not continue expanding MK0 indefinitely.**
