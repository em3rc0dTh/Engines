# S7 — Appointment → canonical Services integration gate

Date: 2026-09-02

## Status

**BUILD GATE OPEN — NOT CERTIFIED**

Branch:

```text
build/mk1-s7-appointment-services-integration
```

Base:

```text
build/mk1-s6-services-multibusiness
S0–S6 Services certified
```

## Purpose

S7 removes the remaining authority ambiguity between the inherited MK0 Appointment catalog compatibility path and the standalone MK1 Services Engine.

After S7, `RegisterNewAppointment` must select Service/Offering data from canonical Services reads and freeze a revision-aware selected snapshot into Workflow state.

S7 must preserve all already-certified Appointment behavior while **not** redesigning Scheduler.

## Before S7

```text
RegisterNewAppointment
  ↓
inherited Appointment catalog compatibility
  ↓
Service/Product-shaped projection
  ↓
date / slot / finalization
```

The inherited path is regression-protected, but it is not sufficient as the final Step-3 ownership model because Services is now an independently versioned engine.

## Target after S7

```text
RegisterNewAppointment
        ↓
Customer resolution
        ↓
Services.ListServices
        ↓
select Service revision
        ↓
Services.ListOfferings / GetOffering
        ↓
freeze selected Service + Offering snapshot
        ↓
existing date / availability compatibility boundary
        ↓
slot selection
        ↓
explicit finalize
        ↓
inherited atomic Appointment persistence
```

## Authority boundary

Services owns:

```text
Service identity/revision
Offering identity/revision
name/description/tags
price semantics
duration
requirements
dependencies
eligibility metadata
selected immutable snapshot
```

S7 does **not** authorize Services to own:

```text
staff/resource assignment
concrete schedule templates
capacity
availability conflict truth
holds
reservations
resource assignments
```

Those remain Step 4 Scheduler responsibilities.

## Required Workflow state

Once an Offering is selected, the Appointment Workflow must expose a frozen snapshot sufficient to prove it is no longer interpreting mutable catalog head as selected truth.

Minimum selected snapshot semantics:

```text
businessSlug
serviceId
serviceRevision
serviceCode
serviceName
offeringId
offeringRevision
offeringCode
offeringName
durationMinutes
pricing
requirements
dependencies
eligibilityRuleSet (when present)
```

The existing compatibility `selectedService` / `selectedProduct` projections may remain for renderer/backward compatibility, but they must be derived from or consistent with canonical Services data.

## Required experiment

```text
1. start Appointment A
2. select Service + Offering revision N from canonical Services
3. query Appointment A and capture selected Services snapshot N
4. publish Offering revision N+1 through certified S4 management path
5. query Appointment A again
6. prove selected snapshot is still N
7. continue Appointment A to CREATED using N-compatible duration/selection semantics
8. start Appointment B after publication
9. prove Appointment B sees N+1
```

This is an Appointment-specific composition proof. It complements S5 rather than replacing it.

## Regression requirements

S7 cannot close unless the same clean runtime also proves:

```text
new Customer Child Workflow path              PASS
existing Customer resolution path             PASS
Service selection                              PASS
Offering selection                             PASS
English/Spanish human date normalization       PASS
past date rejection                            PASS
slot loading                                   PASS
explicit finalization                          PASS
Appointment exact replay                       PASS
atomic same-slot conflict                      PASS
C1A/C1B workflow-view compatibility            PASS or explicitly unaffected by static proof
```

## Forbidden implementation shortcuts

S7 fails if any of these appear:

- Appointment imports PostgreSQL and bypasses Services repository/activity boundaries for catalog semantics;
- channel/WebChat code decides Service/Offering business policy;
- selected snapshot is reconstructed from mutable catalog head after selection;
- Offering revision changes silently alter an active Appointment;
- Scheduler resource/capacity code is moved into Services;
- a vertical/business name conditional is introduced;
- `mk0/runtime` is modified.

## Golden cases

```text
S7-CAT-001  Appointment Service list comes from canonical Services read path
S7-CAT-002  Appointment Offering list comes from canonical Services read path
S7-REV-001  selected snapshot records Service/Offering revisions
S7-REV-002  active Appointment snapshot survives N → N+1 catalog publication
S7-REV-003  new Appointment sees N+1
S7-CMP-001  compatibility projections remain correct
S7-CMP-002  inherited Appointment E2E remains passing
S7-CMP-003  exact replay remains passing
S7-CMP-004  slot conflict remains one winner
S7-BND-001  Scheduler authority is not introduced into Services
S7-BND-002  no provider/channel-specific business policy
```

## Evidence required to certify

A successful S7 receipt must contain:

```text
executed source SHA
GitHub Actions run/job
artifact ID/digest
canonical read markers
snapshot revision-N marker
catalog publication N+1 marker
active snapshot-still-N marker
new Appointment-sees-N+1 marker
full Appointment regression markers
PostgreSQL evidence
Mongo Services/Appointment audit evidence
explicit non-claims
```

## Verdict boundary

Only after executable proof may documentation say:

> `S7 Appointment → canonical Services integration CERTIFIED`.

Even after S7:

```text
G1 Services overall   not complete until S8
Scheduler             not certified
Telegram physical     not certified
Integration runtime   not certified
Agent / MCP            absent
production             not certified
```
