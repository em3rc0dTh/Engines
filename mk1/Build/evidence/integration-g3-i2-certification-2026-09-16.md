# Integration G3-I2 Certification Evidence — 2026-09-16

## Scope

Gate: `G3-I2 — Durable Outbound Command + Retry / Idempotency Ledger`

Canonical branch: `build/g3-integration`

Predecessor: `G3-I1 CERTIFIED`.

## Candidate implementation evidence

The implementation candidate on head `17dcd61bafddf420c3160976996151176ce635c1` passed the dedicated PR workflow before documentary promotion.

Candidate run:

```text
PR 35148540870  SUCCESS
```

Jobs:

```text
g3-i2-outbound-contracts                PASS
g3-i2-postgres-outbound                 PASS
g3-i2-protected-predecessor-regressions PASS
integration-g3-i2-seal                  PASS
```

Candidate artifacts:

```text
integration-g3-i2-contracts-35148540870
id      10468216351
sha256  013626a81b4818cf5c58d1488860339247ea9c27be81244cb19612d706832773

integration-g3-i2-postgres-35148540870
id      10468865336
sha256  abf1046aac2d91a329efa75372eda486b5811489497f8dbb7cb8a62256c1b7bd

integration-g3-i2-seal-35148540870
id      10468765372
sha256  87285d29bb850634842a44a875bd446ad647a2108a37379610f117a6f5be0a25
```

This candidate is not the terminal exact-head seal because the receipt, evidence, design status and sequential certification ledger are promoted afterward. The dedicated gate must pass again on the documentation-complete head.

## Durable model

Migration `013_integration_outbound_ledger.sql` establishes durable Integration-owned outbound command and attempt state.

Authority properties:

```text
operation identity       business_slug + operation_id
connection authority     resolved through the I1 registry
command state            durable PostgreSQL state
attempt history          durable PostgreSQL state
secret material          NOT STORED
```

## Idempotency proof

The certifier enqueues one operation, replays the same semantic material and verifies the existing durable command is returned. A mutation under the same operation identity is rejected with `IDEMPOTENCY_CONFLICT`.

## Atomic-claim proof

Two concurrent claims against the same ready operation produce exactly one winner. This establishes the I2 ownership boundary required before a provider adapter can safely perform an external side effect.

## Retry and terminal proof

The certifier proves `RETRY_WAIT`, `nextAttemptAt`, bounded max attempts, `FAILED_PERMANENT`, successful retry completion and terminal replay without a duplicate delivery attempt.

## Lease-recovery proof

An in-flight claim may be recovered only after its lease expires. The abandoned attempt is recorded as `LEASE_EXPIRED` and the subsequent claim receives a new attempt number.

## Business-isolation proof

The same `operationId` is enqueued independently for a second business while business A retains its own terminal state. Durable operation identity therefore remains tenant scoped.

## Secret-boundary proof

The certifier introspects `integration_outbound_commands` and `integration_outbound_attempts` and rejects forbidden credential-bearing columns including token, API key, password, credential, authorization and raw response fields.

## Protected predecessors

The dedicated workflow re-certifies I0 and I1 and reruns protected Scheduler, Services, Appointment, CTA and channel regressions. All shell pipelines in the I2 workflow execute fail-closed with `bash --noprofile --norc -eo pipefail`.

## Truth boundary

G3-I2 proves durable provider-neutral outbound execution mechanics. It does not prove webhook authentication/dedup, a concrete provider adapter, provider acceptance, Temporal composition, Agent/MCP, or production readiness.

## Final-seal requirement

The terminal exact head is established only after documentation-complete branch mutations stop and the dedicated G3-I2 workflow passes on that same SHA. Final run/artifact IDs may be recorded in PR #33 without mutating the sealed head.
