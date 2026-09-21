# C2/C4 local transport harness — human verification

Date: 2026-09-04
Branch: `build/mk1-c4-whatsapp-register-customer`
Source under test: `5e09b9fb6d30c5f9a7612df061c428cbcfd91b8a`
Environment: Windows PowerShell / local developer machine

## Verdict

**LOCAL DETERMINISTIC TRANSPORT HARNESS — HUMAN VERIFIED**

This verification proves that the Telegram and WhatsApp CTA transport adapter tests execute successfully from the terminal branch containing both stacked implementations.

It does **not** certify real Telegram Bot API, Meta Cloud API, Kapso, public webhook delivery, provider onboarding, or production behavior.

## Preparation observed

The local clone fetched the new remote branches, including:

- `build/mk1-c2-telegram-register-customer`
- `build/mk1-c4-whatsapp-register-customer`
- `build/mk1-customer-registration-channel-core`
- `build/mk1-customer-registration-policy-v2`

The user then switched to:

```text
build/mk1-c4-whatsapp-register-customer
```

and confirmed:

```text
HEAD = 5e09b9fb6d30c5f9a7612df061c428cbcfd91b8a
```

## Commands executed

```powershell
cd C:\Users\eduar\Desktop\VTKALL\Engines

git fetch origin --prune
git switch --track origin/build/mk1-c4-whatsapp-register-customer
git branch --show-current
git rev-parse HEAD

cd mk1\runtime
npm ci
npm run check
npx tsx --test src/cta/telegram/telegram.adapter.test.ts src/cta/whatsapp/whatsapp.adapter.test.ts
```

## Results

TypeScript:

```text
npm run check
PASS
```

Transport adapter suite:

```text
tests       10
pass        10
fail        0
cancelled   0
skipped     0
todo        0
```

### Telegram cases observed PASS

- `TG-RNC-002` affirmative callback starts consented registration with canonical identities
- `CH-RNC-002` negative consent creates no canonical Workflow operation
- `TG-RNC-001` text maps only through the core-provided render intent
- `TG-RNC-003` shared contact supplies a phone patch without owning completeness
- Telegram renderer exposes inline consent and native shared-contact affordance

### WhatsApp cases observed PASS

- `WA-RNC-005` unauthenticated webhook rejected before the adapter
- `WA-RNC-001` verified inbound crosses the transport port
- `WA-RNC-002` consent start prefills verified sender phone
- `WA-RNC-003` text needs a core-derived intent and maps to one patch
- `WA-RNC-004` negative interactive consent produces no Workflow operation

## Architecture boundary preserved by this proof

```text
Telegram / WhatsApp
        ↓
CTA transport adapter
        ↓
canonical channel contract
        ↓
Engine-owned execution path
```

The test confirms transport normalization/renderer behavior. Customer completeness, registration policy and Workflow ownership remain outside provider-specific code.

## Non-claims

This human verification does not prove:

- a real Telegram bot token or Telegram Bot API session;
- real long polling against Telegram;
- real WhatsApp Business Platform delivery;
- Meta Cloud API account onboarding;
- Kapso account onboarding;
- public HTTPS webhook receipt;
- physical provider retry/restart behavior;
- production readiness.

## Next manual proof

The next useful human test is an interactive local registration harness backed by the real ChannelExecutionCore + Temporal `RegisterNewCustomer` Workflow. It should allow the user to choose Telegram or WhatsApp presentation, accept/decline consent, enter the requested fields, and observe the same durable Workflow state until Customer creation.
