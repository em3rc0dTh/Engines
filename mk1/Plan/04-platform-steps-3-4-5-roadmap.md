# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**DESIGN ROADMAP — BUILD NOT STARTED FOR SCHEDULER/INTEGRATION**

This roadmap advances the architecture shown in the platform diagram while preserving current certified work.

## Current certified baseline

```text
Step 1 CTA / Channels
  WebChat C1A+C1B                       ✅ CERTIFIED + HUMAN VERIFIED
  Telegram C2                           DESIGN/BUILD PREP

Step 2 Temporal Orchestration           ✅ FOUNDATION CERTIFIED

Step 3 Services Engine
  S0–S5                                 ✅ CERTIFIED
  S6–S8                                 OPEN

Step 4 Scheduler Engine                 DESIGN NOW

Step 5 Integration Engine               BOUNDARY DESIGN NOW / BUILD LATER
```

## Track A — Services completion

```text
S6 Multi-business generality
S7 Appointment integration with new Services contract
S8 final clean G1 certification
```

Before S7 closes, the Appointment flow must consume canonical Services snapshots rather than legacy assumptions. Do not couple S7 to a non-existent Scheduler implementation beyond the frozen handoff contract.

## Track B — Scheduler design/build

Proposed gates:

```text
G2-S0 Contract + persistence foundation
G2-S1 Resource/capability/schedule management
G2-S2 Deterministic availability engine
G2-S3 Atomic reservation + concurrency conflict
G2-S4 Holds + expiry + replay
G2-S5 Multi-business generality
G2-S6 Services snapshot/demand integration
G2-S7 Appointment Workflow integration
G2-S8 Multi-resource assignment proof or explicit deferral
G2-S9 Final clean Scheduler certification
```

### G2-S0

Deliver:

```text
SchedulerResource
ResourceCapability
ScheduleTemplate
ScheduleOverride
SchedulingDemand
SlotCandidate
Hold
Reservation
PostgreSQL schema
contract tests
```

No Appointment rewrite yet.

### G2-S1

Certify versioned/idempotent management of resources and schedule definitions.

### G2-S2

Certify deterministic read-only availability generation from schedules, overrides, capabilities, capacity and existing allocations.

### G2-S3

Certify the critical invariant:

```text
two concurrent confirmations for last capacity
→ exactly one success
→ exactly one typed conflict
→ no partial second business effect
```

### G2-S4

Add expiring holds and prove replay/restart semantics.

### G2-S5

Run materially different business fixtures through the same Scheduler implementation with zero vertical branches.

### G2-S6

Feed Scheduler from immutable Services `SchedulingDemand` derived from frozen Offering revisions. Prove catalog head N+1 does not silently change an active scheduling demand from N.

### G2-S7

Migrate `RegisterNewAppointment`:

```text
Services selection
→ SchedulingDemand
→ QueryAvailability
→ selected candidate
→ optional hold
→ explicit Finalize
→ ConfirmReservation
→ Appointment result references Scheduler reservation
```

Preserve `availability shown != reservation persisted`.

## Track C — Integration boundary

Do not build a broad provider platform yet.

Prepare common contracts first, then choose the first concrete integration from actual product need.

Likely first implementations:

```text
payment provider
or
notification provider
```

Future gate shape:

```text
I0 Integration command/event contracts
I1 connection/provider registry + secret references
I2 durable outbound command/retry ledger
I3 authenticated inbound webhook/idempotency ledger
I4 first real provider adapter
I5 Temporal composition + failure/recovery proof
```

## Track D — Telegram C2

Telegram proceeds independently of Scheduler/Integration implementation.

Before physical/manual bot testing, build synthetic deterministic proof:

```text
TelegramAdapter
trusted route config
Telegram update identity
text + callback normalization
reuse ChannelExecutionCore
reuse channel_conversation_bindings
reuse channel_inbound_events
bot-process restart recovery
full synthetic Appointment flow
WebChat regression
```

A real bot token/network test is explicitly deferred until requested.

## Cross-track dependency rules

```text
Telegram must not wait for Scheduler.
Scheduler must consume Services snapshots, not channels.
Integration must not become a prerequisite for core scheduling.
Appointment may migrate to Scheduler only after Scheduler conflict semantics are certified.
Agent/MCP waits until deterministic Steps 1–7 are sufficiently mature.
```

## Immediate design decisions frozen by this roadmap

```text
Services = commercial/catalog semantics
Scheduler = concrete time/resource allocation
Integration = external-system adapter/delivery mechanics
Telegram interactive ingress = CTA, not Integration
PostgreSQL = Scheduler transactional truth
Temporal = orchestration authority
Mongo = audit/semantic evidence
```

## Next executable work after design review

Recommended sequence:

```text
1. Continue Services S6 on its existing Services certification line.
2. Open a dedicated Scheduler build branch from a documented compatible MK1 head.
3. Implement G2-S0 contracts/persistence only.
4. In parallel, implement C2 Telegram synthetic adapter proof on its own channel branch.
5. Do not integrate Appointment with Scheduler until G2-S3 conflict correctness is proven.
```
