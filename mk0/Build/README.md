# Build — mk0

## Current status

**FULL MK0 LABORATORY = GOLDEN COMPLETE + LOCALLY PHYSICALLY PROVEN**

```text
B0  runtime/repository skeleton                            ✅ CERTIFIED
B1  canonical contracts + versioned RegistrationPolicy    ✅ CERTIFIED
B2  real Temporal runtime/topology + continuity            ✅ CERTIFIED
B3  CLI CTA Adapter                                        ✅ CERTIFIED
B4  Worker + Task Queue + interactive RegisterNewCustomer ✅ CERTIFIED
B5  PostgreSQL business authority                          ✅ CERTIFIED
B6  MongoDB mandatory audit + finalization                 ✅ CERTIFIED
B7  filesystem-backed content-addressed AttachmentStore    ✅ CERTIFIED

Golden Dataset                                              ✅ 18 / 18 PASS
WSL2 + Docker Compose local laboratory                     ✅ PHYSICALLY PROVEN
Postman full manual collection                             ✅ 37 / 37 PASS
Production deployment                                      ❌ NOT CERTIFIED
Broader Engines workflow library                           ⏳ OUTSIDE MK0
```

`RegisterNewCustomer` remains the first specimen used to prove the Engines orchestration/platform pattern. It is not the whole product scope of Engines.

## Certified laboratory shape

```text
Windows / Postman
        ↓ localhost:8787
HTTP CTA Adapter
        ↓
Temporal Client
        ↓
┌──────────────────────────────────────┐
│ REAL TEMPORAL EXECUTION PLANE        │
│                                      │
│ RegisterNewCustomer Workflow         │
│ Task Queue: engines-mk0-registration │
│ Worker / Activities                  │
│ Query: GetRegistrationState          │
│ Update: ProvideCustomerData          │
│ retries / replay / recovery          │
│ durable Event History                │
└──────────────────┬───────────────────┘
                   ↓
      ┌────────────┼──────────────┐
      ↓            ↓              ↓
 PostgreSQL     MongoDB      AttachmentStore
 business       mandatory    filesystem
 truth          audit        content-addressed
```

The local laboratory runs through Docker Compose inside WSL2. Public tunnels/exposure are not part of this certification.

## Golden accounting

```text
GD-001 PASS
GD-002 PASS
GD-003 PASS
GD-004 PASS
GD-005 PASS
GD-006 PASS
GD-007 PASS
GD-008 PASS
GD-009 PASS
GD-010 PASS
GD-011 PASS
GD-012 PASS
GD-013 PASS
GD-014 PASS
GD-015 PASS
GD-016 PASS
GD-017 PASS
GD-018 PASS

18 / 18 PASS
```

### Core 14 proof on B7 code

Ephemeral B7 regression source:

```text
609fb09d8d8f5b1229df0e0ebae031a9b5afbb27
```

GitHub Actions run:

```text
32897158566
```

All actual core Golden case steps passed. The historical workflow concluded red only at its obsolete final pre-B7 assertion requiring attachments to remain gated. That failed assertion is intentionally invalid after B7 and is not a product regression.

### B7 attachment proof

Certified B7 source:

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

The B7 runtime gate proved:

```text
GD-003 one attachment                    PASS
GD-004 multiple attachments              PASS
GD-009 transient AttachmentStore failure PASS
GD-010 integrity mismatch                PASS
```

GD-009 injected a one-shot AttachmentStore commit failure and proved retry-safe logical attachment identity.

GD-010 corrupted staged bytes after ingress and proved `ATTACHMENT_INTEGRITY_MISMATCH` with no attachment reference, no `ATTACHMENT_COMMITTED`, no `REGISTRATION_COMPLETED`, and no false successful registration.

## Physical local proof

On 2026-08-26 the operator ran the complete Postman manual-certification collection against the WSL2/Docker Compose laboratory.

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

This physically exercised health, intent-only Workflow start, multi-round Updates, terminal creation, exact completed-session replay, typed replay conflict, AttachmentStore stage/resolve, attachment-bearing registration, CTA structural rejection, and typed unknown-ingress 404 behavior.

Durable receipt:

```text
mk0/Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md
```

## Evidence index

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
B2 → mk0/Build/evidence/B2-temporal-continuity-certification-2026-08-24.md
B3 → mk0/Build/evidence/B3-cli-cta-certification-2026-08-24.md
B4 → mk0/Build/evidence/B4-interactive-registration-certification-2026-08-24.md
B5 → mk0/Build/evidence/B5-postgres-authority-certification-2026-08-25.md
B6 → mk0/Build/evidence/B6-mongo-audit-finalization-certification-2026-08-25.md
Core integrated Golden → mk0/Build/evidence/mk0-core-golden-release-certification-2026-08-25.md
Full local laboratory → mk0/Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md
```

## Frozen B7 physical profile

```text
Host                  Windows + WSL2
Runtime               Linux WSL
Deployment            Docker Compose
CTA access            localhost HTTP
Manual client         Postman
Temporal              local Compose service
Worker                local Compose service
PostgreSQL            local Compose service
MongoDB               local Compose service
AttachmentStore       shared WSL/Compose filesystem volume
Binary organization   content-addressed by SHA-256
Logical identity      stable attachmentId derived from ingress identity
External tunnel       none
Cloud dependency      none
```

The mk0 laboratory limits remain:

```text
max attachments / registration = 4
max single attachment          = 1 MiB
max total attachment bytes     = 2 MiB
staged ingress TTL             = 15 minutes
integrity hash                 = SHA-256
Golden media types             = image/png, text/plain
```

## Core invariants

- external channels remain replaceable adapters;
- CTA validates transport/session structure but is not final Customer-completeness authority;
- CTA never writes canonical persistence directly;
- Temporal owns durable orchestration, retries, replay and recovery;
- Workflow code performs no direct DB/file/network side effects;
- PostgreSQL remains canonical Customer + registration truth;
- MongoDB remains mandatory application audit/context, not shadow Customer truth;
- AttachmentStore owns binary content and integrity;
- PostgreSQL stores immutable attachment references, not attachment bytes;
- attachment bytes are not carried through Workflow history;
- successful attachment-bearing registration requires committed binary integrity + PostgreSQL linkage + `ATTACHMENT_COMMITTED` audit before terminal success;
- accepted Workflow progress survives CTA death;
- Worker loss after a real business side effect cannot duplicate the Customer;
- exact completed-session replay returns the existing Workflow/Run;
- conflicting replay produces typed `SESSION_IDEMPOTENCY_CONFLICT` without a second business effect;
- hard and soft duplicate semantics remain distinct;
- `RegisterNewCustomer` creates zero scheduling side effects.

## Current interpretation

The repository may truthfully state:

> **The full mk0 `RegisterNewCustomer` laboratory, including B7 AttachmentStore, is Golden-complete (18/18) and physically proven in local WSL2/Docker Compose through Postman against a real Temporal execution plane.**

It must still not state:

```text
production deployment certified     NO
public/external exposure certified  NO
all Engines workflows implemented   NO
Engines platform complete           NO
```

## Next transition

mk0 is no longer waiting on B7.

The next architecture transition is to stop deepening the first specimen and use the certified Engines spine for the next deliberately selected Workflow/specimen.

```text
MK0 RegisterNewCustomer
        ✅ CERTIFIED LABORATORY
                ↓
SELECT NEXT ENGINES SPECIMEN
                ↓
reuse CTA → Temporal → Activities → authority boundaries
                ↓
new Golden Dataset / quarry / certification
```
