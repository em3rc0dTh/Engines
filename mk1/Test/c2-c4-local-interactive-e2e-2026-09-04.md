# C2/C4 local interactive customer-registration E2E — verification ledger

Date: 2026-09-04
Status: **AUTOMATED PASS — HUMAN INTERACTIVE E2E PENDING**

## Scope

This gate verifies the local laboratory composition:

```text
Telegram / WhatsApp provider-shaped presentation
        ↓
real transport adapter
        ↓
CanonicalChannelEnvelope
        ↓
real CustomerRegistrationChannelExecutionCore
        ↓
real PostgreSQL channel ledger
        ↓
real Temporal RegisterNewCustomer Workflow
        ↓
real Customer persistence/audit
```

No external provider credentials are involved.

## Automated authority

```text
Branch       build/mk1-c2-c4-local-interactive-e2e
Source SHA   bfccd4a795400d2311201a880453b61b08d0b56a
Run          33896424897
Job          101100019937
Result       SUCCESS
Artifact     9945929946
SHA-256      92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e
Event        push
```

A parallel PR-merge-ref run also passed:

```text
Run          33896430272
Job          101100038219
Result       SUCCESS
Artifact     9945937609
SHA-256      9bfe20b7997f368effd1202b1ab426f58644e09737c297c8c4df36e6e120c7a5
```

The push run above is the direct source-SHA authority.

## Regression matrix

On the same clean run:

```text
TypeScript                                      PASS
Customer V1/V2 contract suite                  26 / 26 PASS
C1B channel regressions                         5 / 5 PASS
Telegram + WhatsApp adapter regressions        10 / 10 PASS
Compose PostgreSQL/Mongo/Temporal/migrations    PASS
Worker                                          PASS
Telegram scripted interactive E2E              PASS
WhatsApp scripted interactive E2E              PASS
Evidence capture                               PASS
Cleanup                                         PASS
```

## Telegram E2E observation

The scripted terminal lab crossed the real `TelegramAdapter`, durable Customer channel core and Temporal Workflow.

Observed progression:

```text
START
knownFields   = none
missingFields = name, phone, email

name accepted
knownFields   = name
missingFields = phone, email

shared-contact phone accepted
knownFields   = name, phone
missingFields = email

email accepted
→ workflowStatus COMPLETED
→ phase CREATED
→ missingFields none
→ real Customer ID returned
```

Terminal marker:

```text
MESSAGING_LOCAL_E2E_PASS
channel=TELEGRAM
phonePrefilled=false
scripted=true
agent=false
mcp=false
```

This proves Telegram chat/user identity is not silently treated as a Customer phone.

## WhatsApp E2E observation

The scripted WhatsApp fixture first crossed the real local HMAC verification seam in `MetaCloudApiTransport`, then `WhatsAppAdapter`, then the same durable Customer channel core and Temporal Workflow.

Observed progression:

```text
verified synthetic sender phone supplied at START
knownFields   = phone
missingFields = name, email

name accepted
knownFields   = name, phone
missingFields = email

email accepted
→ workflowStatus COMPLETED
→ phase CREATED
→ missingFields none
→ real Customer ID returned
```

The run explicitly failed if the WhatsApp path rendered `ASK_CUSTOMER_PHONE`; it did not.

Terminal marker:

```text
MESSAGING_LOCAL_E2E_PASS
channel=WHATSAPP
phonePrefilled=true
scripted=true
agent=false
mcp=false
```

## Consent and negative-path coverage

The accumulated adapter regression suite still proves that `Ahora no` produces no canonical Workflow operation for both transports and that an invalid WhatsApp signature is rejected before adapter execution.

The human interactive run remains responsible for exercising at least one invalid Customer input through the live Workflow and confirming the same Workflow remains recoverable/active before continuing.

## Failure provenance

The first interactive-CI attempt is retained:

```text
Run       33896062496
Job       101098866437
Result    FAILURE
Artifact  9945799079
SHA-256   208db06ce14ef9f9cada55db1b485117350fe2a3e2a2a61d63ac9038ab2fdc2e
Stage     Telegram terminal smoke before any canonical event was processed
Cause     piped stdin + Node readline closed under non-TTY `docker compose run -T`
```

TypeScript and accumulated regressions were green in that failed run. The fix separated CI scripted mode from the human `readline` mode and used `docker compose run --no-deps` so the proof no longer depends on piped terminal behavior.

No Engine business invariant changed to fix this harness problem.

## Human test still required

The gate is **READY FOR EDUARDO TEST** but not yet human verified.

The human must run both:

```text
Telegram interactive mode
WhatsApp interactive mode
```

and confirm real Temporal/Customer completion. At least one invalid phone/email should be entered and recovered from during one run.

## Explicit non-claims

This evidence does not certify:

- real Telegram Bot API connectivity;
- a real Telegram bot/token;
- real Meta Cloud API connectivity;
- a real WhatsApp number/WABA;
- Kapso connectivity;
- public webhook reachability;
- outbound campaigns/promotions;
- Appointment over messaging;
- Scheduler runtime;
- Agent/MCP;
- production readiness.
