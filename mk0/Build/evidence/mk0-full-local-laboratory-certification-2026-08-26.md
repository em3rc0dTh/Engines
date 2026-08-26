# mk0 — Full Local Laboratory Certification — 2026-08-26

## Verdict

**PASS — MK0 LOCAL LABORATORY PHYSICAL PROOF COMPLETE**

This receipt records the first operator-run physical proof of the complete mk0 local laboratory after B7 AttachmentStore implementation.

It supplements, but does not replace, the automated Golden/runtime receipts.

## Environment

```text
Host                    Windows + WSL2
Runtime                  Linux WSL
Deployment               Docker Compose
Manual client            Postman
CTA                      HTTP / localhost:8787
Temporal                 real Temporal dev service
Task Queue               engines-mk0-registration
Worker                   B7 Worker
PostgreSQL                canonical Customer/registration truth
MongoDB                   mandatory execution/audit evidence
AttachmentStore          local filesystem, content-addressed
Public tunnel/exposure   none
```

## Operator-run Postman receipt

On 2026-08-26 the operator executed the complete `Engines MK0 B7 — Full Manual Certification v2` collection against the running local WSL/Docker Compose laboratory.

Observed Postman Runner result:

```text
Iterations          1
Duration            2s 668ms
All tests           37
Errors              0
Average response    34 ms
Failed assertions   0
Verdict             37 / 37 PASS
```

The supplied screenshot shows all collection requests green, including the corrected negative unknown-ingress contract.

## Manual surfaces proven

The physical run exercised:

```text
GET  /health

POST /mk0/register-new-customer
GET  /mk0/register-new-customer/:workflowId
POST /mk0/register-new-customer/:workflowId/customer-data

POST /mk0/attachments/stage
GET  /mk0/attachments/:ingressRef
```

Observed successful behaviors include:

- CTA health against the Compose-local Temporal address;
- intent-only Workflow acceptance;
- query of the same Workflow execution;
- multi-round customer-data Updates;
- terminal successful registration;
- complete-customer start;
- exact completed-session replay returning the same Workflow ID and Run ID;
- typed `SESSION_IDEMPOTENCY_CONFLICT` on same session identity with different initial fingerprint;
- staging a deterministic synthetic AttachmentStore fixture;
- resolving staged attachment metadata;
- registration with the staged attachment;
- structural CTA rejection for missing `businessSlug`;
- typed `404 ATTACHMENT_INGRESS_NOT_FOUND` for a syntactically valid but absent `ing_...` reference.

## Earlier direct physical receipts in the same local laboratory

Before the full collection run, the operator also supplied direct responses for a normal Customer and a Customer with one PNG attachment.

### Normal registration

```text
Workflow ID:
register-customer:golden-business:19de63eae1329181ee46a9ca7403a0f7

Run ID:
01a03e8f-2723-7240-b6cc-e49703415160

Final:
workflowStatus = COMPLETED
phase          = CREATED
created        = true
customerId     = cus_8ab4d4bd-bcc3-4539-af20-05664d253fdf
```

### Attachment staging

```text
ingressRef  = ing_manual_fixture_001
state       = STAGED
mediaType   = image/png
byteLength  = 75
sha256      = 248c43a8627c6db8f95626beaca3b056bcfafcd036a4344dd3ed14e1e704da84
```

The digest exactly matches the frozen synthetic Golden PNG fixture.

### Registration with attachment

```text
Workflow ID:
register-customer:golden-business:25258cd12c8d4e5e92d061aa6f99db0b

Run ID:
01a03e95-c847-7797-9679-cb6f71e174a2

Final:
workflowStatus = COMPLETED
phase          = CREATED
created        = true
customerId     = cus_21dc6b9e-9154-4c10-9163-6c6539dc2b1b
```

The supplied Worker/CTA logs showed:

```text
CORE_HTTP_CTA_STARTED
B7_WORKER_STARTED
Worker state: RUNNING
Task Queue: engines-mk0-registration
Temporal address: temporal:7233
AttachmentStore root: /data/attachments
Workflow bundle compiled successfully
```

## Automated evidence joined with the local proof

### Core 14 Golden cases on B7 code

Ephemeral regression source:

```text
609fb09d8d8f5b1229df0e0ebae031a9b5afbb27
```

GitHub Actions run:

```text
32897158566
```

Every actual attachment-free Golden step was successful:

```text
GD-001 PASS
GD-002 PASS
GD-005 PASS
GD-006 PASS
GD-007 PASS
GD-008 PASS
GD-011 PASS
GD-012 PASS
GD-013 PASS
GD-014 PASS
GD-015 PASS
GD-016 PASS
GD-017 PASS
GD-018 PASS
```

That historical workflow concluded red only because its final pre-B7 meta-assertion required `ATTACHMENT_BUILD_GATE_CLOSED`. That assertion is intentionally obsolete after B7 implementation. It is not counted as a product regression.

### B7 attachment Golden cases

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

Cases:

```text
GD-003 PASS  one attachment
GD-004 PASS  multiple attachments
GD-009 PASS  transient AttachmentStore failure + retry
GD-010 PASS  permanent integrity mismatch, no false success
```

Therefore the effective Golden accounting is:

```text
Core cases        14 / 14 PASS
Attachment cases   4 /  4 PASS
--------------------------------
Golden Dataset    18 / 18 PASS
```

## Source-provenance note

The local operator was instructed to test branch:

```text
build/mk0-b7-attachmentstore-local-lab
```

at certified runtime commit:

```text
80a95d0b9715f91879a9e0cbd7230828098ba997
```

The final Postman screenshot itself does **not** display `git rev-parse HEAD`; therefore this receipt does not claim the screenshot independently proves that SHA. The source-pinned automated B7 receipt remains the authority for exact runtime provenance; the 37/37 Postman result is physical local-operation evidence for the prescribed local laboratory.

## Classification

```text
B0-B6                                CERTIFIED
B7 AttachmentStore                   CERTIFIED
Golden Dataset                       18 / 18 PASS
WSL2 Docker Compose local boot       PHYSICALLY PROVEN
Windows/Postman -> WSL CTA           PHYSICALLY PROVEN
Real Temporal orchestration          PHYSICALLY PROVEN
Interactive Updates                  PHYSICALLY PROVEN
Completed-session exact replay       PHYSICALLY PROVEN
Typed session conflict               PHYSICALLY PROVEN
Attachment stage/resolve             PHYSICALLY PROVEN
Customer + attachment happy path     PHYSICALLY PROVEN
Negative HTTP contract               PHYSICALLY PROVEN
Local laboratory                     CERTIFIED
Production deployment                NOT CERTIFIED
External/public exposure             OUT OF SCOPE
Broader Engines workflow library     NOT IMPLEMENTED BY MK0
```

## Final interpretation

The repository may now truthfully state:

> **The full mk0 `RegisterNewCustomer` laboratory, including B7 AttachmentStore, is Golden-complete (18/18) and physically proven in a local WSL2/Docker Compose environment through Postman against a real Temporal execution plane.**

This does **not** mean Engines as a broader platform is complete. `RegisterNewCustomer` remains the first specimen used to prove the reusable orchestration/platform architecture.
