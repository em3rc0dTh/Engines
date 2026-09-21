# Engines — Branch / Integration Ledger

Snapshot: 2026-09-21

This document records the current branch topology and the evidence/lineage rules after repository housekeeping. Deleting a branch ref does not delete commits, merged PRs, CI runs, artifacts, or evidence receipts.

## CTA-relevant remote topology

```text
main
└── developer
    ├── feature/managed-entity-resolution-policy
    └── build/mk1-c4p-whatsapp-cloud-api-official

historical CTA evidence refs
├── feature/cta-orchestration-register-appointment-poc
├── stage-20260918
└── feature/cta-meta-facebook-comments-poc
```

The Register Appointment CTA line, Messenger M1 lane and Facebook Comments Page.feed lane are integrated into `developer`. Their source refs may remain temporarily for evidence/inspection, but new CTA work must start from the integrated line rather than extending those historical refs.

| Branch | CTA-related role | Current policy |
|---|---|---|
| `main` | stable repository truth / canonical docs | KEEP |
| `developer` | integration and staging line; integrated CTA authority | KEEP |
| `feature/cta-orchestration-register-appointment-poc` | historical canonical CTA source line | NO NEW WORK; cleanup candidate after main promotion |
| `stage-20260918` | historical Messenger M1 source | NO NEW WORK; cleanup candidate |
| `feature/cta-meta-facebook-comments-poc` | historical Facebook Comments source | NO NEW WORK; cleanup candidate |
| `build/mk1-c4p-whatsapp-cloud-api-official` | direct Meta WhatsApp alternate provider | MODERNIZE/INTEGRATE; physical gate remains open |

## Developer synchronization

`developer` was synchronized with `main` on 2026-09-09 by merge commit:

```text
7fde58081ec0ac453c9b2eb269e55f93fb1ab79c
```

After that merge, `developer` contains all current `main` history and remains ahead with the accumulated MK1 runtime/integration history. This synchronization does not merge PR #21, #24, or #26.

## CTA integration state

```text
PR #24  Register Appointment CTA
        source line integrated into developer on 2026-09-21

PR #35  Messenger M1 physical transport baseline
        MERGED into canonical CTA line

PR #36  Facebook Comments Page.feed reproducible lane
        MERGED into canonical CTA line

PR #21  direct Meta WhatsApp Cloud API transport
        legacy provider branch; deterministic pass
        physical route not sealed
        requires modernization onto current integrated line
```

PR #26 is ManagedEntity work rather than a CTA provider lane; after parent CTA integration its base must follow the current integration topology rather than a historical CTA ref.

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
Register Appointment CTA / PR #24 lineage                       ✅ CERTIFIED / INTEGRATED INTO DEVELOPER
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
9. CTA provider branches must converge back into `developer`; do not create permanent provider-specific business forks.
10. When a stacked parent is integrated, retarget remaining child PRs to the current integration line before further work.


## CTA consolidation receipt — 2026-09-21

The CTA provider lanes are organized as one business architecture with replaceable channel boundaries:

```text
WebChat
Telegram
WhatsApp / Kapso
Messenger
Facebook Comments
TikTok
API
   │
   ▼
provider adapter
   │
   ▼
canonical CTA
   │
   ▼
Temporal
   │
   ▼
domain + persistence
```

Merged provider-lane receipts:

```text
PR #35 Messenger M1                    MERGED
PR #36 Facebook Comments Page.feed     MERGED
```

Canonical reproduction index:

```text
mk1/CTA/README.md
```

A CTA branch is considered solid only when it carries executable code, deterministic regression coverage, simple reproduction instructions, sanitized evidence and explicit non-claims.
