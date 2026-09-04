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

CTA / channel proof
  C0A Workflow-view projection        ✅ CERTIFIED
  C1A WebChat                         ✅ CERTIFIED + HUMAN VERIFIED
  C1B durable WebChat                 ✅ CERTIFIED + HUMAN RESTART VERIFIED
  Customer policy/core                ✅ BUILT / REGRESSION PROVEN
  Telegram adapter                    ✅ LOCAL HARNESS PROVEN
  WhatsApp adapter                    ✅ LOCAL HARNESS PROVEN
  C2/C4 local real-Temporal E2E       ✅ AUTOMATED PASS
  C2/C4 local human interactive E2E   🧪 READY FOR EDUARDO TEST
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

## C2/C4 local interactive E2E

The direct-source run proved two provider-shaped inputs can drive the same real Engine path:

```text
Telegram-shaped input ─┐
                       ├→ canonical Customer channel core → PostgreSQL → Temporal → RegisterNewCustomer
WhatsApp-shaped input ─┘
```

Telegram result:

```text
initial missing     name + phone + email
phone source        Telegram shared-contact-shaped event
terminal            COMPLETED / CREATED
Customer ID         present
```

WhatsApp result:

```text
initial known       phone from HMAC-verified synthetic sender
initial missing     name + email
phone re-prompt     absent
terminal            COMPLETED / CREATED
Customer ID         present
```

Regression counts in the same successful run:

```text
Customer V1/V2            26 / 26
C1B channel                5 / 5
Telegram/WhatsApp adapter 10 / 10
```

The adapter-only human harness had already passed 10/10 on runtime source `5e09b9fb6d30c5f9a7612df061c428cbcfd91b8a`; that is separate from the current real-Temporal interactive gate.

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

Historical S3/S4/S6/C1A/C1B failure/supersession provenance remains in their individual receipts.

## Current evidence boundary

We may claim:

> **C2/C4 local interactive deterministic E2E AUTOMATED PASS.**

We may not yet claim:

> **C2/C4 local interactive deterministic E2E HUMAN VERIFIED.**

That requires the user's manual Telegram and WhatsApp runs.

No current receipt certifies real Telegram Bot API, Meta Cloud API, Kapso, public webhooks, outbound campaigns, Scheduler runtime, Agent/MCP or production readiness.

## Current next work

```text
Channel track   Eduardo manual Telegram + WhatsApp local interactive E2E
Then            real Telegram Bot API proof
Services track  S8 final G1 closure pending
Scheduler       runtime later
Agent / MCP     last
```
