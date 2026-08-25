# B4 Interactive RegisterNewCustomer Workflow Certification — 2026-08-24

## Verdict

**B4 = CERTIFIED**

B4 certifies the first real interactive `RegisterNewCustomer` Workflow in Temporal.

The certification deliberately stops before persistence success. B4 proves durable policy-driven interaction state, Query/Update behavior, Worker replacement and input deduplication. PostgreSQL duplicate/customer/registration authority begins in B5; MongoDB mandatory application audit begins in B6.

## Certified source

```text
repository:  em3rc0dTh/Engines
branch:      build/mk0-b4-interactive-registration-workflow
commit:      3036e815b3d3bc6163d9fedc5fba3146ba9b5bb9
CI run:      32808212559
artifact:    mk0-b4-interactive-registration-32808212559
artifact id: 9548863556
artifact sha256:
             c028dff205165ed9e855f601fa7d88943cc0994fb72e76bb076aff95942cbbd2
```

## Observed durable execution

```text
Workflow type: registerNewCustomerWorkflow
Workflow ID:   register-customer:golden-business:9cb9fc4270d313cc171c8c03dbeffdac
Run ID:        01a03720-d905-73ec-965f-2e8e2756e1f1
Task Queue:    engines-mk0-registration
Policy ID:     golden-registration-v1
Policy version:1
CTA channel:   cli
Correlation ID:b4-correlation-001
```

## Initial intent-only state

The Workflow was started through the certified B3 CLI adapter and the B4 Temporal orchestration port with no Customer business fields.

Observed Query state:

```text
workflowStatus: RUNNING
phase:          WAITING_FOR_REQUIRED_DATA
knownFields:    []
missingFields:
  - customer.name
  - customer.contact.phoneOrEmail
nextAction:     PROVIDE_CUSTOMER_DATA
```

No CTA/pre-start rejection occurred merely because Customer data was incomplete.

## First Update

`ProvideCustomerData` was executed with:

```json
{
  "inputId": "b4-name-1",
  "customerPatch": {"name": "Ada Lovelace"}
}
```

Observed state after the Update:

```text
phase:        WAITING_FOR_REQUIRED_DATA
knownFields:  [customer.name]
missingFields:[customer.contact.phoneOrEmail]
```

## Worker replacement proof

Worker process #1 was terminated with SIGKILL after the first Update had completed.

```text
Worker #1 PID: 2378
termination:   SIGKILL
Worker #2 PID: 2619
```

Before Worker #2 started, Temporal still reported the exact Workflow ID + Run ID as a running execution.

After Worker #2 started, `GetRegistrationState` reconstructed:

```text
knownFields:   [customer.name]
missingFields: [customer.contact.phoneOrEmail]
phase:         WAITING_FOR_REQUIRED_DATA
```

The accepted Customer patch therefore survived Worker process loss.

## Update deduplication proof

The already accepted `inputId = b4-name-1` was replayed with intentionally different data:

```json
{
  "inputId": "b4-name-1",
  "customerPatch": {
    "contact": {"email": "should-not-apply@example.com"}
  }
}
```

Observed result:

```text
duplicateInput: true
phase:          WAITING_FOR_REQUIRED_DATA
missingFields:  [customer.contact.phoneOrEmail]
```

The altered payload was not applied. Deduplication state therefore survived Workflow replay/Worker replacement.

## Second Update and completeness transition

A distinct Update was then executed:

```json
{
  "inputId": "b4-email-2",
  "customerPatch": {
    "contact": {"email": "ADA@EXAMPLE.COM"}
  }
}
```

Observed state:

```text
workflowStatus: RUNNING
phase:          REQUIRED_DATA_COMPLETE
knownFields:
  - customer.name
  - customer.contact.phoneOrEmail
missingFields:  []
nextAction:     NONE
created:        absent
result:         absent
```

A fresh reconnect/query of the same Workflow ID + Run ID returned the same durable state.

## Event History

Temporal Event History was captured before terminating the laboratory execution and contained Workflow Update evidence for `ProvideCustomerData`.

The proof Workflow was terminated only after the required B4 evidence had been captured because B5/B6 persistence stages do not yet exist. Termination is a laboratory cleanup action, not a business outcome.

## Assertions

```text
locked npm install                           PASS
strict TypeScript type-check                PASS
B1 contracts regression                     PASS
B3 CTA regression                           PASS
CLI → Temporal real Workflow start          PASS
intent-only start → WAITING                  PASS
GetRegistrationState missing-field query    PASS
ProvideCustomerData Update                  PASS
Worker #1 SIGKILL                           PASS
same execution visible without Worker       PASS
Worker #2 replay preserved Customer state   PASS
same inputId deduplicated after restart     PASS
second inputId completed required data      PASS
same Workflow ID + Run ID                   PASS
reconnect Query stable                      PASS
Workflow Update Event History captured      PASS
CREATED / ALREADY_EXISTS not claimed        PASS
PostgreSQL/MongoDB side effects absent      PASS
proof execution terminated after evidence   PASS
```

## Architectural consequence

The following mk0 claim is now evidence-backed:

> A channel may start a legal registration intent before Customer completeness exists; Temporal owns the same durable interactive session across Queries, Updates, CTA reconnects and Worker replacement, while business completeness remains policy-driven.

B4 does **not** prove duplicate detection, Customer creation, registration-command persistence, mandatory MongoDB audit, attachments or terminal business success. Those remain B5/B6/B7 responsibilities.
