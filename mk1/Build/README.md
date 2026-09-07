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

Customer / CTA channels
  C0A Workflow-view projection        ✅ CERTIFIED
  C1A WebChat                         ✅ CERTIFIED + HUMAN VERIFIED
  C1B durable WebChat                 ✅ CERTIFIED + HUMAN RESTART VERIFIED
  B2 Customer soft-duplicate resolve  ✅ CERTIFIED
  C2/C4 local real-Temporal E2E       ✅ AUTOMATED + HUMAN VERIFIED
  C2P Telegram official Bot API       ✅ PHYSICALLY VERIFIED / SEALED
  C4P Meta Cloud API transport        ✅ DETERMINISTIC PASS / PHYSICAL OPEN
  C4P Kapso transport                 ✅ DETERMINISTIC PASS
  C4P Kapso Sandbox                   ✅ PHYSICALLY VERIFIED
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
| C2P Telegram physical | `28dd5c9f2dd2352d3e11b83cc6602cea1b568760` | `33927626629` | `101199465863` | `9957384230` | `46bbd55f0b2c061ec9b7e61d55323dca0f5488d410120a3ac5b4510b90bdd79c` | [`c2p-telegram-official-bot-api-physical-seal-2026-09-04.md`](evidence/c2p-telegram-official-bot-api-physical-seal-2026-09-04.md) |
| C4P Meta Cloud API deterministic | `72eb616153a8c4494f240ea825299e18d4aef156` | `33929572965` | `101205251200` | `9958063555` | `1bd75eaa752338cc9859bc0ee83190bf87afa00e994c562510209edf491b3ae2` | [`c4p-meta-whatsapp-cloud-api-deterministic-2026-09-04.md`](evidence/c4p-meta-whatsapp-cloud-api-deterministic-2026-09-04.md) |
| C4P Kapso deterministic | `8662a06c5787add829df36bea7e3f8ec5f1ecdf4` | `34141751510` | `101805053784` | `10026183649` | `d27d49d6e78a02b911992ffea35ab9551f8a04be95b8ef006ccf35a74e5a4c1f` | [`c4p-kapso-official-deterministic-2026-09-07.md`](evidence/c4p-kapso-official-deterministic-2026-09-07.md) |
| C4P Kapso Sandbox physical | human observation + deterministic authority above | — | — | — | — | [`c4p-kapso-sandbox-physical-certification-2026-09-07.md`](evidence/c4p-kapso-sandbox-physical-certification-2026-09-07.md) |

## Messaging consolidation

The temporary PR stack #14–#20 was merged, in order, into the stable MK1 messaging integration anchor:

```text
build/mk1-customer-channels-integrated
```

The merge strategy used merge commits so original runtime/certification source SHAs remain reachable. `main`, `developer`, `release/mk0-complete` and `mk0/runtime` were not moved.

## C2P — Telegram official provider

C2P is physically sealed. Real BotFather/Telegram traffic crossed the official Bot API into the same Customer channel core and real Temporal `RegisterNewCustomer`, then returned completion through Telegram. Telegram Web's native `request_contact` rendering remains only a client-compatibility note.

## C4P — WhatsApp providers

### Direct Meta Cloud API

The direct Meta transport is deterministic-pass only. It implements Meta webhook verification, payload normalization and Graph API outbound messaging below `WhatsAppTransportPort`, but its physical provider route is not sealed.

### Kapso

Kapso is now both deterministic-pass and physically verified in Sandbox.

The human physical run observed:

```text
real WhatsApp initial message
→ consent UI delivered by Engines
→ interactive consent
→ Customer name capture
→ verified sender phone prefilled / no phone reprompt
→ Customer email capture
→ terminal registration completion returned to WhatsApp
```

The screenshot supplied by the operator contained personal contact material and is intentionally not committed. Human behavior is recorded at [`../Test/c4p-kapso-sandbox-human-verification-2026-09-07.md`](../Test/c4p-kapso-sandbox-human-verification-2026-09-07.md).

This proves one real WhatsApp provider path without giving Kapso ownership of Customer, Temporal or persistence logic:

```text
WhatsApp
→ Kapso Sandbox
→ signed v2 webhook
→ OfficialKapsoTransport
→ WhatsAppAdapter
→ CustomerRegistrationChannelExecutionCore
→ PostgreSQL
→ Temporal RegisterNewCustomer
→ Customer
→ Kapso outbound API
→ WhatsApp
```

No Kapso Workflow, Kapso Agent, Agent, MCP or LLM routing was used.

## Failure provenance retained

Historical failures remain in their individual receipts rather than being rewritten away, including the initial C2/C4 non-TTY readline failure and the B2 probe identity-conflict failure. Their fixes did not weaken Engine invariants.

The Kapso physical run itself completed the normal path. Invalid-input recovery was not separately re-observed on Kapso, so no new provider-specific physical claim is made for that behavior.

## Current evidence boundary

We may claim:

```text
C2/C4 LOCAL INTERACTIVE E2E              ✅ AUTOMATED + HUMAN VERIFIED
B2 CUSTOMER SOFT-DUPLICATE RESOLUTION    ✅ CERTIFIED
C2P TELEGRAM OFFICIAL BOT API             ✅ PHYSICALLY VERIFIED / SEALED
C4P META CLOUD API TRANSPORT              ✅ BUILT / DETERMINISTIC PASS
C4P KAPSO TRANSPORT                       ✅ BUILT / DETERMINISTIC PASS
C4P KAPSO SANDBOX                         ✅ PHYSICALLY VERIFIED
```

We may **not** claim:

```text
C4P direct Meta Cloud API                  ❌ PHYSICALLY CERTIFIED
Kapso dedicated production number          ❌
production WhatsApp webhook hosting        ❌
production token/secret lifecycle          ❌
WhatsApp campaigns/templates product       ❌
Scheduler runtime                          ❌
Agent / MCP                                ❌
production readiness                       ❌
```

## Current next work

```text
Channel track   real WhatsApp provider via Kapso Sandbox ✅ CLOSED
Services track  S8 final G1 closure                         ← NEXT
Scheduler       runtime later
Agent / MCP     last
```
