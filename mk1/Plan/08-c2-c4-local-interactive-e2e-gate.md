# Plan 08 — C2/C4 local interactive E2E gate

Date: 2026-09-04
Status: **AUTOMATED PASS — READY FOR EDUARDO TEST**

## Branch

`build/mk1-c2-c4-local-interactive-e2e`

Base: `build/mk1-c4-whatsapp-register-customer` after human 10/10 local adapter verification.

## Completed build sequence

1. ✅ Add interactive simulator composed from real channel core, PostgreSQL repository and Temporal customer port.
2. ✅ Add provider-shaped Telegram fixture events.
3. ✅ Add provider-shaped HMAC-verified WhatsApp fixture events with sender-phone prefill.
4. ✅ Add Compose `messaging-lab` one-off service.
5. ✅ Add package script for direct execution inside the Compose network.
6. ✅ Add separate scripted CI mode so automation does not depend on terminal stdin/readline behavior.
7. ✅ Re-run TypeScript, Customer V1/V2, channel C1B, Telegram and WhatsApp regressions.
8. ✅ Publish Draft PR #18 stacked on `build/mk1-c4-whatsapp-register-customer`.
9. ✅ Achieve green direct-source and PR-composition CI.
10. ⏳ Record Eduardo's Telegram and WhatsApp manual runs.

## Automated authority

```text
Source SHA   bfccd4a795400d2311201a880453b61b08d0b56a
Run          33896424897
Job          101100019937
Result       SUCCESS
Artifact     9945929946
SHA-256      92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e
```

Receipt: [`../Build/evidence/c2-c4-local-interactive-e2e-certification-2026-09-04.md`](../Build/evidence/c2-c4-local-interactive-e2e-certification-2026-09-04.md).

Verification ledger: [`../Test/c2-c4-local-interactive-e2e-2026-09-04.md`](../Test/c2-c4-local-interactive-e2e-2026-09-04.md).

## Manual success criteria

### WhatsApp

- consent YES starts one `RegisterNewCustomer` Workflow;
- verified synthetic sender phone appears in `knownFields` immediately;
- phone is not asked again;
- name and email are requested from live Temporal state;
- valid inputs reach Customer `CREATED`;
- real workflowId/runId/customerId are printed.

### Telegram

- consent YES starts one `RegisterNewCustomer` Workflow;
- Telegram chat/user identity is not treated as phone;
- name/phone/email requirements come from live Temporal state;
- shared-contact fixture can satisfy phone;
- valid inputs reach Customer `CREATED`;
- real workflowId/runId/customerId are printed.

## Negative behavior for the human run

During at least one channel run, enter one invalid email or phone intentionally.

Expected behavior:

```text
invalid value
→ canonical event rejected
→ same Temporal Workflow remains active
→ same missing field is requested again
→ valid replacement continues to CREATED
```

Consent NO remains adapter-regression protected and must never create a canonical start operation.

## Automated smoke result

Both provider modes ran against clean Compose infrastructure and emitted:

```text
MESSAGING_LOCAL_E2E_PASS channel=TELEGRAM
MESSAGING_LOCAL_E2E_PASS channel=WHATSAPP
```

WhatsApp additionally proved `phonePrefilled=true` and the CI failed closed if a phone question appeared.

## Failure provenance

Initial run `33896062496` failed because piped stdin closed Node readline under non-TTY Compose execution before any canonical provider event was processed. This was a harness failure. Scripted automation was separated from the human terminal UI; no Engine policy was weakened.

## Certification language

We may now claim:

> `C2/C4 local interactive deterministic E2E AUTOMATED PASS`.

We may not yet claim:

> `C2/C4 local interactive deterministic E2E HUMAN VERIFIED`.

That requires Eduardo to complete both manual modes.

Real Telegram Bot API, Meta Cloud API and Kapso remain outside this gate.
