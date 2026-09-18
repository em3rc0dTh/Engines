# Meta channel M1 — physical gate plan

Date: 2026-09-18

## Closed

- permanent HTTPS callback established;
- Meta callback verification passed;
- Facebook Page connected;
- `messages` and `messaging_postbacks` subscriptions enabled;
- real inbound Messenger payload observed from an allowed app-role account;
- real outbound Page reply observed;
- deterministic M1 message/postback CTA normalization added;
- unrelated external-account negative control produced no webhook event while the app remained in development mode.

## Physical access-boundary result

```text
allowed app-role account -> Page -> webhook   PASS
unrelated external account -> Page -> webhook NO EVENT OBSERVED
```

Marker:

```text
META_M1_EXTERNAL_USER_DEV_MODE_BLOCK_CONFIRMED
```

This closes the development-mode boundary observation, not public production access.

## Open

1. deploy raw-body `X-Hub-Signature-256` enforcement at the permanent edge callback;
2. prove an invalid signature fails closed;
3. bridge the real provider event into the Engines channel-core / CTA dispatcher;
4. complete a physical `register_appointment` workflow to persisted business state;
5. replay the exact provider event and prove idempotency;
6. complete the applicable Meta production access/review and prove a real non-role external account reaches the webhook.

## Next provider lane

Facebook Comments follows after M1 is sealed. Comment ingress must remain a separate provider contract with public-to-private continuation rules.
