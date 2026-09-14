# Pre-Scheduler node + edge certification contract

Date: 2026-09-14
Baseline: `feature/layer6-v4-persistence-complete` @ `4c0b8844bc5f3499df83cda005c2690533433f90`
Target: certify every already-built platform node and every already-built cross-node edge before beginning Step 4 / Scheduler Engine.

## Rule

This gate is a closure/certification gate. It must not add Scheduler semantics, new booking policy, new provider business logic, or new persistence ownership. A green result means the already-built platform slice composes correctly on one candidate head.

## Nodes in scope

| Node | Responsibility | Required proof |
|---|---|---|
| N0 Foundation contracts | frozen Customer, CLI, Attachment and Appointment contracts | type-check + protected regression suites |
| N1 Provider adapters | WebChat, Telegram, WhatsApp, API plus already-landed Meta/TikTok deterministic adapter behavior | provider/adapter tests + canonical tests |
| N2 Compatibility layer | provider envelope → `CanonicalCTAEvent` without taking provider authentication ownership | cross-adapter canonical parity + canonical tests |
| N3 CTA ingress/router | stable CTA identity, ingress lifecycle, deterministic `register_appointment` route | CTA tests + real CTA orchestration probe |
| N4 Temporal Appointment orchestration | durable appointment conversation, replay, slot race, failure/compensation | real CTA orchestration probe |
| N5 Services Engine / G1 | contracts, persistence, reads, eligibility, management, snapshots, multi-business, Appointment integration | S8 clean closure over S1–S7 |
| N6 PostgreSQL operational graph | Customer → ManagedEntity → OperationalCase → Appointment → ResourceReservation | real CTA orchestration + DB invariant proof |
| N7 MongoDB operational document layer | v4 direct/observation inputs, context, provenance/audit | Layer 6 v4 proof |
| N8 Object storage | S3-compatible stage → commit → read integrity with exclusive evidence ownership | Layer 6 MinIO proof |

## Edges in scope

| Edge | Contract | Required proof |
|---|---|---|
| E1 Provider → Adapter | provider-specific parsing/verification remains at adapter/transport boundary | adapter regressions; invalid API identity fails closed |
| E2 Adapter → Compatibility | trusted `businessSlug` + normalized channel envelope cross the boundary | cross-adapter parity test |
| E3 Compatibility → Canonical CTA | one `register_appointment` domain intent, stable replay identity | canonical parity + replay test |
| E4 Canonical CTA → Router/Dispatcher | deterministic `RegisterNewAppointment` routing, no provider branch in Temporal | parity route test + static provider-leak guard |
| E5 Router/Dispatcher → Temporal | CTA dispatch starts/reuses the canonical workflow | real CTA orchestration probe |
| E6 Temporal Appointment → Services Engine | service/offering authority comes from canonical Services reads; revision snapshot remains stable | S7 proof inside S8 |
| E7 Temporal → PostgreSQL | workflow materializes and binds the operational appointment graph | CTA orchestration DB invariants |
| E8 Workflow/audit → MongoDB | operational inputs/context/provenance are persisted with stable identities | Layer 6 v4 proof |
| E9 Observation → Attachment/Object store | one observation owns its evidence object; SHA-256 content identity survives commit/read/replay | Layer 6 v4 proof |
| E10 Delivery replay → Idempotency | same provider delivery does not duplicate ingress/workflow/appointment | canonical replay + CTA orchestration replay proof |
| E11 Failure after HELD → Compensation | failed booking path releases reservation and does not leave a successful partial appointment | CTA orchestration compensation proof |

## S8 — final Services Engine G1 closure

S8 is the missing formal closure after the already-certified S0–S7 sequence. It must rerun protected contract regressions and then prove the runtime gates from pristine laboratories so test-state contamination cannot masquerade as a product failure.

The closure sequence is:

1. pristine inherited Appointment laboratory;
2. pristine S1 persistence proof;
3. pristine S2 deterministic read proof;
4. pristine S3 eligibility/recommendation proof;
5. pristine S4 management + rejection-safety proof followed by S5 running-workflow snapshot/restart proof;
6. pristine S6 multi-business proof;
7. pristine S7 Appointment ↔ Services integration proof;
8. terminal `SERVICES_S8_G1_CERTIFICATION_PASS` only after every prior step passes.

## Aggregate pre-Scheduler gate

The aggregate CI must independently pass three certification axes on the same candidate head:

- static/frozen contracts + channel/compatibility boundaries;
- Services G1 S8 clean closure;
- CTA/Temporal/PostgreSQL/MongoDB/Object Store real persistence composition.

Only after all three are green may the terminal marker be emitted:

```text
PRE_SCHEDULER_NODE_EDGE_CERTIFICATION_PASS
```

## Canonical receipts

After a successful gate, current certification status is recorded in:

```text
mk1/Test/g1-services-engine-s0-s8.md
mk1/Build/evidence/pre-scheduler-node-edge-certification-2026-09-14.md
mk1/Plan/04-platform-steps-3-4-5-roadmap.md
```

The certification contract, final receipt and roadmap must agree before the candidate is treated as sealed. Any documentation-only head that changes these receipts must itself rerun this gate before replacing the prior certified head.

## Truth boundary

This gate certifies the platform slice that exists before Scheduler Engine work begins. It does not certify Scheduler availability/capacity/holds as a standalone engine, Integration Engine providers, production HA/backup/restore, production cloud credentials, Agent/MCP, or general production readiness.

Official external-network transport proofs are not silently replaced by deterministic tests. Existing physical/official transport receipts remain separate evidence; this closure gate protects the deterministic adapter/compatibility/domain boundary and the real internal orchestration/persistence graph.