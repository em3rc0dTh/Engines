# Integration G3-I0 certification evidence — 2026-09-16

## Verdict

**G3-I0 candidate proof passed and the gate is promoted for exact-final-head reseal.**

G3-I0 establishes only the canonical provider-neutral Integration contract and authority boundary. It does not certify external connectivity or delivery.

## Candidate implementation head

```text
branch  build/g3-integration
SHA     7a8cef71463217515c0d017dfaa5766ce7fe6f33
base    Scheduler G2 merged baseline 3b1d43d87ef7bb9805e01bcaaf8260008327b1f1
```

## Candidate dedicated runs

```text
Push  35133232783  SUCCESS
PR    35133238680  SUCCESS
```

Both exact-candidate runs completed:

```text
g3-i0-contracts-boundaries                PASS
g3-i0-protected-predecessor-regressions   PASS
integration-g3-i0-seal                    PASS
```

The same candidate also retained green inherited PR regressions for Telegram, WhatsApp/Kapso and Scheduler S0/S3/S4/S5/S6/S7, in addition to the protected regression suite embedded in the G3-I0 workflow.

## Candidate artifacts — push

```text
integration-g3-i0-contracts-35133232783
id      10461694983
sha256  92a77720a9482561abb26a4b6769b04342d41d35b722a76fc9f9bd629c4d59df

integration-g3-i0-regressions-35133232783
id      10462690446
sha256  a0904018a9beb1c4aef0f67b2f1fab07585b1252e5768537fc008c096e9e7174

integration-g3-i0-seal-35133232783
id      10462045768
sha256  56506f75f6e0c9a7e65d808bf672fb739c7272085dd7d7312a3757b817e6555b
```

## Candidate artifacts — PR

```text
integration-g3-i0-contracts-35133238680
id      10462525593
sha256  9dee7bea7363b24941dbc35de73f7cddd9ce4f14c869462674efef8ca29700a6

integration-g3-i0-regressions-35133238680
id      10462545659
sha256  8028a91ce7e79a52cab9705147a6459adf31ab6af86660333953c723897dea27

integration-g3-i0-seal-35133238680
id      10462230685
sha256  3c196e1e09d90f3068aaeafedee3fd4afbe1e4b25dc658111e4b19b0b88ed038
```

## Gate finding and repair

The first candidate correctly failed before promotion because TypeScript 7.0 rejected mutually recursive type aliases for canonical JSON (`TS2456`). The implementation was repaired by preserving the recursive JSON value semantics while representing `JsonObject` as a recursive readonly interface. No assertion, authority guard or certification condition was weakened.

The repaired candidate then passed TypeScript, contract tests, executable authority checks and protected regressions on both push and PR events.

## Certified contract surface

G3-I0 proves:

```text
IntegrationCommand provider-neutral schema
IntegrationEvent provider-neutral schema
exact canonical top-level fields
one canonical subjectRef XOR targetRef for commands
stable business-scoped outbound operation identity
stable business + connection scoped provider-event identity
recursive rejection of secret-like canonical payload material
rejection of provider HTTP/SDK mechanics from canonical payloads
no Scheduler/Services/CTA/Temporal implementation coupling in Integration contracts
existing interactive provider transports remain CTA/channel evidence
```

Terminal proof markers:

```text
INTEGRATION_G3_I0_AUTHORITY_BOUNDARY_PASS
INTEGRATION_G3_I0_PROVIDER_NEUTRAL_PASS
INTEGRATION_G3_I0_CONTRACTS_PASS
INTEGRATION_G3_I0_SECRET_BOUNDARY_PASS
INTEGRATION_G3_I0_IDENTITY_PASS
INTEGRATION_G3_I0_PREDECESSOR_REGRESSION_PASS
INTEGRATION_G3_I0_CERTIFICATION_PASS
```

## Explicit non-claims

G3-I0 does not claim configured external connections, secret storage, outbound persistence/delivery, durable retry, inbound HTTP/webhook transport, webhook authentication, persistent deduplication, provider acceptance, a real Integration provider adapter, Temporal Integration composition, production security, HA, SLA or release readiness.

Existing Telegram and WhatsApp/Kapso paths are intentionally not relabelled as Integration certification.

## Promotion rule

After this evidence, receipt, design, roadmap and machine ledger are documentation-complete, the same G3-I0 dedicated workflow must pass again on the resulting exact branch head for both push and PR before G3-I0 is considered finally certified. Final run IDs/digests are recorded on PR #33 without mutating the sealed head.
