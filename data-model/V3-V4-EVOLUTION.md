# Data Model v3 → v4 — Implementation Delta Map

## Purpose

Translate the supplied v3/v4 model documents into a repository-facing implementation map without replacing either source.

## v3 baseline that remains valid

v3 establishes the operational Case spine and the first real scheduling-capacity layer.

### Core/domain

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
Quote
QuoteLine
DecisionRecord
WorkOrder
WorkOrderTask
TimelineEvent
Notification
Attachment
```

### Scheduling capacity

```text
WorkTeam
WorkTeamScheduleRule
WorkTeamScheduleOverride
ResourceReservation
```

The central scheduling separation is:

```text
Appointment            customer-facing scheduled interaction
ResourceReservation    authoritative capacity block
```

Availability calculation uses:

```text
WorkTeam
+ recurring WorkTeamScheduleRule
+ date-specific WorkTeamScheduleOverride
- blocking ResourceReservation
= available capacity
```

`AvailabilitySlot` remains a legacy/demo compatibility seam only.

## v4 additions

### New persistent models

```text
OperationalObservationInput
OperationalDirectInput
WorkOrderRequirement
```

### New/identified embedded schemas

```text
OperationalInsight
OperationalInputElement
AssessmentFinding
AssessmentReportItem
SourceReference
EntityRelationshipReference
WorkOrderValidation / criterion
```

## Operational Input Layer

### OperationalObservationInput

Evidence-backed capture event:

```text
must own 1..N Attachments
may process machine extraction/interpretation
may require review
must produce 1..N usable OperationalInsights before confirmed
retains Case + ManagedEntity + context + author/reviewer provenance
```

Observational Attachment ownership is exclusive. Evidence is referenced by ID and is not reassigned between observation inputs.

### OperationalDirectInput

Direct structured/manual information from forms, commands, checklists, selections, measurements, written text or confirmations.

It does **not** require an Attachment and must not create artificial files merely to fit the observation schema.

### sourceRefs

Derived domain objects preserve granular causality:

```text
operational_insight
operational_input_element
assessment_finding
assessment_report_item
quote_line
work_order_task
```

Relationships include:

```text
created_from
supported_by
formalizes
commercializes
executes
requires
validates
supplements
corrects
```

Primary relationships (`caseId`, `quoteId`, `workOrderId`, etc.) remain authoritative; `sourceRefs` add provenance rather than replace those keys.

## Assessment / report refinement

v4 distinguishes:

```text
AssessmentFinding       formalized finding inside Assessment
AssessmentReportItem    formal conclusion or operational need in the report
```

One ReportItem may produce zero, one or multiple QuoteLines; multiplicity must be explicit.

Post-work learning does not mutate the original report. It may produce:

```text
post_work_validation report
supplemental_assessment report
relationshipRefs to earlier report
```

## Commercial refinement

### CatalogOffering

v4 refines CatalogOffering into commercial identity/policy rather than inventory identity.

Supported taxonomy:

```text
service
product
spare_part
material
labor
bundle
fee
custom
```

Current detailed focus:

```text
service
product
spare_part
material
```

Forbidden scope in CatalogOffering:

```text
stock quantities
warehouse movements
valuation
picking/receiving
procurement execution
```

### Quote and QuoteLine

Before approval/execution, a Quote version may change commercial content.

After approval and WorkOrder creation, a new commercial need creates a **new related Quote**, not merely another version of the executed Quote.

QuoteLine is a historical commercial snapshot containing accepted description, quantity/unit, price/currency, terms and relevant item attributes.

New records use `spare_part` rather than the older `part` label.

## Execution refinement

### WorkOrder

Target semantics separate three dimensions:

```text
executionStatus
validationStatus
outcomeStatus
```

Example:

```text
executionStatus = execution_completed
validationStatus = validation_failed
outcomeStatus = corrective_action_required
```

A completed execution therefore does not imply an accepted result.

### Validation

When `validation.required=true`, explicit criteria and results must exist. Failed validation may generate a new OperationalObservationInput for post-work learning.

### WorkOrderRequirement

A first-class execution dependency:

```text
WorkOrderTask
→ WorkOrderRequirement
→ source QuoteLine / CatalogOffering
```

Current requirement types:

```text
spare_part
material
product
service_dependency
other
```

Current statuses:

```text
required
confirmed_available
substitution_required
cancelled
fulfilled
```

`confirmed_available` is an operational confirmation, not a warehouse reservation.

## Corrective lifecycle

The same Case may contain a non-linear sequence:

```text
Initial observations/direct input
→ Assessment
→ AssessmentReport
→ Quote 1
→ Decision
→ WorkOrder 1
→ execution completed
→ post-work validation failed
→ new OperationalObservationInput
→ supplemental/post-work AssessmentReport
→ related Quote 2
→ Decision
→ related corrective WorkOrder 2
→ final validation
```

Relationships preserve history:

```text
AssessmentReport 2 supplements AssessmentReport 1
Quote 2 remedial_follow_up Quote 1
WorkOrder 2 corrective_rework WorkOrder 1
WorkOrder 1 remains execution_completed + validation_failed
```

## Current implementation sequence recommended by v4

The source proposes:

```text
1. SourceReferenceSchema
2. OperationalInsightSchema
3. OperationalInputElementSchema
4. OperationalObservationInput
5. OperationalDirectInput
6. Attachment ownership augmentation
7. TimelineEvent new event vocabulary
8. AssessmentFindingSchema
9. AssessmentReportItemSchema
10. Assessment / AssessmentReport augmentation
11. Quote / QuoteLine relationship + snapshot augmentation
12. WorkOrder validation + relationship augmentation
13. WorkOrderRequirement
14. WorkOrderTask requirement/source augmentation
15. CatalogOffering typed seams
16. Case corrective-cycle snapshots
```

A first bounded BUILD may intentionally stop after step 7:

```text
capture → evidence → observation input → review → confirm → timeline
```

That is a useful seam for a future Engines gate because it does not require prematurely implementing commercial correction or logistics.

## Engines gate mapping

Potential future gates should keep these domains separate:

```text
Operational Input gate
  capture / direct input / provenance / Attachment ownership / Timeline

Assessment gate
  findings / report items / report relationships

Commercial gate
  CatalogOffering taxonomy / Quote relationships / QuoteLine snapshots

Execution gate
  WorkOrder statuses / validation / WorkOrderRequirement

Corrective lifecycle gate
  post-work learning / related Quotes / related WorkOrders

Scheduler gate
  WorkTeam schedules / overrides / ResourceReservation / atomic capacity
```

Provider integrations must not own any of these business rules.

## Deferred seams

Not implemented by v4:

```text
CatalogItemSpecification persistent model
InventoryItem / StockItem
Warehouse
StockMovement
Procurement
InstalledPart / ManagedEntityComponentInstance
```

Future implementation must not smuggle these concepts into current models as provider-specific or free-form fields.
