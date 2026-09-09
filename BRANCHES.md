# Engines — Branch / Integration Ledger

Snapshot: 2026-09-09

This document records the current branch topology and the evidence/lineage rules after repository housekeeping. Deleting a branch ref does not delete commits, merged PRs, CI runs, artifacts, or evidence receipts.

## Current remote topology

```text
main
└── developer
    ├── feature/cta-orchestration-register-appointment-poc   # PR #24
    │   └── feature/managed-entity-resolution-policy         # PR #26
    └── build/mk1-c4p-whatsapp-cloud-api-official            # PR #21
```

Exactly five remote branches are intentionally retained:

| Branch | Role | Current policy |
|---|---|---|
| `main` | stable repository truth / canonical docs | KEEP |
| `developer` | integration and staging line | KEEP; never use as scratch branch |
| `feature/cta-orchestration-register-appointment-poc` | certified Register Appointment PoC | KEEP until PR #24 integration decision |
| `feature/managed-entity-resolution-policy` | active ManagedEntity policy/resolution slice | KEEP; stacked on PR #24 |
| `build/mk1-c4p-whatsapp-cloud-api-official` | direct Meta Cloud API alternate provider path | KEEP while physical provider gate remains open |

## Developer synchronization

`developer` was synchronized with `main` on 2026-09-09 by merge commit:

```text
7fde58081ec0ac453c9b2eb269e55f93fb1ab79c
```

After that merge, `developer` contains all current `main` history and remains ahead with the accumulated MK1 runtime/integration history. This synchronization does not merge PR #21, #24, or #26.

## Current open PR topology

```text
PR #24  feature/cta-orchestration-register-appointment-poc
        → developer
        Register Appointment PoC
        physically/deterministically certified candidate
        merge requires explicit authorization

PR #26  feature/managed-entity-resolution-policy
        → feature/cta-orchestration-register-appointment-poc
        ManagedEntity resolution policy
        active Draft / stacked work

PR #21  build/mk1-c4p-whatsapp-cloud-api-official
        → developer
        direct Meta WhatsApp Cloud API transport
        deterministic pass; physical route not sealed
```

## Integration capability truth

CLI, HTTP/Postman, WebChat, Telegram and WhatsApp/Kapso are capabilities of the integrated Engines lineage; they are not maintained as permanent independent active branches.

```text
CLI / HTTP-Postman                         ✅ historical/certified surfaces
WebChat                                    ✅ certified + physical browser proof
Telegram official Bot API                  ✅ physically verified / sealed
WhatsApp through Kapso Sandbox             ✅ physically verified
WhatsApp direct Meta Cloud API             ✅ deterministic pass / physical pending
```

Provider-specific transport remains below the canonical Engine boundary. Provider code may own authentication, provider identity, payload normalization, rendering and transport semantics; it may not own Customer, ManagedEntity, Services, Scheduler, Temporal business policy or canonical persistence.

## Historical branches

The former MK0/MK1 gate, design, channel-stack and consolidated-anchor refs were removed during housekeeping once their ancestry/evidence had been preserved elsewhere. They remain recoverable from Git history, merged/closed PRs, commits and evidence receipts.

Notable historical work retained in history includes:

```text
MK0 CLI / HTTP-Postman / release milestones
MK1 Services S0-S7 milestones
WebChat C1A/C1B milestones
Customer registration policy/channel-core stack
Telegram registration + official Bot API proof
WhatsApp registration + Kapso proof
messaging-stack consolidation anchor
repository integration-layout work
```

Branch deletion therefore means "no longer an active ref", not "evidence deleted".

## Current construction sequence

```text
Repository housekeeping / developer-main synchronization       ✅ CLOSED
Register Appointment PoC / PR #24                               ✅ CERTIFIED / REVIEW
ManagedEntity resolution / PR #26                               🔧 ACTIVE
Direct Meta Cloud API physical path / PR #21                    ⚪ OPTIONAL / OPEN
Data Model v3 scheduling/capacity                               ⏭ after ManagedEntity seam
Data Model v4 operational/corrective lifecycle                  ⏭ after v3
Agent / MCP / LLM routing                                       ⏭ later
```

## Branch hygiene rules

1. `main` is stable repository truth; `developer` is the integration/staging line.
2. Feature/build branches are temporary and bounded by one explicit scope or certification gate.
3. Do not create a permanent branch merely because a new channel/provider exists.
4. Preserve proven channel integrations; normalize their outputs, not their internals.
5. Runtime claims stay attached to the exact executed source SHA even when later merge/docs commits exist.
6. CI green is not equivalent to external-provider physical certification.
7. Before deleting a branch, verify PR state, ancestry and evidence reachability.
8. `mk0/runtime` remains frozen.
9. PR #24 must not be merged without explicit user authorization.
10. Stacked PRs must preserve their base lineage until the parent PR is integrated or deliberately retargeted.
