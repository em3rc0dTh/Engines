# Engines — Branch Lineage & Housekeeping

## Status

**HOUSEKEEPING PLAN — NO BRANCHES DELETED BY THIS DOCUMENT**

Snapshot date: 2026-09-02.

This file defines what each current branch means, which branches are canonical milestones, which are active work lines, and which are candidates for manual deletion after review.

The repository currently exposes 29 branches. No open pull requests were found during this review.

## Branch policy from this point forward

Branches must answer two questions in their name:

```text
What architecture generation / part is this?
What bounded gate or surface is being changed?
```

Preferred shapes:

```text
release/<milestone>
design/<mk>-<architecture-scope>
build/<mk>-<gate>-<bounded-scope>
audit/<bounded-scope>
```

Avoid permanent branches named `copy`, `scratch`, or generic `feat` once their work is represented by a canonical milestone branch.

Historical certification is preserved by Git commits, evidence receipts, workflow runs and artifacts. A branch is not required merely to keep a commit reachable.

## Canonical architecture / surface milestones

| Meaning | Branch | Current head | Policy |
|---|---|---|---|
| Stable integrated base | `main` | `9c0fab032461e889f3d9d297b2d2b375288afda3` | KEEP |
| Integration/staging line | `developer` | `9c0fab032461e889f3d9d297b2d2b375288afda3` | KEEP; do not use as feature branch |
| Frozen MK0 complete release | `release/mk0-complete` | `ae6588b63ede87d36a32b51363dfe96585c9b0df` | KEEP |
| MK0 CLI adapter milestone | `build/mk0-b3-cli-cta-adapter` | `471f45b4bd616656550981839165f289f4ccfb4a` | KEEP as historical CLI surface milestone if branch-per-surface is desired |
| MK0 HTTP/Postman proof | no dedicated cleanly named branch today | canonical implementation/evidence is contained by `release/mk0-complete` and later MK1 ancestry | HOLD naming decision before deleting `cert/mk0-core-golden-release` |
| Services S0–S5 terminal milestone | `build/mk1-s5-services-snapshots` | `0c779751e321db216002b4d2ba67278858cf0765` | KEEP as terminal Step-3 certified milestone |
| WebChat C1A visible channel milestone | `build/mk1-c0-c1-webchat` | `d11f2a4f3a871eadaece9409b1ec198ac2c037a2` | KEEP as WebChat surface milestone |
| WebChat C1B durable-channel milestone | `build/mk1-c1b-durable-channel` | `ad8b1ea3e8fc4e25ab1d1d7a797c6095a270a0ad` | KEEP; C1B certified + human restart/recovery verified |
| Steps 3–4–5 architecture design | `design/mk1-services-scheduler-integration` | active | KEEP; current architecture branch |
| Telegram C2 | not created yet | — | FUTURE: `build/mk1-c2-telegram` |
| Scheduler G2 first build | not created yet | — | FUTURE: `build/mk1-g2-s0-scheduler-contracts` |

Important chronology note: the repository history does not currently have a standalone branch named for the Postman surface. The CLI gate exists explicitly as B3, while HTTP/Postman proof evolved later inside MK0 and is present in the final MK0 release. Do not invent a historical branch identity that did not exist; if a dedicated Postman milestone branch is desired, create an intentional alias from the chosen certified commit before deleting the old certification branch.

## Current branch inventory and proposed disposition

| Branch | What it contains / means | Relationship | Proposed disposition |
|---|---|---|---|
| `audit/stage2-core-126-completeness` | Stage-2 foundation completeness audit | ancestor of `design/mk1-services-engine` | DELETE CANDIDATE after user review |
| `build/mk0-b0-runtime-skeleton` | MK0 runtime skeleton | ancestor of `release/mk0-complete` | DELETE CANDIDATE |
| `build/mk0-b1-contracts-policy` | MK0 contracts/policy gate | ancestor of `release/mk0-complete` | DELETE CANDIDATE |
| `build/mk0-b2-temporal-topology` | Temporal topology/continuity gate | historical MK0 intermediate | DELETE CANDIDATE |
| `build/mk0-b3-cli-cta-adapter` | CLI CTA adapter gate | historical interface milestone | KEEP |
| `build/mk0-b4-interactive-registration-workflow` | interactive registration Workflow gate | historical MK0 intermediate | DELETE CANDIDATE |
| `build/mk0-b5-postgres-authority` | PostgreSQL authority gate | historical MK0 intermediate | DELETE CANDIDATE |
| `build/mk0-b6-mongo-audit-finalization` | Mongo audit/finalization gate | historical MK0 intermediate | DELETE CANDIDATE |
| `build/mk0-b7-attachmentstore-local-lab` | AttachmentStore/local laboratory gate | ancestor of `release/mk0-complete` | DELETE CANDIDATE after preserving CLI milestone separately |
| `cert/mk0-b7-core-regression` | ephemeral B7 regression branch exposing PG/Mongo localhost ports | diverges by one CI-only 4-line Compose commit from canonical release lineage | DELETE CANDIDATE, but explicitly reviewed first |
| `cert/mk0-core-golden-release` | MK0 golden certification branch; includes HTTP/Postman-era proof ancestry | ancestor of `release/mk0-complete` | HOLD until Postman milestone naming decision |
| `feat/mk0-lab-console-trace` | MK0 lab-console trace feature | ancestor of `release/mk0-complete` | DELETE CANDIDATE |
| `feat/mk0-lab-console-trace-scratch` | scratch branch | exact same head as `build/mk0-b7-attachmentstore-local-lab` | DELETE CANDIDATE — exact duplicate head |
| `feat/mk0-register-new-appointment` | Appointment feature work | ancestor of `release/mk0-complete` | DELETE CANDIDATE |
| `feat/mk0-register-new-appointment-design` | stale/misnamed design branch | exact same head as `feat/mk0-lab-console-trace` | DELETE CANDIDATE — duplicate head |
| `design/mk1-services-engine` | original G1 Services design | ancestor of S0–S5 chain | DELETE CANDIDATE once terminal S5 + design docs are retained |
| `build/mk1-s0-runtime-promotion` | Services S0 runtime promotion | ancestor of S5 | DELETE CANDIDATE |
| `build/mk1-s1-services-contracts` | Services S1 contracts/persistence | ancestor of S5 | DELETE CANDIDATE |
| `build/mk1-s2-services-read-engine` | Services S2 deterministic reads | ancestor of S5 | DELETE CANDIDATE |
| `build/mk1-s3-services-eligibility` | Services S3 eligibility/recommendation | ancestor of S5 | DELETE CANDIDATE |
| `build/mk1-s4-services-management` | Services S4 management | ancestor of S5 | DELETE CANDIDATE |
| `build/mk1-s5-services-snapshots` | Services S5 terminal certified state | terminal Services milestone before S6 | KEEP |
| `build/mk1-c0-c1-webchat` | C0A view + C1A WebChat + human post-fix proof | ancestor of C1B | KEEP because it is the requested WebChat version milestone |
| `build/mk1-c1b-durable-channel` | durable binding/event semantics + human restart/recovery | ancestor/base of current design branch | KEEP |
| `build/mk1-c1b-durable-channel-copy` | accidental copy branch | exact same head as `build/mk1-c0-c1-webchat` | DELETE CANDIDATE — exact duplicate |
| `design/mk1-services-scheduler-integration` | active Steps 3–4–5 design + Telegram C2 design prep | 12 commits ahead of C1B at review time | KEEP / ACTIVE |
| `main` | stable integrated base | one commit ahead of `release/mk0-complete`, no file delta in compare | KEEP |
| `developer` | integration branch currently equal to `main` | MK1 not yet consolidated into it | KEEP |
| `release/mk0-complete` | frozen MK0 release | ancestor of stable base | KEEP |

## Verified lineage facts used for this plan

```text
release/mk0-complete descends from build/mk0-b0-runtime-skeleton
release/mk0-complete descends from build/mk0-b1-contracts-policy
release/mk0-complete descends from build/mk0-b7-attachmentstore-local-lab
release/mk0-complete descends from feat/mk0-lab-console-trace
release/mk0-complete descends from feat/mk0-register-new-appointment
release/mk0-complete descends from cert/mk0-core-golden-release

build/mk1-s5-services-snapshots descends from design/mk1-services-engine
build/mk1-s5-services-snapshots descends from build/mk1-s0-runtime-promotion
build/mk1-s5-services-snapshots descends from S1, S2, S3 and S4 terminal heads

build/mk1-c1b-durable-channel descends from build/mk1-s5-services-snapshots
build/mk1-c1b-durable-channel descends from build/mk1-c0-c1-webchat

design/mk1-services-scheduler-integration descends from build/mk1-c1b-durable-channel
```

Exact duplicate heads observed:

```text
build/mk1-c1b-durable-channel-copy
= build/mk1-c0-c1-webchat
= d11f2a4f3a871eadaece9409b1ec198ac2c037a2

feat/mk0-lab-console-trace-scratch
= build/mk0-b7-attachmentstore-local-lab
= 3b8baca63bea5dc3312aa4ac30d44e308457d719

feat/mk0-register-new-appointment-design
= feat/mk0-lab-console-trace
= 9a077f0282a7924b97946baca612c453adf2d78d
```

The unique commit on `cert/mk0-b7-core-regression` is:

```text
609fb09d8d8f5b1229df0e0ebae031a9b5afbb27
ci(mk0-b7): expose databases only on ephemeral regression branch
```

It only adds localhost port exposure for PostgreSQL and MongoDB in Compose. It is intentionally noncanonical and should not block branch cleanup once the user approves deletion.

## Recommended branch set after housekeeping

If the user approves the proposed cleanup, the repository can be reduced to a compact narrative set:

```text
main
developer
release/mk0-complete
build/mk0-b3-cli-cta-adapter
<chosen Postman/HTTP milestone branch>
build/mk1-s5-services-snapshots
build/mk1-c0-c1-webchat
build/mk1-c1b-durable-channel
design/mk1-services-scheduler-integration
```

Then new work extends the story explicitly:

```text
build/mk1-c2-telegram
build/mk1-s6-services-multibusiness
build/mk1-g2-s0-scheduler-contracts
...
```

## Rule for future gates

When a bounded gate closes:

1. evidence is committed and indexed;
2. the terminal branch may be kept only if it is a meaningful architecture/surface milestone;
3. intermediate branches become deletion candidates after ancestry and open-PR checks;
4. no branch is deleted automatically by the assistant;
5. the user receives the exact deletion candidate list before any deletion.
