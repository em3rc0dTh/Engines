# G0 — Core Blocks 1 / 2 / 6 Audit Closure

Date: 2026-08-31 (America/Lima)

Status: **G0 PASS — FOUNDATION CLAIMS FROZEN**

## Scope

G0 is a repository/evidence audit. It introduces no runtime behavior and does not reinterpret documentation-only commits as executed source revisions.

Its purpose is to establish the exact Stage-2 claim boundary before Services Engine and Scheduler Engine work begins.

## Canonical source base

```text
MK0 release branch   release/mk0-complete
MK0 release SHA      ae6588b63ede87d36a32b51363dfe96585c9b0df
Stage-2 stable base  main
Stage-2 base SHA     9c0fab032461e889f3d9d297b2d2b375288afda3
```

`main` is the MK0 closure merge commit and has no file differences from the certified release tree.

## Evidence chain reviewed

### Block 1 — CTA

- B3 CLI CTA certification;
- full local Postman physical receipt;
- CTA adapters/ports in the frozen MK0 tree;
- architecture contract prohibiting channel-owned business persistence.

Result:

```text
CTA replaceability architecture     CERTIFIED
CLI                                 CERTIFIED
HTTP/Postman                        CERTIFIED
future omnichannel implementations OPEN
```

### Block 2 — Orchestration

- B2 real Temporal continuity certification;
- RegisterNewCustomer Golden + physical certification;
- RegisterNewAppointment clean Compose certification;
- Child Workflow composition;
- Query/Update interaction;
- Activity-only side-effect boundaries;
- replay/recovery/idempotency/slot-race evidence.

Result:

```text
Temporal durable spine                     CERTIFIED
RegisterNewCustomer                         CERTIFIED
RegisterNewAppointment                      CERTIFIED
Child Workflow reuse                        CERTIFIED/PROVEN
Explicit deterministic operation routing   PROVEN
natural-language intent classification      ABSENT
reschedule/cancel workflow lifecycle        ABSENT
service recommendation capability           NOT CERTIFIED
```

### Block 6 — Persistence

- B5 PostgreSQL authority certification;
- B6 mandatory Mongo audit certification;
- B7 AttachmentStore certification/evidence index;
- Appointment PostgreSQL/Mongo persistence evidence;
- atomic booking conflict invariant.

Result:

```text
PostgreSQL authority              CERTIFIED
MongoDB semantic audit            CERTIFIED
local AttachmentStore             CERTIFIED
S3/MinIO production adapter       ABSENT / NOT CERTIFIED
future engine persistence breadth INCREMENTAL
```

## G0 closure decision

The Stage-2 foundation claim is now frozen as:

> **Engines has a certified CTA boundary, certified durable Temporal orchestration spine and certified persistence authority split. These foundations are complete enough to build on without reopening MK0. Full channel breadth, generalized intent routing, a larger workflow library and production storage adapters remain separate future capabilities and must not be implied by the foundation certification.**

## Carry-forward regression boundary

Services Engine and Scheduler Engine work must preserve:

1. CTA never becomes business authority.
2. Temporal remains durable orchestration authority.
3. Workflow code performs side effects only through Activities/ports.
4. PostgreSQL remains canonical transactional truth.
5. MongoDB remains semantic audit/context rather than shadow business truth.
6. AttachmentStore remains the binary/document authority.
7. exact replay cannot create a second business effect.
8. audit-before-success remains mandatory where the workflow contract requires it.
9. availability presentation cannot bypass atomic final capacity validation.
10. new workflows must compose existing certified capabilities rather than duplicate them.

## Stage transition

```text
G0 — Core 1/2/6 completeness audit    ✅ CLOSED
G1 — Services Engine                  ⏭ NEXT
G2 — Scheduler Engine                 ⏭ AFTER SERVICES
G3 — New CTA proof                    ⏭ AFTER ENGINE CERTIFICATION
```

Telegram remains a preferred brainstorming candidate for G3, not an execution dependency for G1/G2.

## Provenance rule

No new runtime certification is claimed by this receipt. Runtime claims continue to point to the exact historical MK0 source SHAs and GitHub Actions/manual receipts that executed them.

This G0 receipt certifies only the **classification and closure decision** for Stage 2.
