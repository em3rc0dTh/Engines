# VertikALL / Engines — Data Model Index

Date indexed in Engines: 2026-09-07

The data-model lineage is versioned independently from Engines runtime generations (`mk0`, `mk1`, ...). Do not assume that Data Model v3 belongs only to MK3 or that Data Model v4 implies MK4.

## Supplied source set

The current repository reorganization was reviewed against two supplied documents:

```text
DATA_MODEL_VTKALL_DEMO_PACK_#_v3_timeslots.md
SHA-256 65da1050440b24b251f2a61cfa9bb7522258c1068b73a41f7f04cc1b3f21ced8

DATA_MODEL_VTKALL_DataModel-0_v4_operational-input-corrective-lifecycle.en.md
SHA-256 b2cca0a4932363fff6c622429abe90a06aa277536c28bcf4bde1ef425ec7fd74
```

The full source files were supplied to the project workspace for this documentation pass. This index preserves their role and hashes. The GitHub connector used for this reorganization does not automatically upload local attachment files; the canonical full documents should be committed separately when the original source files are intentionally promoted into the repository.

## Version relationship

### Data Model v3 — TimeSlots / WorkTeams

v3 evolves the earlier operational model by adding the minimum real scheduling-capacity layer:

```text
WorkTeam
WorkTeamScheduleRule
WorkTeamScheduleOverride
ResourceReservation
```

Core scheduling rules carried by v3:

```text
Appointment schedules the customer.
ResourceReservation blocks real team capacity.
Availability is calculated from team schedule rules + date overrides + blocking reservations.
AvailabilitySlot is legacy compatibility, not future scheduling truth.
The recommended minimum slot granularity is 15 minutes unless configured otherwise.
Only held/booked ResourceReservations block capacity.
```

The v3 root remains `Case`, not `Cita`. The legacy `Cita` model is treated as a transitional source/facade rather than the target domain root.

### Data Model v4 — Operational Input / Corrective Lifecycle

The supplied English v4 file is explicitly a companion translation. It states that the **Spanish v4 document remains canonical**. Engines therefore must not silently treat the English companion as higher authority than the missing Spanish canonical source.

v4 is cumulative:

```text
v3 remains valid
+
v4 adds/refines only what it declares
=
cumulative canonical v4 model
```

v4 adds three first-class persistent models:

```text
OperationalObservationInput
OperationalDirectInput
WorkOrderRequirement
```

It formalizes identifiable embedded objects:

```text
OperationalInsight
OperationalInputElement
AssessmentFinding
AssessmentReportItem
SourceReference
WorkOrderValidationCriterion
```

Major v4 additions/refinements:

```text
observational evidence ownership through Attachment
insight/element-level provenance through sourceRefs
Quote ↔ Quote causal relationships
WorkOrder ↔ WorkOrder causal relationships
supplemental/post-work AssessmentReports
heterogeneous QuoteLine commercial snapshots
QuoteLine != WorkOrderRequirement
service / product / spare_part / material taxonomy
executionStatus / validationStatus / outcomeStatus separation
explicit validation criteria/results
non-linear corrective cycles inside the same Case
future CatalogItemSpecification seam
future InstalledPart / ManagedEntityComponentInstance seam
```

No warehouse, inventory movement, procurement, allocation or stock-consumption operations are introduced by v4.

## Canonical spine after v4

Persistent model direction:

```text
BusinessProfile
Customer
ManagedEntity
Case
CustomerInteraction
Appointment
Assessment
AssessmentReport
CatalogOffering
OperationalObservationInput
OperationalDirectInput
Quote
QuoteLine
DecisionRecord
WorkOrder
WorkOrderTask
WorkOrderRequirement
TimelineEvent
Notification
Attachment
WorkTeam
WorkTeamScheduleRule
WorkTeamScheduleOverride
ResourceReservation
```

Conceptual lifecycle:

```text
Customer / Reality
→ Case
→ operational observation/direct input
→ AssessmentFinding
→ AssessmentReportItem
→ QuoteLine
→ DecisionRecord
→ WorkOrder
→ WorkOrderTask
→ WorkOrderRequirement
→ execution
→ validation
→ accepted outcome OR corrective cycle
```

## Invariants Engines must preserve

```text
Evidence is preserved.
Meaning is reviewed.
Needs are formalized.
Commercial commitments are snapshotted.
Execution dependencies are explicit.
Outcomes are validated.
History is never overwritten to hide learning.
```

Additional critical boundaries:

```text
QuoteLine = commercial commitment
WorkOrderRequirement = execution dependency

execution completed != validation successful
validation successful != inferred commercial responsibility

CatalogOffering = commercial identity
CatalogOffering != inventory master

post-work learning creates new traceable input/report/related quote/work order
post-work learning does not overwrite original history
```

## Relationship to Engines architecture

The data model is domain truth; channel/provider adapters do not own it.

Telegram, WebChat, Kapso, Meta Cloud API and future integrations may normalize inbound information into canonical operations, but they cannot introduce provider-specific versions of `Case`, `Quote`, `ResourceReservation`, `WorkOrderRequirement` or validation policy.

Scheduler implementation must respect the v3 reservation invariant:

> availability shown is not reservation persisted; final persistence revalidates capacity atomically.

Future WorkOrder/operational-input implementation must respect v4 provenance and corrective-cycle invariants.

## Next documentation action

When the canonical Spanish v4 file is available, commit it alongside the source set and mark it explicitly as canonical. Keep the English v4 companion as translation/reference and preserve both hashes in the source ledger.

See [`V3-V4-EVOLUTION.md`](V3-V4-EVOLUTION.md) for the implementation-oriented delta map.
