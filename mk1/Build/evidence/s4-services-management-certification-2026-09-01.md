# S4 — Versioned Services Management Certification

## Verdict

**S4 PASS — CERTIFIED**

S4 promotes Services from a read/recommendation capability into a versioned, durable management surface while preserving the Engines authority boundary:

```text
caller / future admin / future CTA
            ↓
       Temporal Workflow
            ↓
  validation + reference preflight
            ↓
     PostgreSQL Activity
            ↓
 canonical Service/Offering truth
            ↓
       Mongo audit Activity
            ↓
        terminal result
```

No channel is granted direct PostgreSQL mutation authority.

## Certification authority

```text
Branch            build/mk1-s4-services-management
Source SHA         f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
GitHub run         33538554471
Job                99959020329
Result             SUCCESS
Artifact ID         9812703293
Artifact SHA-256    275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

The source SHA above is the runtime/CI revision that was actually executed. Documentation commits after that SHA index the result but are not themselves represented as executed runtime source.

## Certified mutation operations

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

## Certified invariants

### Temporal orchestration authority

All certified mutation probes execute `servicesManagementWorkflow`. Workflow code performs deterministic command validation, invokes Activities for PostgreSQL reference validation and mutation, awaits Mongo semantic audit, and only then returns the terminal outcome.

### Business-scoped idempotency

The PostgreSQL command ledger `service_mutation_commands` uses the logical identity:

```text
operation + businessSlug + hash(idempotencyKey)
```

The same idempotency key can therefore be valid in two different businesses without collision.

The certified run created one Service in `s4-business-a` and another in `s4-business-b` using the same external idempotency key; both applied independently.

### Exact replay

Re-executing the same material with the same logical idempotency identity returns `REPLAYED` and does not create a second business effect or second command-ledger row.

### Material idempotency conflict

Reusing the same idempotency identity with different command material returns:

```text
IDEMPOTENCY_CONFLICT
```

and does not overwrite the original effect.

### Optimistic revision control

Service and Offering updates require `expectedRevision`.

Certified progression:

```text
Service  revision 1 → update → 2 → status change → 3
Offering revision 1 → update → 2 → status change → 3
```

A stale update using revision `1` after revision `2` existed was rejected with `REVISION_CONFLICT` for both Service and Offering.

### Lifecycle is state, not deletion

`SetServiceStatus` and `SetOfferingStatus` change ACTIVE/INACTIVE state and increment revision. S4 does not use row deletion as a substitute for lifecycle state.

### Reference safety

Offering dependencies are validated against the same business scope before the mutation Activity.

The hardening probe attempted to create an Offering that required a missing Offering target. Certified outcome:

```text
NOT_FOUND
partial Offering row created      false
mutation-command row created      false
Mongo rejection audit persisted   true
```

This proves the supported S4 orchestration path does not leave a partial Offering when a dependency reference is invalid.

### Audit before terminal result

The workflow awaits `persistServicesMutationAudit` before returning. The certification artifact contains terminal Mongo audit entries for APPLIED, REPLAYED and REJECTED outcomes, including:

```text
IDEMPOTENCY_CONFLICT
REVISION_CONFLICT
NOT_FOUND
```

Mongo remains semantic audit evidence, not canonical catalog truth.

## PostgreSQL evidence

The final hardening artifact contains ten command-ledger rows across the principal mutation scenario plus the safety fixture. Relevant outcomes include:

```text
CreateService      s4-business-a       APPLIED
CreateService      s4-business-b       APPLIED
UpdateService      s4-business-a       APPLIED
CreateOffering     s4-business-a       APPLIED
UpdateOffering     s4-business-a       APPLIED
UpdateOffering     s4-business-a       REJECTED
SetOfferingStatus  s4-business-a       APPLIED
UpdateService      s4-business-a       REJECTED
SetServiceStatus   s4-business-a       APPLIED
CreateService      s4-safety-business  APPLIED
```

The exact replay and material-conflict attempts reuse the original command identity rather than creating duplicate ledger rows.

## Mongo evidence

The final artifact records thirteen terminal audit documents across the main and rejection-safety probes. It includes:

- APPLIED Service/Offering mutations;
- REPLAYED exact idempotency execution;
- REJECTED `IDEMPOTENCY_CONFLICT`;
- REJECTED stale Service and Offering `REVISION_CONFLICT`;
- REJECTED missing dependency `NOT_FOUND`.

## CI surface

The successful final run completed:

```text
npm ci
strict TypeScript typecheck
Services S1–S4 tests
frozen Customer/CTA/B7/Appointment regression subset
clean Docker Compose boot
CTA health
S3 persisted recommendation regression
S4 Temporal management probe
S4 rejection-safety probe
inherited RegisterNewAppointment certification
evidence capture/upload
clean teardown
```

Every job step completed successfully.

## Earlier run provenance

Run `33538120900` was already green for the first complete S4 implementation. After review, the supported dependency-reference path was hardened with an explicit preflight plus a no-partial-effect certification probe. That earlier run remains valid historical evidence but is **not** the final S4 certification authority.

Intermediate runs automatically cancelled by the branch concurrency policy while newer S4 commits arrived are not classified as product/test failures.

## Boundaries / non-claims

S4 does **not** certify:

- durable running-Workflow revision snapshots — S5;
- broad multi-business Service semantics — S6;
- Appointment consuming the full Services Engine projection — S7;
- final clean G1 closure — S8;
- Telegram, WhatsApp or WebChat adapters;
- Scheduler/resource capacity semantics;
- Agent/LLM authority.

## Closure

```text
S4 VERSIONED SERVICES MANAGEMENT
VERDICT: PASS / CERTIFIED
```

Next Services gate: **S5 — Running-Workflow durable snapshot semantics**.
