# MK0 Gate Status — CLOSED

## Final authority state

**MK0 OBJECTIVE COMPLETE**

Date of closure: `2026-08-26`

MK0 is frozen as the certified local orchestration laboratory for Engines.

It is no longer an open Build stage and should not accumulate unrelated product features.

## Closure question

MK0 was created to determine whether a reusable orchestration spine could be proven with real execution.

Required proof:

```text
replaceable channel
→ CTA Adapter
→ Temporal durable Workflow
→ Activities
→ separate persistence authorities
→ durable result / recovery / audit
```

A single successful Workflow was not sufficient. The architecture also had to be reusable by a second specimen.

## Final gate matrix

| Gate | Verdict | Evidence |
|---|---|---|
| B0 runtime skeleton | PASS | B0 certification receipt |
| B1 contracts / policy | PASS | B1 certification receipt |
| B2 Temporal continuity | PASS | B2 certification receipt |
| B3 CTA boundary | PASS | B3 certification receipt |
| B4 durable Customer interaction | PASS | B4 certification receipt |
| B5 PostgreSQL authority | PASS | B5 certification receipt |
| B6 mandatory Mongo audit/finalization | PASS | B6 certification receipt |
| B7 AttachmentStore | PASS | B7 Compose runtime receipt |
| Customer Golden effective accounting | 18/18 PASS | 14 core + 4 B7 cases |
| Physical Customer Postman laboratory | 37/37 PASS | local certification receipt |
| Lab Console / trace | PASS | active trace gate + physical use |
| Explicit finalization/contact/phone semantics | PASS | trace/contact/phone certifications |
| Second specimen design | CLOSED | `Design/07-register-new-appointment-specimen.md` |
| RegisterNewAppointment clean Compose | PASS | Actions run `33014515270` |
| Customer Child Workflow reuse | PASS | `APPOINTMENT_NEW_CUSTOMER_CHILD_PASS` |
| Catalog Service/Product reads | PASS | `APPOINTMENT_CATALOG_PASS` |
| Past date rejection | PASS | `APPOINTMENT_PAST_DATE_REJECTED` |
| Human weekday normalization + slots | PASS | `APPOINTMENT_DATE_AND_SLOTS_PASS` |
| Appointment persistence | PASS | `APPOINTMENT_BOOKING_PASS` |
| Appointment idempotency replay | PASS | `APPOINTMENT_IDEMPOTENCY_REPLAY_PASS` |
| Atomic same-slot conflict | PASS | `APPOINTMENT_SLOT_CONFLICT_PASS` |
| MK0 architecture objective | **COMPLETE** | both specimens + evidence chain |

## Customer evidence nuance

The Customer Golden result is truthfully expressed as:

```text
14 attachment-free cases certified in integrated core run
+
4 attachment cases certified in B7 runtime
=
18 / 18 effective Golden PASS
```

Do not rewrite this as one historical 18-case Actions execution; that artifact does not exist.

## Appointment evidence

Exact automated second-specimen source:

```text
70ab427f34bf353a7239f2f87bbe3b4889ec1efd
```

Run:

```text
33014515270
```

Artifact:

```text
mk0-register-new-appointment-33014515270
artifact id 9623938890
sha256 768865e38e86d04a761dfd2bb0141f9441c29902144ea5fc1cd1e8391a77e1a2
```

Primary receipt:

[`../Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md`](../Build/evidence/mk0-register-new-appointment-certification-2026-08-26.md)

## Frozen authority boundaries

### Temporal

Owns:

- durable sequencing;
- Workflow state/history;
- Query/Update/Child Workflow semantics;
- retry/replay/recovery.

### PostgreSQL

Owns canonical business truth including the MK0 schemas for:

- Customers;
- registration/idempotency commands;
- Customer attachment references;
- Service catalog;
- Product catalog;
- laboratory availability rules;
- appointment commands;
- Appointments.

### MongoDB

Owns semantic application audit/context:

```text
execution_audit
appointment_audit
```

It is not shadow Customer/Appointment truth and does not replace Temporal Event History.

### AttachmentStore

Owns staged/committed binary object integrity and lifecycle.

### CTA / channels

Own transport parsing, syntax validation, normalization and Temporal client calls. They do not own direct business persistence.

## Frozen lessons carried forward

1. `UNKNOWN != PASS`.
2. Documentation is not runtime evidence.
3. A legal incomplete conversation may be durable.
4. Invalid external syntax should be rejected at the earliest truthful boundary.
5. Workflow replay compatibility must be preserved when changing durable semantics.
6. Minimum data completeness and human finalization are separate concepts.
7. Child Workflow composition is preferred over duplicating an existing capability's authority.
8. Displayed availability is not reservation.
9. Capacity must be revalidated atomically at persistence time.
10. Workflow code remains free of direct external drivers.
11. Persistence stores keep distinct authority boundaries.

## Explicit non-claims

MK0 closure does not certify:

- production deployment;
- internet/public security posture;
- final authentication/authorization model;
- every possible CTA/channel;
- final Scheduler/TimeSlots implementation;
- ResourceReservation hold/expiry/capacity model;
- Agent/Hermes;
- Services Engine as a standalone product subsystem;
- Integration Engine;
- final product UI/control room;
- completion of the broader Engines platform.

## Repository integration state

The cumulative MK0 implementation is consolidated on:

```text
release/mk0-complete
```

Historical stage branches and PRs are retained only as provenance. They are not independent pending product releases.

Historical B0–B6 CI workflow definitions are archived under:

```text
mk0/Build/ci-archive/
```

The integration target is `main` through one canonical MK0 closure PR.

## Next gate

There is intentionally **no automatic MK1 scope** defined by this file.

Any next product stage should begin again with:

```text
Brainstorming
→ Mining Site / Quarries
→ Design
→ Plan
→ predeclared Golden expectations
→ Build
→ Test / Evidence
```

and should reuse MK0 as the architecture reference rather than extend MK0 indefinitely.

> **Final verdict: MK0 COMPLETE. Engines platform development may proceed from this certified reference.**
