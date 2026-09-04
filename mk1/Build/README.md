# MK1 Build & Evidence Index

## Purpose

This index answers:

> **What source was actually executed, what evidence was produced, and what bounded claim does that evidence support?**

Documentation commits after a successful run never replace the executed runtime source SHA.

## Current status

```text
G0 Foundation                         ✅ CLOSED

G1 Services
  S0–S7                               ✅ CERTIFIED
  S8                                  ⏭ PENDING
  G1 overall                          ❌ NOT YET FULLY CERTIFIED

Customer / CTA channel proof
  C0A Workflow-view projection        ✅ CERTIFIED
  C1A WebChat                         ✅ CERTIFIED + HUMAN VERIFIED
  C1B durable WebChat                 ✅ CERTIFIED + HUMAN RESTART VERIFIED
  B2 Customer soft-duplicate resolve  ✅ CERTIFIED
  Telegram adapter                    ✅ LOCAL HARNESS PROVEN
  WhatsApp adapter                    ✅ LOCAL HARNESS PROVEN
  C2/C4 local real-Temporal E2E       ✅ AUTOMATED PASS
  C2 Telegram local human E2E         ✅ HUMAN VERIFIED
  C4 WhatsApp local human E2E         ✅ HUMAN VERIFIED
  C2/C4 combined human gate           ✅ HUMAN VERIFIED
  B2 duplicate-decision UI            ⏳ HUMAN OBSERVATION OPTIONAL
  real provider proof                 ⚪ NOT CERTIFIED
```

## Evidence ledger

| Gate | Source SHA | Run | Job | Artifact | SHA-256 | Receipt |
|---|---|---:|---:|---:|---|---|
| G0 | audit closure | — | — | — | — | [`g0-core-126-audit-closure-2026-08-31.md`](evidence/g0-core-126-audit-closure-2026-08-31.md) |
| S0 | `6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1` | `33461008031` | `99710964036` | `9783188036` | `69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958` | [`s0-runtime-promotion-certification-2026-08-31.md`](evidence/s0-runtime-promotion-certification-2026-08-31.md) |
| S1 | `550cdca619856fe246ab569588f9036a7025e7a7` | `33461510248` | `99712416091` | `9783331341` | `7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097` | [`s1-services-contracts-certification-2026-08-31.md`](evidence/s1-services-contracts-certification-2026-08-31.md) |
| S2 | `cec97a2b90a7aee8ae1deb3660bad0d7a759ace6` | `33461895218` | `99713587556` | `9783467265` | `0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677` | [`s2-services-read-engine-certification-2026-08-31.md`](evidence/s2-services-read-engine-certification-2026-08-31.md) |
| S3 | `a6974cdbb669b66a07b8780d5e20c960d6a0cd64` | `33531884206` | `99936776923` | `9810084527` | `fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60` | [`s3-services-eligibility-certification-2026-09-01.md`](evidence/s3-services-eligibility-certification-2026-09-01.md) |
| S4 | `f3e54b853af5f01fb2e9ed7d032f784e3cffb81e` | `33538554471` | `99959020329` | `9812703293` | `275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c` | [`s4-services-management-certification-2026-09-01.md`](evidence/s4-services-management-certification-2026-09-01.md) |
| S5 | `7568618062f4192b34caf6e916b58534f304ad3f` | `33539683548` | `99962550022` | `9813129778` | `22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708` | [`s5-services-snapshot-certification-2026-09-01.md`](evidence/s5-services-snapshot-certification-2026-09-01.md) |
| S6 | `3eed68b45036154bcf1776564f479cd02e30d0d4` | `33666790884` | `100370414068` | `9860927146` | `543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564` | [`s6-services-multibusiness-certification-2026-09-02.md`](evidence/s6-services-multibusiness-certification-2026-09-02.md) |
| S7 | `6fc8814830038b5600c4c6376cd9b4ed7ef34b7a` | `33668593216` | `100376325350` | `9861631780` | `e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a` | [`s7-appointment-services-integration-certification-2026-09-02.md`](evidence/s7-appointment-services-integration-certification-2026-09-02.md) |
| C1A | `860629e9ada498e225ae803a9fe6f077949ec320` | `33542468975` | `99971830150` | `9814172765` | `a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3` | [`c1a-webchat-workflow-visibility-certification-2026-09-01.md`](evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md) |
| C1A UI hardening | `ed207f8c82ae9138f92fd505209c30c4eeba243b` | `33560864234` | `100032737031` | `9821207955` | `4f7fc1ddea852a9501f20078d0df8ecc84dc3c645e8b1362424c6d6f11ae37ff` | [`../Test/c1a-webchat-human-verification-2026-09-01.md`](../Test/c1a-webchat-human-verification-2026-09-01.md) |
| C1B | `2008fce4f863fdabf8e8f323eee1d7cda05cb454` | `33647842017` | `100307008849` | `9853555059` | `efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf` | [`c1b-durable-channel-certification-2026-09-02.md`](evidence/c1b-durable-channel-certification-2026-09-02.md) |
| C2/C4 local interactive E2E | `bfccd4a795400d2311201a880453b61b08d0b56a` | `33896424897` | `101100019937` | `9945929946` | `92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e` | [`c2-c4-local-interactive-e2e-certification-2026-09-04.md`](evidence/c2-c4-local-interactive-e2e-certification-2026-09-04.md) |
| B2 Customer soft-duplicate resolution | `36afff68af3237bd6431fd643d7d969e5452a296` | `33899907141` | `101111281727` | `9947248334` | `2c02680d9e268957924303ab1113d71f0d872319b611a6ede3faca0a01ed678a` | [`b2-customer-soft-duplicate-resolution-certification-2026-09-04.md`](evidence/b2-customer-soft-duplicate-resolution-certification-2026-09-04.md) |

## B2 — Customer soft-duplicate resolution

The human C2/C4 test exposed a real Customer-domain state rather than a transport failure:

```text
WAITING_FOR_DUPLICATE_DECISION / RESOLVE_DUPLICATE
```

B2 adds one deterministic shared domain operation:

```text
RESOLVE_CUSTOMER_DUPLICATE
  → USE_EXISTING
  → CREATE_NEW
```

The provider does not decide duplicate truth. The core reads the live candidate set from Temporal; `USE_EXISTING` may resolve only to a current candidate and the current messaging slice fails closed when more than one candidate exists.

The successful full runtime probe emitted:

```text
CUSTOMER_B2_INVALID_CANDIDATE_REJECTED_PASS
CUSTOMER_B2_DUPLICATE_DECISION_REPLAY_PASS
CUSTOMER_B2_USE_EXISTING_PASS
CUSTOMER_B2_CREATE_NEW_PASS
CUSTOMER_B2_SOFT_DUPLICATE_RESOLUTION_PASS
```

The clean cross-channel run also proved Telegram `CREATED` → WhatsApp same-email `SOFT_MATCH` → explicit `USE_EXISTING` → `ALREADY_EXISTS`, with the exact same Customer ID and no redundant WhatsApp phone prompt.

## Human evidence

The user's manual local test is recorded at [`../Test/c2-c4-local-interactive-human-verification-2026-09-04.md`](../Test/c2-c4-local-interactive-human-verification-2026-09-04.md).

Current human truth:

```text
Telegram normal local registration                ✅ PASS
Telegram invalid phone → same Workflow recovery   ✅ PASS
WhatsApp sender phone prefilled                    ✅ PASS
WhatsApp phone not requested again                 ✅ PASS
WhatsApp real Temporal registration → CREATED      ✅ PASS
C2/C4 combined local interactive gate              ✅ HUMAN VERIFIED
```

The final WhatsApp human run used unique Customer material, so the B2 duplicate-decision UI was not separately observed by the operator. B2 remains runtime-certified independently; that optional UI observation is not required to keep C2/C4 human closure valid.

## Failure provenance

Failures are retained rather than erased.

### C2/C4 interactive first attempt

```text
Run       33896062496
Job       101098866437
Result    FAILURE
Artifact  9945799079
SHA256    208db06ce14ef9f9cada55db1b485117350fe2a3e2a2a61d63ac9038ab2fdc2e
Stage     terminal harness before first canonical event
Cause     piped stdin closed readline under non-TTY Compose execution
```

The runtime fix separated scripted CI mode from human readline mode. No Engine business rule was weakened.

### B2 full-probe identity failure

```text
Source    38d32ac415fb3853f2e091d21ad49683f1761705
Run       33899701530
Job       101110615612
Result    FAILURE
Stage     full B2 domain golden probe
Cause     probe reused one synthetic externalMessageId across multiple conversations
```

The durable channel ledger correctly detected the conflict. The probe identity was fixed; no domain invariant changed. Full B2 authority is source `36afff68...`, run `33899907141`.

Historical S3/S4/S6/C1A/C1B failure/supersession provenance remains in their individual receipts.

## Current evidence boundary

We may claim:

```text
C2/C4 local interactive deterministic E2E ✅ AUTOMATED PASS
C2/C4 local interactive deterministic E2E ✅ HUMAN VERIFIED
B2 CUSTOMER SOFT-DUPLICATE RESOLUTION      ✅ CERTIFIED
```

No current receipt certifies real Telegram Bot API, Meta Cloud API, Kapso, public webhooks, outbound campaigns, Scheduler runtime, Agent/MCP or production readiness.

## Current next work

```text
Channel track   real Telegram Bot API proof
Services track  S8 final G1 closure pending
Scheduler       runtime later
Agent / MCP     last
```
