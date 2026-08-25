# B5 — PostgreSQL Authority Certification

## Verdict

**CERTIFIED**

B5 is certified as the PostgreSQL Customer + registration/idempotency authority for the mk0 `RegisterNewCustomer` slice.

This certification does **not** authorize final `CREATED` / `ALREADY_EXISTS` publication yet. Mandatory MongoDB success-gating audit remains B6.

## Certified source

```text
Repository: em3rc0dTh/Engines
Branch:     build/mk0-b5-postgres-authority
Source SHA: 9a8caf10448720f20d4597b31c7dcf342724c926
```

## Final GitHub Actions receipt

```text
Workflow:  mk0 B5 PostgreSQL authority certification
Run ID:    32859253361
Conclusion: success
```

Artifact:

```text
Name:   mk0-b5-postgres-authority-32859253361
ID:     9567475292
Digest: sha256:abeb00d08ae11033ccbc2112c822c55c95e34c75d8a18c2c8257d6c3bdd1413f
```

## Certified assertions

The structured B5 evidence artifact reports all of the following as `PASS`:

```text
migrationIdempotent
relationalCustomerSchema
rawIdempotencyKeyNotPersisted
exactRegistrationReplay
fingerprintConflict
businessScopedKeyIsolation
repeatedCustomerCreateIdempotent
concurrentHardUniqueSingleCustomer
initialFingerprintImmutableAcrossUpdates
newCustomerCreatedOnce
hardDuplicateNoSecondCustomer
softDuplicateRequiresDecision
activityOnlyDatabaseAccess
noFinalSuccessBeforeB6
```

## PostgreSQL authority proven

B5 froze and executed the following application authority boundaries:

```text
PostgreSQL
├── customers
├── customer_contacts
├── customer_phones
├── customer_documents
└── registration_commands
```

The migration was applied twice successfully and the expected relational schema/indexes remained valid.

### Registration identity

Logical session uniqueness remains:

```text
(operation, business_slug, idempotency_key_hash)
```

The opaque idempotency key is hashed before persistence; certification explicitly checked that the raw probe key was absent from PostgreSQL.

The probe demonstrated:

```text
exact same scoped start → REPLAY
same scoped identity + different initial fingerprint → CONFLICT
same opaque key under another businessSlug → independent RESERVED identity
```

Later `ProvideCustomerData` Updates did not rewrite the initial command fingerprint.

## Policy-driven hard uniqueness

B5 deliberately does **not** install a universal SQL `UNIQUE(document)` constraint.

Hard-document uniqueness remains controlled by `RegistrationPolicy`. When that policy marks the document selector as `HARD_UNIQUE`, `createCustomer` uses a transaction-scoped PostgreSQL advisory lock derived from a stable SHA-256 ASCII representation of:

```text
[businessSlug, documentType, country, documentValue]
```

The final concurrent certification launched two independent registration commands with different idempotency keys but the same hard-unique document.

Observed result:

```text
resultKinds = [CREATED, HARD_DUPLICATE]
shared customerId = cus_d3253a19-1359-4d82-ad22-42833be50f07
Customer rows for that logical document = 1
```

This proves hard uniqueness without turning one business policy into a universal Engines database constraint.

## New Customer path

Certified Golden Customer execution:

```text
Workflow ID: register-customer:golden-business:05aec8fb7529f80ddfa057b7aa3c360b
Run ID:      01a0394f-24ad-7a69-a66b-afcb394779ac
Customer ID: cus_8b8a95cb-f6fb-4e55-bdd8-1c8c47961cc7
```

The Workflow progressed:

```text
WAITING_FOR_REQUIRED_DATA
→ ProvideCustomerData
→ REQUIRED_DATA_COMPLETE
→ PostgreSQL duplicate/persistence Activities
→ PERSISTING_AUDIT_CONTEXT
```

PostgreSQL stored normalized Customer evidence including:

```text
name:     Primary Customer
email:    primary@example.test
document: DNI / PE / 12345678
status:   CUSTOMER_CREATED_PENDING_AUDIT
```

At the pre-audit state:

```text
customerId = present
result     = absent
created    = absent
```

That absence is intentional and required: B5 cannot publish final business success before B6 mandatory audit.

## Hard duplicate path

A second Workflow with the same Golden hard-unique document resolved to the already-created Customer:

```text
Workflow ID: register-customer:golden-business:ab5778549346d1cabf14d1c998a7e3a3
Customer ID: cus_8b8a95cb-f6fb-4e55-bdd8-1c8c47961cc7
Phase:       PERSISTING_AUDIT_CONTEXT
PostgreSQL:  EXISTING_CUSTOMER_PENDING_AUDIT
```

No second Golden Customer row was created.

## Soft duplicate path

A soft-match-only Workflow resolved to:

```text
Workflow ID: register-customer:golden-business:819b56616cb85225423a5c8698e10ab5
Phase:       WAITING_FOR_DUPLICATE_DECISION
nextAction:  RESOLVE_DUPLICATE
Candidate:   cus_8b8a95cb-f6fb-4e55-bdd8-1c8c47961cc7
PostgreSQL:  SOFT_DUPLICATE_PENDING_DECISION
```

B5 therefore does not silently merge or auto-create when policy says the match is soft.

## Activity boundary

Database access remains behind Temporal Activities / persistence repository code.

The Workflow itself remains free of PostgreSQL/MongoDB drivers and direct SQL/network persistence calls.

CTA still cannot write PostgreSQL directly.

## Incident discovered during certification

The first full B5 CI run:

```text
Run ID:     32808833057
Source SHA: ead38088bfb76f0062efe48dac6b9dda139ce4f0
Conclusion: failure
```

failed in `createCustomer` because the original advisory-lock material used embedded NUL separators:

```text
businessSlug\u0000documentType\u0000country\u0000documentValue
```

PostgreSQL rejected this text parameter with:

```text
invalid byte sequence for encoding "UTF8": 0x00
```

Temporal correctly retried the Activity three times and then exposed the failure instead of falsely advancing the Workflow.

The lock representation was corrected to a stable SHA-256 ASCII string derived from the document identity tuple. No duplicate-policy semantics, Workflow semantics or B1 contract behavior were weakened to make CI green.

The subsequent full run `32859253361` passed every B5 gate.

## B5 certification boundary

B5 certifies:

```text
real PostgreSQL application authority
business-scoped registration reservation
initial-start fingerprint persistence
exact replay/conflict semantics
normalized relational Customer persistence
policy-driven hard duplicate resolution
soft duplicate candidate resolution
retry-safe/idempotent Customer create
Temporal Activity-only database side effects
PostgreSQL-backed pre-audit Workflow states
```

B5 does **not** certify:

```text
MongoDB required audit milestones
REGISTRATION_COMPLETED audit evidence
final CREATED publication
final ALREADY_EXISTS publication
AttachmentStore
scheduling behavior
Agent/Hermes
```

## Next authorized stage

```text
B6 — MongoDB mandatory interaction/audit Activities
```

B6 must provide the required audit milestones and success-gating behavior before the Workflow can truthfully publish successful `CREATED` or `ALREADY_EXISTS` outcomes.
