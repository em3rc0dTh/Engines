# CTA Orchestration Register Appointment PoC — test contract

## Local deterministic receipt

Command:

```bash
cd mk1/runtime
npm run check
find src -name '*.test.ts' -print0 | xargs -0 node --import tsx --test
```

Observed on 2026-09-08:

```text
TypeScript: PASS
Tests:      124
Passed:     124
Failed:     0
```

Coverage added by this slice:

- existing adapter output crosses the compatibility layer;
- Web, Telegram, WhatsApp and API converge on `register_appointment`;
- Messenger, Facebook Comment and TikTok converge on the same contract;
- Meta and TikTok signature failures fail closed;
- duplicate canonical ingress starts one Workflow;
- failed orchestration leaves an explicit failed ingress;
- CatalogOffering selection derives the legacy Service parent internally;
- all inherited unit tests remain green.

## Clean-stack certification

The GitHub workflow `.github/workflows/cta-orchestration-poc.yml` runs the unavailable-local portion with Docker:

```text
API CTA
 -> CanonicalCTAEvent
 -> CTAIngressRecord
 -> Temporal RegisterNewAppointment
 -> CatalogOffering
 -> ResourceReservation HELD
 -> Case + Appointment + TimelineEvent
 -> ResourceReservation BOOKED
 -> CTAIngressRecord COMPLETED
```

It then replays the exact start event and asserts one graph. A second workflow is deliberately forced to fail during Case creation; the gate asserts its held capacity becomes `RELEASED`.

## Non-claims

This deterministic receipt does not prove live Meta or TikTok delivery. Physical evidence requires provider credentials, webhook subscription, a received provider event and stored provenance from that exact run.
