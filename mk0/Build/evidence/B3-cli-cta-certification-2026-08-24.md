# B3 CLI CTA Adapter Certification — 2026-08-24

## Verdict

**B3 = CERTIFIED**

B3 certifies the first replaceable CTA transport boundary for mk0.

The CLI accepts transport-specific input, injects channel metadata, constructs the B1 canonical `RegisterNewCustomer` envelope and performs only structural/session validation. It does not own business completeness, Temporal execution or persistence.

## Certified source

```text
repository:  em3rc0dTh/Engines
branch:      build/mk0-b3-cli-cta-adapter
commit:      d36a764250a268f1116b15cc7f0c38f5f63209e1
CI run:      32807766733
artifact:    mk0-b3-cli-cta-32807766733
artifact id: 9548722559
artifact sha256:
             a117b2ff37ca4596d372362f0a7c55afac8151fc058f7418b3c94e954abdb1ff
```

## Certified CTA boundary

```text
CLI command + JSON payload
        ↓
CLI parser
        ↓
adaptRegisterNewCustomerCtaInput
        ↓
B1 validateRegisterNewCustomerStart
        ↓
canonical RegisterNewCustomerStartEnvelope
        ↓
READY_FOR_ORCHESTRATION
```

The orchestration dependency is represented only by `RegisterNewCustomerOrchestrationPort`. B3 does not bind that port to Temporal yet; that begins in B4.

## Intent-only observation

Real CLI smoke:

```text
register-new-customer
businessSlug:   golden-business
idempotencyKey: b3-smoke-intent
correlationId:  b3-corr
```

Observed result:

```json
{
  "ok": true,
  "status": "READY_FOR_ORCHESTRATION",
  "envelope": {
    "operation": "RegisterNewCustomer",
    "businessSlug": "golden-business",
    "draft": {"customer": {}},
    "request": {
      "idempotencyKey": "b3-smoke-intent",
      "correlationId": "b3-corr",
      "channel": "cli"
    },
    "schemaVersion": "mk0.register-customer.v0"
  }
}
```

No name, email, phone, document or attachment was required by the CLI. This preserves the B1/B2 rule that business completeness is not CTA authority.

## Full Customer observation

The CLI also accepted input through stdin and delegated normalization to B1.

Observed canonical Customer fragment:

```json
{
  "name": "Ada Lovelace",
  "contact": {"email": "ada@example.com"}
}
```

## Rejection observation

Unknown CLI command:

```text
delete-customer
```

Observed result:

```json
{
  "ok": false,
  "status": "REJECTED",
  "issues": [
    {
      "code": "UNKNOWN_OPERATION",
      "path": "command"
    }
  ]
}
```

The executable returned the expected rejection exit code rather than pretending the command reached orchestration.

## Assertions

```text
locked npm install                         PASS
strict TypeScript type-check              PASS
B1 contract regression                    PASS
B3 CTA unit/contract tests                PASS
intent-only CLI acceptance                PASS
full Customer CLI acceptance              PASS
canonical B1 normalization                PASS
unknown command rejection                 PASS
channel metadata injection                PASS
no direct Temporal SDK dependency in CTA  PASS
no direct pg/mongodb dependency in CTA    PASS
no hidden business Workflow in CTA        PASS
```

## Scope boundary

B3 does not prove Workflow acceptance. `READY_FOR_ORCHESTRATION` means the transport boundary has accepted and canonicalized the input; it does not mean Temporal has started an execution.

B4 is responsible for binding `RegisterNewCustomerOrchestrationPort` to the real Temporal Client/Workflow and proving the durable interactive `GetRegistrationState` + `ProvideCustomerData` behavior.
