# CTA Orchestration Register Appointment PoC — pre-merge certification receipt

Date: 2026-09-08
Repository: `em3rc0dTh/Engines`
Branch: `feature/cta-orchestration-register-appointment-poc`
Draft PR: `#24 — CTA orchestration: canonical Register Appointment PoC`

## Candidate implementation certified

The current runtime candidate was certified on source HEAD:

- Candidate source HEAD: `712a283b12df10174607c7af1c5fce97dcfcb6c8`
- Commit: `fix(cta): reconcile terminal Temporal failure into CTA projection`
- Workflow: `CTA Orchestration Appointment PoC`
- Run: `34250211810`
- Conclusion: `success`
- Artifact: `cta-orchestration-poc-34250211810`
- Artifact id: `10065724939`
- Artifact digest: `sha256:8912bb6bbc5c879762529b72f599543320be9d36e7eff69999b78bc471f7a1fe`

This file supersedes the earlier corrupted receipt and the earlier `801e1b3` evidence snapshot. It deliberately distinguishes deterministic/clean-stack certification from live provider certification.

## Certified clean-stack path

The CI run starts PostgreSQL, MongoDB, Temporal, migrations, workers, channel-core and the CTA runtime from a clean stack, then exercises the same canonical orchestration boundary used by the adapters.

```text
CTA
  -> provider/existing adapter boundary
  -> CanonicalCTAEvent
  -> CTAIngressRecord
  -> Temporal RegisterNewAppointment
  -> generic CatalogOffering compatibility
  -> ResourceReservation HELD
  -> Customer / ManagedEntity / Operational Case
  -> Appointment
  -> Operational TimelineEvent
  -> ResourceReservation BOOKED
  -> CTAIngressRecord COMPLETED
```

The candidate run passed:

```text
TypeScript                                      PASS
CTA compatibility/routing/provider adapters    PASS
Existing adapter regressions                    PASS
Clean Temporal + persistence stack              PASS
CTA -> Temporal -> persistence graph            PASS
Evidence capture                                PASS
```

The deterministic CTA suite covers WebChat, Telegram, WhatsApp, API, Messenger, Facebook Comment and TikTok boundaries, including fail-closed signature/authentication behavior where applicable. Existing WebChat/Telegram/WhatsApp regressions also pass against the candidate.

## Success and replay evidence

The uploaded artifact records `CTA_ORCHESTRATION_POC_PASS` for the successful path.

Persistence evidence proves:

```text
CTAIngressRecord.status       = COMPLETED
CTAIngressRecord.workflowId   = Temporal workflow
CTAIngressRecord.caseId       = persisted Case
CTAIngressRecord.appointmentId= persisted Appointment
duplicate_count               = 1
ResourceReservation.status    = BOOKED
Case relationship             = present
Appointment relationship      = present
```

Therefore replay of the same canonical/provider event reuses the operation rather than creating a second booking graph.

## Failure and compensation evidence

The certification probe deliberately injects an appointment-creation failure after capacity has been held.

The candidate artifact proves both sides of the failure projection:

```text
ResourceReservation.status = RELEASED
release_reason              = APPOINTMENT_CREATION_FAILED
CTAIngressRecord.status     = FAILED
CTAIngressRecord.workflowId = failed Temporal workflow
CTAIngressRecord.errorCode  = persisted terminal failure code
```

This closes the pre-merge gap found in the earlier evidence snapshot, where capacity compensation was correct but the ingress row remained `PROCESSING`.

The implementation now reconciles authoritative Temporal execution closure with the channel read-model. If Temporal has closed while the workflow's last query snapshot still reports `RUNNING`, channel-core projects the operation as terminal `FAILED`, updates the channel binding, and persists the failed CTA ingress projection.

Certified failure semantics:

```text
HELD -> BOOKED      on successful appointment creation
HELD -> RELEASED    on injected appointment-creation failure
PROCESSING -> FAILED on terminal orchestration failure
```

## Existing transport pre-merge regressions

### Telegram

- Workflow: `MK1 C2 Telegram Official Bot API Transport`
- Run: `34250211804`
- Conclusion: `success`
- Artifact: `mk1-c2-telegram-official-34250211804`
- Artifact id: `10065690504`
- Digest: `sha256:70d3c0795b9ec06ae952187506939c6b82251a9b7570b0f34b25274bb700eca9`

The run passes the deterministic Bot API client contract, Telegram adapter regression, clean Engines infrastructure and existing real-Temporal Telegram regression.

This is transport/runtime regression evidence; it is **not** a claim that a new live Telegram provider event was physically received during this candidate run.

### WhatsApp / Kapso

- Workflow: `MK1 C4P Kapso Official WhatsApp Transport`
- Run: `34250211792`
- Attempt: `2`
- Conclusion: `success`
- Latest artifact: `mk1-c4p-kapso-34250211792`
- Artifact id: `10065863291`
- Digest: `sha256:40d7f80a824458475d03c0485205aa62e55f2a0a8c11ce718fb496dc68c69ab0`

Attempt 1 reached all deterministic adapter and real-Temporal regression gates but failed while Docker/BuildKit was booting the Kapso runner with `rpc error: code = Unavailable ... EOF`. The failed job was rerun without code changes. Attempt 2 passed every step, including:

```text
TypeScript
Kapso v2 deterministic contract tests
WhatsApp adapter regression
clean Engines infrastructure
existing real-Temporal WhatsApp regression
Kapso runner boot with deterministic local configuration
evidence capture
```

The successful rerun supports classification of the first failure as an infrastructure/build flake rather than a demonstrated CTA/WhatsApp regression.

This remains deterministic/local transport certification, **not** a claim of a live WhatsApp provider delivery during this run.

## Certified boundaries

Certified for this PoC candidate:

- channel-independent canonical CTA contract;
- compatibility layer that preserves existing adapters;
- deterministic routing to Register Appointment;
- CTA ingress persistence and stable replay identity;
- Temporal orchestration;
- generic CatalogOffering compatibility;
- Customer / ManagedEntity / Case / Appointment operational graph;
- `ResourceReservation HELD -> BOOKED`;
- compensation `HELD -> RELEASED`;
- terminal failed CTA ingress projection;
- WebChat, Telegram and WhatsApp regressions;
- API adapter;
- Messenger adapter contract;
- Facebook Comments adapter contract;
- TikTok adapter contract/capability boundary;
- clean-stack PostgreSQL + MongoDB + Temporal + workers execution.

## Physical provider gates intentionally open

This receipt does **not** certify new live provider delivery. Before a final merge decision, physical provider evidence remains separate and must only be claimed when real credentials/subscriptions/events exist.

Open physical gates:

- WebChat browser/real endpoint smoke against the candidate stack;
- Telegram real provider event + provenance if required for this merge gate;
- WhatsApp real provider event + provenance if required for this merge gate;
- Messenger app + webhook subscription + real signed event;
- Facebook Page comment webhook + real signed event;
- TikTok only to the extent TikTok exposes a real supported comment/message delivery path;
- real-event replay proving no duplicate Case, Appointment or ResourceReservation;
- live negative signature/authentication test where provider infrastructure allows it.

No physical provider certification, production readiness, Services Engine completion or Scheduler Engine completion is claimed here.

## Merge state

PR #24 remains Draft and unmerged. The technical PoC clean-stack gate is green on candidate `712a283b12df10174607c7af1c5fce97dcfcb6c8`; final merge remains blocked on the explicitly selected physical-provider gates and final review.
