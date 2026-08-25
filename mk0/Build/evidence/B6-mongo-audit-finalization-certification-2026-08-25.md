# B6 — MongoDB Mandatory Audit + Finalization Certification

## Verdict

**CERTIFIED**

B6 is certified as the mandatory application audit + success-gating layer for the attachment-free mk0 `RegisterNewCustomer` core.

For the first time in mk0, `CREATED` and `ALREADY_EXISTS` are authorized terminal business outcomes because all applicable required MongoDB audit milestones are durably represented before PostgreSQL completion.

Attachment-bearing registration remains outside this certification and stays gated by B7.

## Certified source

```text
Repository: em3rc0dTh/Engines
Branch:     build/mk0-b6-mongo-audit-finalization
Source SHA: 4403738cfc55159874ca7597d65856ae76bcdd7a
```

## Final GitHub Actions receipt

```text
Workflow:   mk0 B6 Mongo audit and finalization certification
Run ID:     32870235091
Conclusion: success
```

Artifact:

```text
Name:   mk0-b6-mongo-audit-finalization-32870235091
ID:     9571761386
Digest: sha256:c138e851ef9bd088fb0685859857d2e243e86d8f4045b18e635a1b615d3107be
```

## Certified assertions

The structured B6 artifact reports all of the following as `PASS`:

```text
mongoIndexesIdempotent
 auditLogicalIdentityRetrySafe
 auditConflictRejected
 waitingSessionAlreadyAudited
 customerDataUpdateAuditedBeforeMutation
 newCustomerTerminalCreated
 hardDuplicateTerminalAlreadyExists
 softDuplicateWaitsWithoutCompletionAudit
 auditContainsNoCustomerPIIValues
 activityOnlyPersistenceAccess
 postgresCompletionGatedByAudit
 mongoFailureAfterCustomerCreateForbidsSuccess
 temporalRetriesMandatoryAudit
```

## MongoDB audit authority proven

The B6 runtime uses application collection:

```text
execution_audit
```

with retry-safe logical identity enforced by:

```text
eventId = SHA-256(workflowId + eventType + logicalKey)

UNIQUE(eventId)
UNIQUE(workflowId, eventType, logicalKey)
```

An exact retry reuses the logical event. A materially different payload for the same logical event identity is rejected with `MONGO_AUDIT_EVENT_CONFLICT` rather than silently rewriting evidence.

Observed audit indexes were initialized twice successfully.

## Required milestone behavior proven

The attachment-free created path durably represented:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
CUSTOMER_DATA_ACCEPTED            start envelope
REQUIRED_DATA_REQUESTED           because intent-only start waited
CUSTOMER_DATA_ACCEPTED            accepted Workflow Update
DUPLICATE_CHECK_COMPLETED
CUSTOMER_CREATED
REGISTRATION_COMPLETED
```

The hard-duplicate path durably represented the corresponding `EXISTING_CUSTOMER_RESOLVED` outcome milestone before completion.

The soft-match path persisted `DUPLICATE_CHECK_COMPLETED` but intentionally did not create `REGISTRATION_COMPLETED`; it remained `WAITING_FOR_DUPLICATE_DECISION`.

## Certified CREATED execution

```text
Workflow ID: register-customer:golden-business:25e2d4512a679309b1e2ac1c17b2485a
Run ID:      01a039af-978d-7a59-9bab-d2bed10fe5ca
Customer ID: cus_c566084f-6997-4800-be68-808976a8279a
Temporal:    COMPLETED
Result:      created = true
PostgreSQL:  COMPLETED_CREATED
Mongo audit: 8 applicable logical milestones
```

The Workflow began intent-only, was already audited while waiting, accepted audited Customer data through a Workflow Update, persisted one canonical PostgreSQL Customer, completed mandatory audit, and only then returned `CREATED`.

## Certified ALREADY_EXISTS execution

```text
Workflow ID: register-customer:golden-business:da7b7ec182c976de5dd4cb816868b1bf
Run ID:      01a039af-aa9a-714f-9878-07edf23f5720
Customer ID: cus_c566084f-6997-4800-be68-808976a8279a
Temporal:    COMPLETED
Result:      created = false
Reason:      HARD_UNIQUE
PostgreSQL:  COMPLETED_ALREADY_EXISTS
```

No second Golden Customer row was created.

## Certified soft duplicate behavior

```text
Workflow ID: register-customer:golden-business:f20086d2468fac06ce54410d92a16e1b
Workflow:    RUNNING
Phase:       WAITING_FOR_DUPLICATE_DECISION
PostgreSQL:  SOFT_DUPLICATE_PENDING_DECISION
```

`DUPLICATE_CHECK_COMPLETED` exists in MongoDB. `REGISTRATION_COMPLETED` does not. The Workflow was terminated only after certification evidence capture.

## Mandatory-audit failure proof

B6 deliberately injected Mongo failure at the `CUSTOMER_CREATED` milestone **after PostgreSQL had already created the Customer**.

Injected Worker evidence:

```text
forcedMongoAuditFailureEventType = CUSTOMER_CREATED
actual Worker PID was tracked directly
```

Failure execution:

```text
Workflow ID: register-customer:golden-business:bbe6543969ce6a7c0cc5d0074f0b74da
Run ID:      01a039af-ca06-750d-aa6e-3ec69195aa49
Customer ID: cus_ef1d53fd-fb02-427b-9aba-fec4af1d640e
```

Observed behavior:

```text
PostgreSQL Customer row exists                 PASS
registration status = CUSTOMER_CREATED_PENDING_AUDIT
Mongo CUSTOMER_CREATED absent                  PASS
Mongo REGISTRATION_COMPLETED absent             PASS
Temporal Activity attempt 1 failed              PASS
Temporal Activity attempt 2 failed              PASS
Temporal Activity attempt 3 failed              PASS
Workflow failed typed MONGO_AUDIT_STORE_UNAVAILABLE
terminal CREATED result forbidden               PASS
```

Temporal Event History ends with `EVENT_TYPE_WORKFLOW_EXECUTION_FAILED` and application failure type:

```text
MONGO_AUDIT_STORE_UNAVAILABLE
```

This proves a partial PostgreSQL write cannot be converted into false success when mandatory application audit is unavailable.

## Certification harness incident

The first B6 certification run proved all positive paths but its negative fault test was invalid because the CI killed the `npm` wrapper PID while the original happy Worker child remained alive on the same Task Queue. That Worker consumed the intended failure execution and completed it normally.

The harness was corrected without weakening product semantics:

- B6 Worker writes its actual Node PID to the certification PID file;
- injected Workers expose the exact fault event type in startup evidence;
- the happy Worker is therefore actually removed before the failure execution begins.

The complete B6 suite was then rerun from zero and passed.

## PII boundary

Certification explicitly inspected MongoDB audit and rejected leakage of the synthetic Customer email, document value and phone number. Audit contains IDs, milestone classifications, safe counts and policy/workflow metadata rather than a copied Customer body.

## Authority boundary

B6 preserves:

```text
Temporal Workflow
  └── proxyActivities only

PostgreSQL Activities/repositories
  └── Customer + registration/finalization truth

MongoDB Activities/repository
  └── mandatory application audit truth
```

The Workflow imports neither `pg` nor `mongodb`.

## B6 conclusion

The attachment-free mk0 execution core can now truthfully perform:

```text
CLI CTA
  ↓
canonical RegisterNewCustomer envelope
  ↓
real Temporal Workflow
  ↓
interactive waiting / Query / Update
  ↓
PostgreSQL Customer + registration authority
  ↓
MongoDB mandatory audit
  ↓
PostgreSQL audited finalization
  ↓
CREATED | ALREADY_EXISTS
```

with typed no-false-success failure semantics when mandatory audit is unavailable.

> **B6 = CERTIFIED. Attachment-free mk0 core execution path = COMPLETE. B7 remains GATED.**
