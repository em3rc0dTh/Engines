# Evidence receipt — C2/C4 local interactive customer registration

Date: 2026-09-04
Verdict: **AUTOMATED LOCAL DETERMINISTIC E2E PASS — HUMAN TEST PENDING**

## Executed source

```text
Branch       build/mk1-c2-c4-local-interactive-e2e
Source SHA   bfccd4a795400d2311201a880453b61b08d0b56a
Workflow     MK1 C2/C4 Local Interactive E2E
Run          33896424897
Job          101100019937
Conclusion   SUCCESS
Artifact     9945929946
Artifact SHA256
             92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e
```

The run was a push event and executed the source SHA directly.

A PR composition run also completed successfully:

```text
Run          33896430272
Job          101100038219
Artifact     9945937609
SHA256       9bfe20b7997f368effd1202b1ab426f58644e09737c297c8c4df36e6e120c7a5
Conclusion   SUCCESS
```

## What ran

```text
npm ci
npm run check
npm run test:b1
npm run test:channel:c1b
Telegram + WhatsApp adapter tests
clean Docker Compose infrastructure
Telegram scripted interactive lab
WhatsApp scripted interactive lab
PostgreSQL binding/event evidence capture
Worker log capture
artifact upload
clean teardown
```

## Direct runtime proof

### Telegram

The real Temporal registration state evolved from:

```text
missingFields = name, phone, email
```

to:

```text
knownFields = name
missingFields = phone, email
```

then after a Telegram shared-contact-shaped event:

```text
knownFields = name, phone
missingFields = email
```

and finally:

```text
workflowStatus = COMPLETED
phase          = CREATED
missingFields  = none
Customer ID    = present
```

Marker:

```text
MESSAGING_LOCAL_E2E_PASS channel=TELEGRAM phonePrefilled=false scripted=true agent=false mcp=false
```

### WhatsApp

A synthetic inbound request was HMAC-signed and verified by `MetaCloudApiTransport` before adapter execution.

Immediately after consent/start the real Temporal projection showed:

```text
knownFields   = phone
missingFields = name, email
```

The lab then supplied only name and email. No phone question was rendered. Terminal state was:

```text
workflowStatus = COMPLETED
phase          = CREATED
missingFields  = none
Customer ID    = present
```

Marker:

```text
MESSAGING_LOCAL_E2E_PASS channel=WHATSAPP phonePrefilled=true scripted=true agent=false mcp=false
```

## Engine-first proof

Both transports converged on the same runtime composition:

```text
provider-shaped fixture
→ provider adapter
→ CanonicalChannelEnvelope
→ CustomerRegistrationChannelExecutionCore
→ PostgreSQL durable event/binding ledger
→ Temporal RegisterNewCustomer
→ Customer persistence/audit
```

No provider-specific Customer Workflow or business-state machine was introduced.

## Regression proof

```text
Customer contracts V1/V2     26 / 26 PASS
C1B channel semantics          5 / 5 PASS
Telegram/WhatsApp adapters    10 / 10 PASS
TypeScript                     PASS
```

## Failure provenance retained

Initial run:

```text
Run       33896062496
Job       101098866437
Result    FAILURE
Artifact  9945799079
SHA256    208db06ce14ef9f9cada55db1b485117350fe2a3e2a2a61d63ac9038ab2fdc2e
```

The failure occurred before any canonical Telegram event because piped stdin caused `readline was closed` under non-TTY Compose execution. The fix added a separate scripted CI mode while retaining the human interactive mode unchanged in purpose.

## Evidence artifact contents

The successful artifact contains at least:

```text
Telegram terminal transcript
WhatsApp terminal transcript
Compose process projection
Worker log
PostgreSQL channel conversation bindings projection
PostgreSQL inbound events projection
git-sha.txt
```

## Bounded claim

This receipt supports only:

> **Telegram-shaped and WhatsApp-shaped local transports can drive the real durable Engines Customer registration path through Temporal to Customer CREATED using the same Engine and without external provider credentials.**

It does not support a claim of real Telegram, Meta Cloud API, Kapso, public webhook or production certification.

## Human gate

Automated proof is complete. The next requirement is Eduardo's direct interactive run of both provider modes using `docker compose run --rm messaging-lab`.
