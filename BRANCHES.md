# Engines — Branch / Integration Ledger

Snapshot: 2026-09-21

Repository housekeeping keeps one stable line, one integration line, and only bounded active feature/certification branches.

## Canonical topology

```text
main
└── developer
    ├── feature/managed-entity-resolution-policy
    └── cert/platform-solidity-pre-agent
```

`main` and `developer` are kept synchronized at housekeeping boundaries. New bounded work starts from `developer`.

## Active pull requests

| PR | Head | Base | Role | State |
|---|---|---|---|---|
| #26 | `feature/managed-entity-resolution-policy` | `developer` | ManagedEntity ME1 | ACTIVE / draft |
| #34 | `cert/platform-solidity-pre-agent` | `main` | pre-Agent platform roll-up | ACTIVE / draft; reconciliation with newer main required |

PR #34 is the single roll-up for the historical Layer 6 → pre-Scheduler → Scheduler G2 → Integration G3 → platform-solidity lineage.

The former stacked PRs #27, #28 and #33 were closed during housekeeping after ancestry was verified. Their commits, CI runs, artifacts and evidence remain reachable through PR #34 and exact SHAs.

## CTA integration receipts

| PR | Lane | State |
|---|---|---|
| #24 | canonical Register Appointment CTA | MERGED |
| #35 | Meta Messenger M1 transport | MERGED |
| #36 | Facebook Comments Page.feed | MERGED |
| #37 | direct Meta WhatsApp Cloud API | MERGED |
| #38 | CTA repository consolidation | MERGED |
| #39 | integrated CTA baseline promotion to main | MERGED |
| #40 | Meta Page HMAC + Facebook Comment canonical Temporal bridge | MERGED |
| #41 | promote Meta HMAC / Facebook Comment bridge to main | MERGED |

## Historical refs safe to remove after evidence review

These refs are no longer valid development bases. Their PRs/history or descendant branches preserve the work.

```text
chore/cta-repository-consolidation-20260921
feature/cta-whatsapp-meta-cloud-api
feature/cta-orchestration-register-appointment-poc
feature/cta-meta-facebook-comments-poc
stage-20260918
test-branch-20260918
build/mk1-c4p-whatsapp-cloud-api-official

build/g2-s0-scheduler-contract-persistence
build/g2-s1-scheduler-management
build/g2-s2-deterministic-availability
build/g2-scheduler

feature/layer6-v4-persistence-complete
feature/pre-scheduler-node-edge-certification
build/g3-integration

feature/meta-page-hmac-canonical-bridge
```

Why these are removable:

- CTA refs were merged or explicitly superseded by the integrated `main` lineage.
- `test-branch-20260918` has no unique work and was an accidental setup branch.
- the legacy direct-Meta WhatsApp ref was superseded by PR #37.
- Scheduler S0/S1/S2 are ancestors of the terminal G2 branch.
- terminal G2 is already contained in the pre-Scheduler lineage.
- Layer 6, pre-Scheduler and G3 are all ancestors of the active PR #34 branch.
- `feature/meta-page-hmac-canonical-bridge` was merged through PR #40 and promoted to `main` through PR #41.

Deleting a branch ref does not delete commits, merged/closed PR discussions, CI runs, artifacts or source-bound evidence SHAs.

## Branches that must remain

```text
main
developer
feature/managed-entity-resolution-policy
cert/platform-solidity-pre-agent
```

Do not delete either active feature/certification branch while PR #26 or PR #34 remains open.

## Integrated capability truth

```text
CLI / HTTP-Postman                         certified laboratory
WebChat                                    physically verified within PoC
Telegram official Bot API                  physically verified
WhatsApp / Kapso                           physically verified
Messenger                                  real inbound + outbound transport + deployed HMAC verified
Facebook Page.feed                         signed dashboard transport verified
Facebook comment CTA                       canonical bridge -> Temporal start -> persistence/idempotency certified
WhatsApp direct Meta Cloud API             deterministic certified / physical open
TikTok                                     deterministic only
```

## Branch solidity rule

A branch is considered solid only when it carries or references:

1. executable implementation;
2. deterministic regression coverage;
3. simple clean-clone reproduction instructions;
4. secret-name contract without committed secret values;
5. sanitized fixtures/evidence;
6. explicit evidence class;
7. explicit non-claims;
8. a merge path back to `developer` / `main`.

The canonical CTA reproduction index is `mk1/CTA/REPRODUCE.md`.

## Hygiene rules

1. `main` is stable repository truth.
2. `developer` is the start point for new bounded work.
3. No permanent business fork exists per provider.
4. Closed/merged feature branches should be removed once evidence reachability is verified.
5. CI green does not imply provider physical certification.
6. Synthetic replay does not imply real provider delivery.
7. Exact evidence remains attached to the executed SHA.
8. `mk0/runtime` remains frozen.
