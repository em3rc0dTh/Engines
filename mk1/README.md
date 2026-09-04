# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — SERVICES S0–S7 CERTIFIED — WEBCHAT C1A+C1B CERTIFIED + HUMAN VERIFIED — B2 CUSTOMER SOFT-DUPLICATE RESOLUTION CERTIFIED — C2/C4 LOCAL INTERACTIVE E2E HUMAN VERIFIED**

`mk0/runtime` remains frozen. `main` and `developer` are not feature branches; bounded MK1 work stays on explicit branches.

Current snapshot: [`STATUS-2026-09-04.md`](STATUS-2026-09-04.md).
Branch policy: [`../BRANCHES.md`](../BRANCHES.md).

## Current architecture

```text
ENGINE FIRST

CLI / HTTP / WebChat / Telegram / WhatsApp
                  ↓
          replaceable CTA boundary
                  ↓
          ChannelExecutionCore
                  ↓
     PostgreSQL durable channel ledger
                  ↓
               Temporal
                  ↓
          same Workflow Library
                  ↓
 Customer / Services / Scheduler / persistence
```

Provider transports never own domain policy.

## Current platform truth

```text
G0 Foundation                              ✅ CLOSED

STEP 1 / CTA + CUSTOMER REGISTRATION
CLI / HTTP-Postman                         ✅ historical milestones
WebChat C1A                                ✅ CERTIFIED + HUMAN VERIFIED
WebChat C1B durable semantics              ✅ CERTIFIED + HUMAN RESTART VERIFIED
Customer Registration Policy V2            ✅ BUILT + REGRESSION PROVEN
Durable Customer Registration Channel Core ✅ BUILT + REGRESSION PROVEN
B2 Customer soft-duplicate resolution      ✅ CERTIFIED
Telegram registration adapter              ✅ BUILT + LOCAL HARNESS PROVEN
WhatsApp registration adapter              ✅ BUILT + LOCAL HARNESS PROVEN
C2/C4 local real-Temporal E2E               ✅ AUTOMATED PASS
C2 Telegram local human E2E                 ✅ HUMAN VERIFIED
C4 WhatsApp local human E2E                 ✅ HUMAN VERIFIED
C2/C4 combined local human gate             ✅ HUMAN VERIFIED
B2 duplicate-decision UI                    ⏳ HUMAN OBSERVATION OPTIONAL
Real Telegram Bot API                       ⚪ NOT CERTIFIED
Real Meta Cloud API / Kapso                 ⚪ NOT CERTIFIED

STEP 3 / SERVICES
S0–S7                                      ✅ CERTIFIED
S8 final G1 closure                         ⏭ PENDING

STEP 4 / SCHEDULER
Design                                      ✅
Runtime                                     ⚪ NOT CERTIFIED

STEP 5 / INTEGRATION
Boundary                                   ✅ DESIGNED
Provider runtime                            ⚪ NOT CERTIFIED

Agent / MCP / LLM routing                  ❌ INTENTIONALLY ABSENT
```

## Services authority

S7 remains the latest Services certification:

```text
Branch           build/mk1-s7-appointment-services-integration
Certified source 6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
Run              33668593216
Job              100376325350
Artifact         9861631780
SHA256           e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a
```

S7 proves Appointment consumes canonical Services reads and preserves revision-aware selected Service/Offering state. S8 remains pending; Scheduler was not pulled into S7.

## C1B authority

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Artifact         9853555059
SHA256           efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

C1B proves durable conversation/event correlation, replay/conflict semantics and WebChat process restart/recovery to the same Temporal Workflow. Human restart/recovery was also verified.

## Customer registration over messaging

The first Telegram/WhatsApp slice intentionally exercises only:

```text
RegisterNewCustomer
```

The V2 policy requires independent:

```text
customer.name
customer.contact.phone
customer.contact.email
```

The next question is not hard-coded by Telegram or WhatsApp. The real Temporal state exposes `knownFields`, `missingFields` and `nextAction`; a provider-independent projection chooses the render intent.

### Telegram

Telegram chat/user IDs remain transport identity only. A phone comes from shared contact or typed phone input.

### WhatsApp

The verified provider sender phone can be supplied as a candidate at Workflow start. If Temporal accepts it, WhatsApp must not request phone again.

Meta direct versus Kapso remains a transport-provider decision below `WhatsAppTransportPort`, not an Engine decision.

## C2/C4 local interactive E2E authority

Original automated proof:

```text
Branch       build/mk1-c2-c4-local-interactive-e2e
Source SHA   bfccd4a795400d2311201a880453b61b08d0b56a
Run          33896424897
Job          101100019937
Result       SUCCESS
Artifact     9945929946
SHA256       92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e
```

Human verification is now also closed. The operator manually observed:

```text
Telegram normal registration                         ✅ PASS
Telegram invalid phone rejected                      ✅ PASS
same Telegram Workflow recovered                     ✅ PASS
WhatsApp sender phone known at Workflow start        ✅ PASS
WhatsApp did not request phone again                 ✅ PASS
WhatsApp real Temporal registration → CREATED        ✅ PASS
MESSAGING_LOCAL_E2E_PASS                              ✅ PASS
```

Human receipt: [`Test/c2-c4-local-interactive-human-verification-2026-09-04.md`](Test/c2-c4-local-interactive-human-verification-2026-09-04.md).

## B2 — Customer soft-duplicate resolution ✅

The first human WhatsApp run exposed a legitimate canonical soft match:

```text
WAITING_FOR_DUPLICATE_DECISION
nextAction = RESOLVE_DUPLICATE
```

B2 adds the shared deterministic `RESOLVE_CUSTOMER_DUPLICATE` operation without putting duplicate policy in either provider.

Certified authority:

```text
Branch           build/mk1-b2-customer-soft-duplicate-resolution
Certified source 36afff68af3237bd6431fd643d7d969e5452a296
Run              33899907141
Job              101111281727
Result           SUCCESS
Artifact         9947248334
SHA256           2c02680d9e268957924303ab1113d71f0d872319b611a6ede3faca0a01ed678a
```

The final run proves:

```text
single-candidate USE_EXISTING           ✅
explicit CREATE_NEW                     ✅
invalid candidate rejection             ✅
exact duplicate-decision event replay   ✅
Telegram → WhatsApp cross-channel match ✅
WhatsApp phone prefill/no reprompt       ✅
Agent / MCP                              absent
```

A clean cross-channel run created a Customer via Telegram, supplied the same email to WhatsApp, observed real `WAITING_FOR_DUPLICATE_DECISION / RESOLVE_DUPLICATE`, chose `USE_EXISTING`, and completed the same Workflow as `ALREADY_EXISTS` with the original Customer ID.

Receipt: [`Build/evidence/b2-customer-soft-duplicate-resolution-certification-2026-09-04.md`](Build/evidence/b2-customer-soft-duplicate-resolution-certification-2026-09-04.md).

Golden expectations/results: [`golden-dataset/customer-b2-soft-duplicate-resolution-v0.json`](golden-dataset/customer-b2-soft-duplicate-resolution-v0.json).

The final human WhatsApp run followed the unique-input `CREATED` path rather than the duplicate-decision UI. Therefore the UI path itself remains optional human observation, but B2 runtime certification and C2/C4 human closure are both valid.

## Carry-forward invariants

```text
ENGINE FIRST
channel != business authority
provider identity != business policy
soft-match candidate != silent overwrite
same event identity + different material != overwrite
mutable catalog head != selected Workflow snapshot
availability shown != reservation persisted
Services != Scheduler
unofficial WhatsApp transport != acceptable proof
CI green != external-provider certification
Agent/MCP != current phase
```

## Current sequence

```text
B2 Customer soft-duplicate resolution         ✅ CERTIFIED
C2/C4 local interactive E2E                   ✅ AUTOMATED + HUMAN VERIFIED
Real Telegram Bot API                         ⏭ NEXT CHANNEL GATE
Real WhatsApp provider                        ⏭ later
Services S8                                   ⏭ pending
Scheduler runtime                             ⏭ later
Agent / MCP                                   ⏭ last
```
