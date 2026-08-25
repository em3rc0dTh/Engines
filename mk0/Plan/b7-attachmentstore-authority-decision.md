# B7 — AttachmentStore project-authority decision package

## Status

**READY FOR PROJECT AUTHORITY DECISION — NOT B7 AUTHORIZATION**

This document prepares the next mk0 gate after the attachment-free core became system-certified.

It does not authorize B7 by itself.

Current proven state:

```text
B0–B6                            ✅ CERTIFIED
attachment-free integrated core ✅ 14 / 14 Golden PASS
B7 AttachmentStore              🔒 GATED
attachment Golden cases         GD-003 / GD-004 / GD-009 / GD-010
full mk0                         NOT YET COMPLETE
```

Integrated core receipt:

```text
Source SHA: f0896c58d918e8f3971c78867870243e16a8b604
Run ID:     32873848134
Artifact:   mk0-core-golden-release-32873848134
Digest:     sha256:25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
```

---

# 1. Decision required

Project authority must decide whether to authorize B7 and, if so, freeze the physical laboratory AttachmentStore profile before implementation begins.

The decision must answer:

```text
1. What physically stores staged/committed binary bytes in mk0?
2. How is logical attachment identity separated from binary integrity identity?
3. How is stage → commit made retry-safe?
4. How are SHA-256 / byte length / media type verified?
5. How are unused staged objects expired?
6. How are orphan/reconciliation candidates surfaced?
7. Which synthetic fixture binaries and expected hashes are normative?
8. Which limits are frozen for the mk0 laboratory?
```

---

# 2. Existing architecture constraints

B7 must preserve the already-approved authority split:

```text
binary/document truth → AttachmentStore
business reference     → PostgreSQL
orchestration          → Temporal
interaction audit      → MongoDB
```

A staged attachment is technical ingress only.

A registration with attachments cannot reach successful terminal finalization until every applicable attachment is:

```text
resolved
integrity-verified
committed idempotently
linked from PostgreSQL
represented by mandatory ATTACHMENT_COMMITTED audit evidence
```

Raw attachment bytes must not be carried through normal Temporal Workflow History payloads and must not be copied into MongoDB audit.

---

# 3. Physical technology options

## Option A — local filesystem-backed AttachmentStore

Use the local filesystem as the physical binary store behind an explicit `AttachmentStore` port.

Recommended logical layout:

```text
attachment-store/
├── ingress/
│   └── <ingressRef>/
│       ├── metadata.json
│       └── payload.bin
├── objects/
│   └── sha256/
│       └── <sha256>
├── committed/
│   └── <attachmentId>.json
└── quarantine-or-orphans/
```

Logical identity and binary identity remain separate:

```text
ingressRef    = stable staging identity
attachmentId  = stable logical committed attachment identity
sha256        = immutable binary integrity/content identity
```

Two distinct logical attachments may contain identical bytes while sharing the same content-addressed blob. A retry of the **same ingressRef**, however, must always resolve the same logical `attachmentId`.

### Advantages

- deterministic GitHub Actions certification;
- no external service or vendor dependency;
- no credentials/secrets required for mk0;
- exercises the exact architecture contract rather than a provider API;
- easy synthetic corruption, expiry and orphan fault injection;
- simple atomic commit using temporary files + rename;
- easy later replacement with S3-compatible/cloud/object-store adapters behind the same port.

### Limitations

- not itself a production distributed object store;
- production replication/durability/encryption is not proven by this laboratory backend;
- multi-host coordination remains a later deployment concern.

Classification:

```text
BEST FIT FOR MK0 LABORATORY
```

---

## Option B — S3-compatible/object-storage service in the laboratory

Use a local or remote S3-compatible service as the AttachmentStore implementation.

### Advantages

- closer to a typical production object-storage API;
- object-store semantics are exercised directly.

### Costs for mk0

- additional service/runtime dependency;
- image/version/credential configuration becomes part of certification;
- provider behavior can distract from proving the Engines AttachmentStore contract;
- more moving parts for four small Golden cases.

Classification:

```text
VALID, BUT NOT REQUIRED TO PROVE MK0 ARCHITECTURE
```

---

## Option C — MongoDB GridFS

Use GridFS for binary storage while MongoDB also hosts application audit/context.

### Advantages

- existing MongoDB runtime already exists;
- mature binary-chunk storage model.

### Architectural disadvantage

It physically couples two authorities that the design intentionally separates conceptually:

```text
MongoDB audit/context
AttachmentStore binary truth
```

The contract boundary could still be preserved in code, but the laboratory would teach us less about independent attachment capability replacement.

Classification:

```text
TECHNICALLY POSSIBLE / NOT RECOMMENDED FOR THIS PROOF
```

---

# 4. Recommended B7 technology decision

**Recommendation: Option A — filesystem-backed content-addressed AttachmentStore for the mk0 laboratory.**

This recommendation is deliberately about **mk0 proof quality**, not a permanent production storage selection.

The production-facing contract remains provider-neutral:

```text
AttachmentStorePort
  stage(...)
  resolveIngress(...)
  commit(...)
  getMetadata(...)
  open/read(...)
  expire(...)
  listReconciliationCandidates(...)
```

Future adapters can target S3-compatible storage, cloud object storage or another approved system without changing `RegisterNewCustomer` Workflow semantics.

---

# 5. Recommended physical identity model

## Ingress identity

`ingressRef` is opaque and generated at staging time.

Conceptual value:

```text
ing_<random-or-uuid>
```

It identifies one staged logical ingress, not file content.

Required stage metadata:

```text
ingressRef
mediaType
byteLength
expectedSha256
createdAt
expiresAt
original/display name when safe
state = STAGED
```

## Committed logical identity

`attachmentId` is opaque and stable for a committed ingress.

Conceptual value:

```text
att_<random-or-uuid>
```

Retry rule:

```text
same ingressRef + same expected integrity
→ same attachmentId
→ no second logical committed attachment
```

Conflict rule:

```text
same ingressRef + materially different expected integrity
→ ATTACHMENT_INGRESS_CONFLICT
```

## Binary identity

The binary object is content-addressed by lowercase SHA-256:

```text
objects/sha256/<64-hex-digest>
```

Binary deduplication is an implementation optimization only. Business logic continues to reference `attachmentId`, not raw storage path/hash.

---

# 6. Recommended atomic stage / commit model

## Stage

```text
receive bytes outside Workflow History
→ stream bytes to temporary ingress payload
→ calculate SHA-256 and byte length while streaming
→ compare with declared integrity metadata
→ atomically publish STAGED metadata + payload
→ return ingressRef
```

If stage integrity does not match declared metadata:

```text
ATTACHMENT_INTEGRITY_MISMATCH
```

No Temporal Workflow start should receive a supposedly-valid ingressRef for a stage operation that failed integrity validation.

## Resolve ingress

`resolveIngress(ingressRef)` returns metadata only, not an unrestricted binary payload through Workflow state.

It must distinguish:

```text
STAGED
EXPIRED
COMMITTED
MISSING
CONFLICT / CORRUPT
```

## Commit

Conceptual Activity flow:

```text
resolve ingressRef
→ reject expired/missing/corrupt ingress
→ re-read or stream-verify binary integrity
→ ensure content-addressed object exists atomically
→ create stable committed logical metadata for attachmentId
→ mark ingress committed/resolved
→ return attachmentId + integrity metadata
```

Atomic filesystem publication should use same-filesystem temporary paths and rename semantics rather than exposing partially-written committed objects.

---

# 7. PostgreSQL reference contract

B7 should add a canonical Customer attachment-reference relation, conceptually:

```text
customer_id
attachment_id
kind
display_name
media_type
byte_length
sha256
committed_at
```

PostgreSQL stores the business linkage and immutable integrity evidence required for Customer truth.

It does **not** store the attachment bytes.

Retry of the same logical link must be idempotent.

---

# 8. MongoDB audit contract

For every attachment successfully committed as part of the registration, the applicable mandatory audit milestone must exist:

```text
ATTACHMENT_COMMITTED
```

Recommended safe metadata:

```text
attachmentId
ingress identity hash or safe opaque ingressRef
kind
mediaType
byteLength
sha256
```

Do not store:

```text
raw attachment bytes
base64 copies
unrestricted file contents
credentials
storage filesystem paths as business API contract
```

---

# 9. Recommended mk0 laboratory limits

These values are proposed for **mk0 certification only** and are not production limits.

```text
maximum attachment count per RegisterNewCustomer = 4
maximum single attachment byte length            = 1 MiB
maximum total attachment bytes per registration  = 2 MiB
staged ingress TTL                                = 15 minutes
SHA algorithm                                     = SHA-256
allowed Golden fixture media types                = image/png, text/plain
```

Rationale:

- enough to exercise one/multiple-attachment behavior;
- small enough to keep CI deterministic and fast;
- avoids teaching the Workflow to transport large payloads;
- production policy remains a later configuration/security decision.

Project authority may change these before approval; once approved, B7 tests must treat them as frozen laboratory policy.

---

# 10. Proposed synthetic fixture set

The fixture binaries themselves must be committed before B7 runtime certification. Hashes are **not considered frozen until the committed bytes exist**.

Recommended fixture identities:

## Fixture F1 — synthetic identity image

```text
fixtureId:  synthetic-id-front-v1
file:       mk0/golden-dataset/fixtures/synthetic-id-front-v1.png
mediaType:  image/png
purpose:    GD-003 + first object in GD-004
sha256:     TO_BE_COMPUTED_FROM_COMMITTED_BINARY
byteLength: TO_BE_COMPUTED_FROM_COMMITTED_BINARY
```

Requirements:

- tiny valid PNG;
- contains no real document/PII;
- deterministic committed bytes.

## Fixture F2 — synthetic supporting document

```text
fixtureId:  synthetic-supporting-document-v1
file:       mk0/golden-dataset/fixtures/synthetic-supporting-document-v1.txt
mediaType:  text/plain
purpose:    second object in GD-004
sha256:     TO_BE_COMPUTED_FROM_COMMITTED_BINARY
byteLength: TO_BE_COMPUTED_FROM_COMMITTED_BINARY
```

Proposed deterministic textual payload:

```text
ENGINES_MK0_SYNTHETIC_SUPPORTING_DOCUMENT_V1
NO_REAL_CUSTOMER_DATA
```

Again: the expected digest is frozen only after the exact file bytes are committed and independently hashed in the B7 closure commit.

---

# 11. Golden case closure plan

## GD-003 — one attachment

Must prove:

```text
one ingress staged
one attachment committed
one PostgreSQL Customer attachment ref
binary absent from PostgreSQL Customer
ATTACHMENT_COMMITTED audit exists
terminal success only after attachment + reference + audit
```

## GD-004 — multiple attachments

Must prove:

```text
two independent ingress refs
both commit successfully
both PostgreSQL refs exist
finalization waits for both
retry does not duplicate either logical attachment
```

## GD-009 — transient AttachmentStore failure

Inject one transient `commitAttachment` failure.

Must prove:

```text
Temporal Activity retry observed
same ingressRef resolves same attachmentId
committed attachment delta = 1
Customer finalization did not occur before recovery
mandatory audit complete before success
```

## GD-010 — permanent integrity mismatch

Corrupt or deliberately mismatch the expected SHA-256.

Must prove:

```text
Workflow terminal = FAILED
failureCode = ATTACHMENT_INTEGRITY_MISMATCH
Customer not reported successful
no false ATTACHMENT_COMMITTED success marker
no successful registration completion
```

Whether a pre-created Customer remains in a pending/failed technical state or is avoided entirely must be frozen in the B7 implementation plan before runtime certification; it must never be reported as a successful registration.

---

# 12. B7 implementation boundaries

If authorized, B7 may implement:

```text
AttachmentStore port
filesystem-backed mk0 adapter
stage/resolve/commit/retrieve/expiry/reconciliation semantics
synthetic fixture binaries
Customer attachment reference migration/repository
Temporal attachment Activities
RegisterNewCustomer attachment branch
ATTACHMENT_COMMITTED audit integration
GD-003/004/009/010 certification harness
```

B7 must not expand into:

```text
production cloud storage selection
production PII retention program
virus/malware scanning platform
OCR/document extraction
Agent/Hermes
Scheduler
new business Workflows
arbitrary public upload product
final UI/control room
```

Those may be future gates.

---

# 13. Recommended B7 ticket sequence

```text
B7.0  authority + physical profile closure
B7.1  commit fixture binaries + freeze SHA-256 / lengths
B7.2  AttachmentStore port + filesystem adapter
B7.3  stage/resolve/retrieve + TTL/reconciliation
B7.4  retry-safe commit identity
B7.5  PostgreSQL customer_attachment_refs
B7.6  Temporal Activities + Workflow attachment branch
B7.7  Mongo ATTACHMENT_COMMITTED success gate
B7.8  GD-003 / GD-004 happy certification
B7.9  GD-009 transient failure certification
B7.10 GD-010 integrity-failure certification
B7.11 full 18-case mk0 Golden rerun
B7.12 full mk0 certification receipt
```

No later ticket should be called certified before its identified runtime gate passes.

---

# 14. Recommended project-authority decision

Independent engineering recommendation:

```text
DECISION RECOMMENDED: APPROVE B7
PHYSICAL PROFILE:     filesystem-backed content-addressed mk0 AttachmentStore
PRODUCTION STORAGE:   explicitly NOT selected by this decision
FIXTURES:             F1 PNG + F2 text fixture, committed/frozen in B7.1
FIRST B7 TICKET:      B7.0 / B7.1 closure before executable storage code
```

Rationale:

The attachment-free core is already system-certified. B7 is now a narrow, well-bounded missing capability with four explicit Golden cases. A local provider-neutral storage adapter gives the highest signal-to-complexity ratio for proving the AttachmentStore contract without binding Engines to a production provider.

---

# 15. Authorization record — intentionally blank

B7 is authorized only when project authority records an explicit decision below.

```text
Decision:             APPROVED | REJECTED | CHANGES_REQUIRED
Decision date:
Approved repository SHA:
Approved by:
Record authored by:

Physical AttachmentStore profile:
Laboratory limits accepted:
Fixture plan accepted:
First authorized B7 ticket:

Explicit authorization to implement B7: YES | NO
```

A blank record, a recommendation, or a generic request to continue work is **not** itself the formal B7 authorization recorded by this document.

Until an explicit decision is entered:

```text
B7 = GATED
GD-003 / GD-004 / GD-009 / GD-010 = DEFERRED_B7
FULL MK0 = NOT YET COMPLETE
```
