# G3-I4 — Kapso Real Provider Human Certification Runbook

## Purpose

This runbook is the human/real-provider boundary for `G3-I4`.

Deterministic CI can prove adapter mapping, secret indirection, error taxonomy, webhook normalization, durable idempotency and predecessor regressions. It cannot prove that Kapso actually accepted a request under the owner's real account or that a webhook was really signed/delivered by Kapso.

Therefore G3-I4 MUST NOT be promoted to `CERTIFIED` until both real-provider proofs below are captured.

## Safety and secret boundary

Never commit credential values or paste them into source files, receipts, PR comments, logs or Integration command/event payloads.

Use a local untracked environment file or export variables only in the local shell. Required secret values:

```text
KAPSO_API_KEY
KAPSO_WEBHOOK_SECRET
```

Non-secret runtime identifiers:

```text
KAPSO_PHONE_NUMBER_ID
KAPSO_TEST_RECIPIENT
KAPSO_TEST_BUSINESS_SLUG   optional; default i4-kapso-live
KAPSO_TEST_CONNECTION_REF optional; default kapso-live
```

The test recipient MUST be a number controlled/authorized by the tester. The outbound proof sends one real WhatsApp text.

## Preconditions

Checkout the current `build/g3-integration` head and start a clean local PostgreSQL lab.

```bash
git checkout build/g3-integration
git pull --ff-only origin build/g3-integration
cd mk1/runtime

docker compose up -d postgres
```

Apply Integration migrations in sequence:

```bash
npx tsx scripts/migrate-postgres-integration-g3-i1.ts
npx tsx scripts/migrate-postgres-integration-g3-i2.ts
npx tsx scripts/migrate-postgres-integration-g3-i3.ts
```

## A. Real outbound acceptance

Set the required values locally without committing them:

```bash
export KAPSO_API_KEY='...'
export KAPSO_WEBHOOK_SECRET='...'
export KAPSO_PHONE_NUMBER_ID='...'
export KAPSO_TEST_RECIPIENT='+<authorized test number>'
```

Execute:

```bash
npx tsx scripts/certify-integration-g3-i4-real-outbound.ts
```

Required terminal evidence:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
```

The marker includes only business/connection/operation identifiers, recipient and the provider message receipt ID. It MUST NOT include the API key or webhook secret.

A successful deterministic mock does not satisfy this proof. The adapter must execute the real HTTPS request against Kapso and receive a real provider message ID.

## B. Real signed webhook acceptance

Configure Kapso so that a real inbound WhatsApp message produces a webhook for the same phone number/connection. Capture the **exact raw request body before JSON reserialization** and the signature header value supplied by Kapso.

Store the raw body in an untracked local file, for example:

```text
/tmp/kapso-real-webhook.json
```

Then set:

```bash
export KAPSO_REAL_WEBHOOK_BODY_FILE='/tmp/kapso-real-webhook.json'
export KAPSO_REAL_WEBHOOK_SIGNATURE='...'
```

Optional only if Kapso reports different metadata for the real delivery:

```bash
export KAPSO_REAL_WEBHOOK_EVENT='whatsapp.message.received'
export KAPSO_REAL_WEBHOOK_PAYLOAD_VERSION='v2'
```

Execute:

```bash
npx tsx scripts/certify-integration-g3-i4-real-webhook.ts
```

Required terminal evidence:

```text
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
```

The script authenticates the raw body before durable acceptance, normalizes it to canonical `IntegrationEvent`, persists through the I3 dedup ledger and proves the secret/signature are absent from the canonical durable event.

## Promotion rule

Only after both markers are produced from the same configured real Kapso connection may G3-I4 documentation and ledger be promoted:

```text
G3-I4 CERTIFIED
G3-I5 NEXT
```

The human receipt should record only:

```text
git SHA
businessSlug
connectionRef
phoneNumberId
provider outbound receipt ID
provider inbound event identity
UTC timestamps
PASS markers
```

It MUST NOT record API keys, webhook secrets, Authorization values, raw signed webhook bodies containing private message content, or raw provider headers.

After the human receipt is committed, rerun the dedicated G3-I4 gate on the documentation-complete exact head. Certification does not authorize merging PR #33.
