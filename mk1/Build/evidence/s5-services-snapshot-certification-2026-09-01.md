# S5 — Durable Services Snapshot Certification Receipt

## Verdict

**✅ CERTIFIED — BOUNDED G1 / S5 CLAIM**

S5 certifies that a running Temporal Workflow can capture and continue with a durable Service/Offering semantic snapshot while the mutable Services catalog advances to a newer revision, including across Worker process restart.

This receipt does **not** certify the whole Services Engine, Scheduler, multi-channel CTA, Agent, MCP, production deployment or production provider integrations.

## Executed source

```text
Branch        build/mk1-s5-services-snapshots
Source SHA    7568618062f4192b34caf6e916b58534f304ad3f
Run           33539683548
Job           99962550022
Result        SUCCESS
Artifact      9813129778
Artifact SHA  22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708
```

The GitHub Actions job completed every certification step successfully, including clean laboratory startup, S1–S4 regression, frozen MK0 regression, S4 management regression, snapshot preparation, real Worker restart, post-restart completion, inherited Appointment regression, evidence capture and cleanup.

## Certified experiment

S5 freezes the following invariant:

```text
running Workflow snapshot != mutable catalog head
```

The executed experiment performs this sequence:

```text
1. Publish Service + Offering revision 1.
2. Start a Temporal snapshot Workflow.
3. Read Service/Offering through the Services read boundary.
4. Capture the complete semantic snapshot in Workflow state/history.
5. Leave the Workflow waiting.
6. Publish Service + Offering revision 2 through the certified S4 management boundary.
7. Confirm the waiting Workflow still exposes revision-1 semantics.
8. Restart the Worker process while that Workflow remains open.
9. Confirm a new Worker process takes over.
10. Resume and complete the original Workflow.
11. Start a new snapshot Workflow.
12. Confirm the new Workflow observes revision 2.
```

## Direct runtime markers

Before restart:

```text
SERVICES_S5_PRE_RESTART_PASS {
  "workflowId":"mk1-s5:snapshot:original",
  "originalServiceRevision":1,
  "originalOfferingRevision":1,
  "publishedServiceRevision":2,
  "publishedOfferingRevision":2,
  "mutableHeadDidNotChangeWaitingSnapshot":true
}
```

The Worker-ready identity changed from process `31` to process `36`, proving a real Worker restart occurred while the Workflow was waiting.

After restart:

```text
SERVICES_S5_SNAPSHOT_PASS {
  "originalSurvivedWorkerRestart":true,
  "originalServiceRevision":1,
  "originalOfferingRevision":1,
  "newServiceRevision":2,
  "newOfferingRevision":2,
  "originalCompletedWithFrozenSemantics":true,
  "newWorkflowObservedCatalogHead":true
}
```

## Snapshot surface

The S5 snapshot includes the semantic values a long-running consumer must not silently reinterpret after catalog mutation:

```text
business scope
service identity + revision
offering identity + revision
code
name
duration
pricing
requirements
eligibility semantics used by the snapshot consumer
```

The mutable PostgreSQL catalog remains authoritative for the latest published Service/Offering head. Temporal Event History/Workflow state is authoritative for the already-captured revision used by that running Workflow.

## S4 regression carried forward

The same successful run re-certified S4 before the snapshot experiment:

```text
SERVICES_S4_MANAGEMENT_PASS
  workflows=11
  exactReplay=true
  materialConflict=true
  businessScopedIdempotency=true
  serviceRevision=3
  offeringRevision=3
  staleServiceRejected=true
  staleOfferingRejected=true
  auditCompleteBeforeResults=true

SERVICES_S4_REJECTION_SAFETY_PASS
  missingDependencyRejected=true
  partialOfferingCreated=false
  mutationCommandPersisted=false
  auditPersisted=true
```

Therefore S5 did not obtain its result by weakening the certified S4 mutation semantics.

## Frozen MK0 / Appointment regression

The run also passed the inherited contract tests for Customer registration, CLI CTA behavior, AttachmentStore and Appointment date normalization.

The complete Appointment physical probe also passed:

```text
APPOINTMENT_NEW_CUSTOMER_CHILD_PASS
APPOINTMENT_CATALOG_PASS
APPOINTMENT_PAST_DATE_REJECTED
APPOINTMENT_DATE_AND_SLOTS_PASS
APPOINTMENT_BOOKING_PASS
APPOINTMENT_IDEMPOTENCY_REPLAY_PASS
APPOINTMENT_SLOT_CONFLICT_PASS
MK0_REGISTER_NEW_APPOINTMENT_PASS
```

This proves the S5 snapshot work did not break the inherited certified Appointment specimen.

## Evidence artifact

Artifact `9813129778` contains nine captured evidence files, including:

```text
git-sha.txt
worker-before.txt
worker-after.txt
compose-ps.txt
worker.log
cta.log
postgres-service-head.txt
postgres-offering-head.txt
mongo-s5-management-audit.txt
```

Artifact digest:

```text
sha256:22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708
```

## Certified claim

S5 allows the following statement:

> Engines can give a long-running Temporal consumer a durable, replay-safe Service/Offering semantic snapshot that remains revision-stable while Services management publishes a newer catalog head, and the consumer can survive Worker restart without silently switching revisions.

## Explicit non-claims

S5 does not prove:

```text
full G1 Services Engine closure
multi-business generality across materially different businesses
final Appointment migration to the generic Services boundary
Scheduler resource/capacity authority
WebChat support
Telegram support
WhatsApp support
Agent behavior
MCP integration
production deployment
```

Those remain separate gates.
