# CTA Orchestration Register Appointment PoC — CI certification receipt

Date: 2026-09-08
Repository: `em3rc0dTh/Engines`
Branch: `feature/cta-orchestration-register-appointment-poc`
Draft PR: `#24 — CTA orchestration: canonical Register Appointment PoC`

## Certified source execution

The runtime implementation was certified by GitHub Actions on:

- Source HEAD: `801e1b3a44cecaf0b2f78b087433e530aee1a2fd`
- Workflow: `CTA Orchestration Appointment PoC`
- Run: `34245422914`
- Conclusion: `success`
- Artifact: `cta-orchestration-poc-34245422914`
- Artifact id: `10063832492`
- Artifact digest: `sha256:8fb2417ab2457e2b900f97fc11eb640b4eed1a27083992db19d97b4ac32afad3`

This receipt repairs the previously corrupted evidence file. It does not expand the product claim beyond the evidence listed below.

## Deterministic test contract

The slice test contract records:

```text
TypeScript: PASS
Tests:      124
Passed:     124
Failed:     0
```

Coverage includes:

- compatibility boundary for existing adapters;
- WebChat, Telegram, WhatsApp and API convergence on `register_appointment`;
- Messenger, Facebook Comment and TikTok adapter boundaries;
- fail-closed Meta/TikTok signature rejection tests;
- canonical ingress deduplication/replay;
- generic CatalogOffering compatibility;
- inherited regression coverage.

## Clean-stack runtime certification

The CI workflow starts a clean stack with PostgreSQL, MongoDB, Temporal, migrations, workers, CTA runtime and channel-core, then executes the appointment PoC through the same orchestration boundary.

Certified successful path:

```text
API CTA
  -> CanonicalCTAEvent
  -> CTAIngressRecord
  -> Temporal RegisterNewAppointment
  -> CatalogOffering
  -> ResourceReservation HELD
  -> Operational Case
  -> Appointment
  -> TimelineEvent
  -> ResourceReservation BOOKED
  -> CTAIngressRecord COMPLETED
```

Observed success receipt from the uploaded artifact:

```text
CTA_ORCHESTRATION_POC_PASS
workflowId=register-appointment:golden-business:daf38054448c5dc739d97aeec85832b8
caseId=case_949da6b7-9854-4528-a3bf-b3c246e8c930
appointmentId=apt_2b33755a-9905-46ca-854d-71645a025caa
resourceReservationId=rr_cec42d50-af54-4219-8e5a-593de165699a
```

Persistence evidence for the completed event records:

```text
CTA ingress status: COMPLETED
duplicate_count: 1
ResourceReservation status: BOOKED
Case linked: yes
Appointment linked: yes
```

This proves replay of the same start event did not create a second booking graph.

## Compensation evidence

The CI probe deliberately injects an appointment-creation failure after capacity is held.

The artifact records:

```text
ResourceReservation status: RELEASED
release_reason: APPOINTMENT_CREATION_FAILED
```

Therefore the certified compensation claim is:

```text
HELD -> RELEASED on injected orchestration failure
```

### Pre-merge observation

The captured ingress row corresponding to the injected failure is `PROCESSING` in the uploaded artifact rather than a terminal `FAILED` projection. Reservation compensation is certified; terminal failed-ingress projection is **not** certified by this artifact and must remain a pre-merge verification item. No stronger claim is made here.

## Certified boundaries

Certified at PoC / deterministic level:

- canonical CTA contract and deterministic routing;
- compatibility layer preserving existing channel adapters;
- CTA ingress persistence and replay identity;
- Temporal orchestration into the Register Appointment workflow;
- generic CatalogOffering compatibility;
- operational persistence graph;
- `ResourceReservation HELD -> BOOKED`;
- compensation `HELD -> RELEASED`;
- WebChat, Telegram and WhatsApp adapter regressions;
- API, Messenger, Facebook Comment and TikTok adapter contract boundaries;
- clean-stack PostgreSQL + MongoDB + Temporal + workers execution.

## Physical gates intentionally open

This receipt does **not** certify live provider delivery.

Still required before final merge decision:

- WebChat physical end-to-end smoke against the candidate stack;
- Telegram real provider event and stored provenance;
- WhatsApp real provider event and stored provenance;
- Messenger app + webhook subscription + real signed event;
- Facebook Page comment webhook + real signed event;
- TikTok only to the extent the provider exposes a real supported comment/message delivery path;
- replay of each real provider event proving no duplicate Case, Appointment or ResourceReservation;
- negative signature/authentication test for providers that sign webhooks;
- verification of terminal ingress state on an injected orchestration failure.

No physical provider certification, production readiness, Services Engine completion or Scheduler Engine completion is claimed by this receipt.

## Merge state

PR #24 remains Draft and unmerged. Merge is blocked until the pre-merge physical/provider gates selected for this slice and final review are complete.
