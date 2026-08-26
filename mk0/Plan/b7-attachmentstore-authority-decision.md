# B7 — AttachmentStore project-authority decision record

## Status

**APPROVED → IMPLEMENTED → CERTIFIED**

This file began as the pre-B7 decision package. It now records the resolved authority decision and the resulting certified laboratory profile.

## Authorization record

```text
Decision:             APPROVED
Decision date:        2026-08-25
Approved baseline:    cert/mk0-core-golden-release
Approved baseline SHA: 5e36064936a4621191412d8676b957bc0998ad5e
Project authority:    repository/project owner
Record authored by:   Engines engineering documentation

Physical AttachmentStore profile:
  local filesystem-backed content-addressed store
  behind provider-neutral AttachmentStorePort

Laboratory environment:
  Windows + WSL2
  Linux runtime
  Docker Compose
  Postman / localhost CTA
  real Temporal
  PostgreSQL
  MongoDB
  no tunnel/public exposure
  no cloud dependency

Laboratory limits accepted:
  max attachments / registration = 4
  max single attachment          = 1 MiB
  max total attachment bytes     = 2 MiB
  staged ingress TTL             = 15 minutes
  integrity hash                 = SHA-256
  Golden media types             = image/png, text/plain

Fixture plan accepted:
  synthetic-id-front-v1.png
  synthetic-supporting-document-v1.txt

First authorized B7 ticket:
  B7.1 fixture commit + SHA-256/length freeze

Explicit authorization to implement B7: YES
```

The authorization was explicitly tied to a **local WSL laboratory**. Public exposure, ngrok/tunnels and cloud object storage were not part of the B7 decision.

---

# Frozen authority model

B7 preserves the mk0 authority split:

```text
binary/document truth → AttachmentStore
business reference     → PostgreSQL
orchestration          → Temporal
interaction audit      → MongoDB
```

A registration with attachments cannot reach successful terminal finalization until every applicable attachment is:

```text
resolved
integrity-verified
committed idempotently
linked from PostgreSQL
represented by mandatory ATTACHMENT_COMMITTED audit evidence
```

Raw attachment bytes are not carried through normal Temporal Workflow History payloads and are not copied into MongoDB audit.

---

# Certified physical implementation

B7 selected the filesystem-backed content-addressed laboratory store.

Logical layout:

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

Identity separation:

```text
ingressRef   = staging identity
attachmentId = stable logical committed attachment identity
sha256       = binary integrity/content identity
```

A retry of the same ingress resolves the same logical attachment. Distinct logical attachments may share one content-addressed blob if their bytes are identical.

This is a laboratory technology decision, **not** a permanent production object-storage choice.

Future S3-compatible/cloud adapters may replace the filesystem adapter behind the same port without redefining Workflow business semantics.

---

# Frozen synthetic fixtures

## F1 — synthetic identity image

```text
file:
mk0/golden-dataset/fixtures/synthetic-id-front-v1.png

mediaType:  image/png
byteLength: 75
sha256:
248c43a8627c6db8f95626beaca3b056bcfafcd036a4344dd3ed14e1e704da84
```

The fixture contains no real identity document or customer PII.

## F2 — synthetic supporting document

```text
file:
mk0/golden-dataset/fixtures/synthetic-supporting-document-v1.txt

mediaType:  text/plain
byteLength: 67
sha256:
c4de8a6ee133dfc935ccb27071170ea692d1261f30cb18cd35269a1d09cf1609
```

Frozen payload:

```text
ENGINES_MK0_SYNTHETIC_SUPPORTING_DOCUMENT_V1
NO_REAL_CUSTOMER_DATA
```

---

# Frozen stage / resolve / commit semantics

## Stage

```text
receive bytes outside Workflow History
→ verify media type and size
→ calculate SHA-256
→ compare expected integrity when supplied
→ atomically publish ingress payload + metadata
→ return opaque ingressRef
```

## Resolve

`resolveIngress(ingressRef)` returns metadata only.

A syntactically valid but absent ingress resolves as missing and the HTTP proof surface returns typed `ATTACHMENT_INGRESS_NOT_FOUND`.

## Commit

```text
resolve ingressRef
→ reject expired/missing ingress
→ re-read staged payload
→ verify SHA-256 + byte length again
→ atomically ensure content-addressed object
→ resolve stable attachmentId
→ write committed logical metadata
→ persist PostgreSQL Customer attachment reference
→ persist ATTACHMENT_COMMITTED audit
→ only then permit registration finalization
```

Corruption after stage becomes:

```text
ATTACHMENT_INTEGRITY_MISMATCH
```

and cannot become false terminal success.

---

# PostgreSQL contract

B7 adds canonical immutable Customer attachment linkage.

Conceptual authority:

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

PostgreSQL stores business linkage and integrity reference metadata, not binary payload bytes.

Retry of the same logical link is idempotent; materially different metadata for the same logical identity is rejected.

---

# MongoDB audit contract

For each successfully committed registration attachment, applicable mandatory audit includes:

```text
ATTACHMENT_COMMITTED
```

Audit metadata may include safe logical/integrity metadata but not raw bytes/base64 payloads.

---

# Certified Golden closure

B7 closed the exact four cases that were previously deferred:

```text
GD-003 one attachment                    PASS
GD-004 multiple attachments              PASS
GD-009 transient AttachmentStore failure PASS
GD-010 permanent integrity mismatch      PASS
```

Certified B7 runtime source:

```text
80a95d0b9715f91879a9e0cbd7230828098ba997
```

GitHub Actions run:

```text
32896780937
```

Conclusion:

```text
success
```

GD-009 proved Temporal retry after an injected transient commit failure while preserving one logical attachment.

GD-010 proved post-stage corruption fails typed with no PostgreSQL attachment link, no `ATTACHMENT_COMMITTED`, no `REGISTRATION_COMPLETED` and no false successful registration.

Combined with the 14 core Golden cases:

```text
Golden Dataset = 18 / 18 PASS
```

---

# Physical local confirmation

On 2026-08-26 the operator executed the full Postman manual-certification collection against the WSL2/Docker Compose laboratory.

```text
37 tests
0 errors
0 failed assertions
37 / 37 PASS
```

This included physical local AttachmentStore stage/resolve and Customer+attachment registration through Postman → CTA → Temporal → Worker → persistence authorities.

Receipt:

```text
mk0/Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md
```

---

# Decision boundary that remains

This B7 approval **does not** authorize or certify:

```text
production cloud storage selection
public upload service
internet/tunnel exposure
production retention/encryption program
virus/malware scanning platform
OCR/document extraction
Agent/Hermes
Scheduler
new business Workflows
final Engines UI/control room
production deployment
```

Those remain future explicit gates.

> **B7 authority decision is closed. B7 = CERTIFIED. Full mk0 local laboratory = SYSTEM_CERTIFIED.**
