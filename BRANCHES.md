# Engines — Branch / Integration Ledger

Snapshot: 2026-09-21

The branch model is intentionally simple: stable recognition lives on `main`, active integration starts from `developer`, and provider-specific CTA branches are temporary evidence-producing lanes.

## Canonical topology

```text
main
└── developer
    └── new bounded feature/provider branches

historical CTA evidence refs
├── feature/cta-orchestration-register-appointment-poc
├── stage-20260918
├── feature/cta-meta-facebook-comments-poc
└── feature/cta-whatsapp-meta-cloud-api
```

Historical refs are not development bases. Their commits, PR discussions, CI runs and evidence remain inspectable.

## CTA integration receipts

| PR | Lane | State |
|---|---|---|
| #24 | canonical Register Appointment CTA | MERGED into developer |
| #35 | Meta Messenger M1 transport | MERGED into canonical CTA line |
| #36 | Facebook Comments Page.feed | MERGED into canonical CTA line |
| #37 | direct Meta WhatsApp Cloud API | MERGED into developer |

All four lanes are part of the integrated CTA baseline promoted to `main`. Provider physical truth boundaries remain unchanged by merge.

## Branch policy

| Branch/ref | Role | Policy |
|---|---|---|
| `main` | stable repository truth and canonical CTA recognition | KEEP |
| `developer` | active integration line / start point for new CTA work | KEEP |
| canonical CTA historical feature refs | exact evidence lineage | NO NEW WORK |
| provider-specific future feature branches | one bounded transport/security/certification scope | MERGE BACK then historical |

## Integrated capability truth

```text
CLI / HTTP-Postman                         certified laboratory
WebChat                                    physically verified within PoC
Telegram official Bot API                  physically verified
WhatsApp / Kapso                           physically verified
Messenger                                  real inbound + outbound transport verified
Facebook Page.feed                         dashboard transport verified
Facebook comment CTA                       synthetic edge replay verified
WhatsApp direct Meta Cloud API             deterministic certified / physical open
TikTok                                     deterministic only
```

## Branch solidity rule

A CTA/provider branch is considered solid only when it contains or references:

1. executable implementation;
2. deterministic regression coverage;
3. simple clean-clone reproduction instructions;
4. secret-name contract with no secret values committed;
5. sanitized fixtures/evidence;
6. explicit evidence class (deterministic, synthetic, dashboard, real provider, full E2E);
7. explicit non-claims;
8. a merge path back to `developer` and then `main`.

The canonical cross-channel checklist is `mk1/CTA/REPRODUCE.md`.

## Hygiene rules

1. Do not create permanent business forks per provider.
2. Provider adapters may own transport concerns, never domain policy.
3. Exact runtime claims stay attached to the executed SHA/receipt.
4. CI green does not imply provider physical certification.
5. Synthetic replay does not imply real provider delivery.
6. Preserve evidence before deleting historical refs.
7. `mk0/runtime` remains frozen.
8. New CTA work starts from `developer`, not from merged historical branches.
