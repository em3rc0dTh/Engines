# Plan 08 — C2/C4 local interactive E2E gate

Date: 2026-09-04
Status: BUILDING

## Branch

`build/mk1-c2-c4-local-interactive-e2e`

Base: `build/mk1-c4-whatsapp-register-customer` after human 10/10 local adapter verification.

## Build sequence

1. Add interactive simulator composed from real channel core, PostgreSQL repository and Temporal customer port.
2. Add provider-shaped Telegram fixture events.
3. Add provider-shaped HMAC-verified WhatsApp fixture events with sender-phone prefill.
4. Add Compose `messaging-lab` one-off service.
5. Add package script for direct execution inside the Compose network.
6. Add automated non-interactive smoke for Telegram and WhatsApp using piped stdin.
7. Re-run TypeScript, Customer V1/V2, channel C1B, Telegram and WhatsApp regressions.
8. Publish a draft stacked PR.
9. Mark `READY FOR EDUARDO TEST` only after CI is green.
10. Record Eduardo's two manual runs separately from automated certification.

## Manual success criteria

### WhatsApp

- consent YES starts one `RegisterNewCustomer` Workflow;
- verified synthetic sender phone appears in `knownFields` immediately;
- phone is not asked again;
- name and email are requested from live Temporal state;
- valid inputs reach Customer `CREATED`;
- real workflowId/customerId are printed.

### Telegram

- consent YES starts one `RegisterNewCustomer` Workflow;
- Telegram chat/user identity is not treated as phone;
- name/phone/email requirements come from live Temporal state;
- shared-contact fixture can satisfy phone;
- valid inputs reach Customer `CREATED`;
- real workflowId/customerId are printed.

## Negative behavior

At least one invalid email or phone may be entered manually. It must be rejected without fabricating completion or starting a second Workflow.

Consent NO must exit before any Workflow start.

## Automated smoke

CI will run both channels against clean Compose infrastructure using deterministic terminal input and require channel-specific `MESSAGING_LOCAL_E2E_PASS` markers.

## Certification language

If automated smoke passes, we may claim:

`C2/C4 local interactive deterministic E2E AUTOMATED PASS`.

After Eduardo completes both manual modes, we may additionally claim:

`C2/C4 local interactive deterministic E2E HUMAN VERIFIED`.

We still may not claim real Telegram Bot API, Meta Cloud API or Kapso certification.
