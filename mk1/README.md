# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — SERVICES S0–S7 CERTIFIED — WEBCHAT C1A+C1B CERTIFIED + HUMAN VERIFIED — C2/C4 LOCAL CUSTOMER-REGISTRATION E2E AUTOMATED PASS**

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

STEP 1 / CTA
CLI / HTTP-Postman                         ✅ historical milestones
WebChat C1A                                ✅ CERTIFIED + HUMAN VERIFIED
WebChat C1B durable semantics              ✅ CERTIFIED + HUMAN RESTART VERIFIED
Customer Registration Policy V2            ✅ BUILT + REGRESSION PROVEN
Durable Customer Registration Channel Core ✅ BUILT + REGRESSION PROVEN
Telegram registration adapter              ✅ BUILT + LOCAL HARNESS PROVEN
WhatsApp registration adapter              ✅ BUILT + LOCAL HARNESS PROVEN
C2/C4 local real-Temporal E2E               ✅ AUTOMATED PASS
C2/C4 local human interactive E2E           🧪 READY FOR EDUARDO TEST
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

Direct-source automated proof:

```text
Branch       build/mk1-c2-c4-local-interactive-e2e
Source SHA   bfccd4a795400d2311201a880453b61b08d0b56a
Run          33896424897
Job          101100019937
Result       SUCCESS
Artifact     9945929946
SHA256       92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e
```

Same run:

```text
Customer V1/V2 contracts       26 / 26 PASS
C1B regressions                 5 / 5 PASS
Telegram/WhatsApp adapters     10 / 10 PASS
Telegram real-Temporal lab      PASS → Customer CREATED
WhatsApp real-Temporal lab      PASS → Customer CREATED
```

Telegram began with `name + phone + email` missing and satisfied phone through a shared-contact-shaped event. WhatsApp began with phone already known from its HMAC-verified synthetic sender and requested only name + email.

Receipt: [`Build/evidence/c2-c4-local-interactive-e2e-certification-2026-09-04.md`](Build/evidence/c2-c4-local-interactive-e2e-certification-2026-09-04.md).

Verification: [`Test/c2-c4-local-interactive-e2e-2026-09-04.md`](Test/c2-c4-local-interactive-e2e-2026-09-04.md).

## Current manual gate

The automated proof is complete. Eduardo must now run the same lab interactively in both modes:

```text
Telegram → Temporal RegisterNewCustomer → Customer CREATED
WhatsApp → Temporal RegisterNewCustomer → Customer CREATED
```

At least one invalid phone or email should be entered and corrected while preserving the same Workflow.

Only after both manual runs may documentation say:

> `C2/C4 local interactive deterministic E2E HUMAN VERIFIED`.

## Carry-forward invariants

```text
ENGINE FIRST
channel != business authority
provider identity != business policy
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
C2/C4 local automated E2E                 ✅ PASS
C2/C4 local human interactive E2E         🧪 NOW
Real Telegram Bot API                     ⏭ after local human proof
Real WhatsApp provider                    ⏭ later
Services S8                               ⏭ pending
Scheduler runtime                         ⏭ later
Agent / MCP                               ⏭ last
```
