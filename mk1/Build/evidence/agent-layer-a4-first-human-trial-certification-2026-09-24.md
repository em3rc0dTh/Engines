# Agent Layer A4 — First Human Agent Trial Certification

Date: 2026-09-24

## Verdict

~~~text
FIRST_HUMAN_AGENT_TRIAL_PASS
~~~

The first human-facing Appointment Agent journey completed end-to-end through the real local Agent stack and durable Engine path.

This receipt records human runtime evidence. It does not replace the A0/A1/A2/A3 certification receipts; it consumes those certified boundaries and adds the first completed human journey on top.

## Source lineage

The A4 trial reached its final successful form after these merged corrections:

- PR #49 — Dockerize local Qwen inference
  - merge: `bba1db72fca32ea97da96cc62a633c9b98c483e0`
- PR #50 — normalize natural date phrases before Engine execution
  - merge: `b6c729c5129bf8c2752b8c684910ebc61da2b524`
- PR #51 — harden natural offering and date boundary
  - merge: `0cab5c1f09a269bd178cd8eaa0bd38e207578600`

The final human browser evidence was collected after the PR #51 corrective flow was deployed locally and exhibits the PR #51 behavior.

Truth boundary: the browser/Workflow Inspector capture does not independently print the local Git SHA. Therefore this receipt records the merged source lineage above and does not claim that the screenshot itself cryptographically proves an exact checkout SHA.

## Local model boundary

The local Agent stack remained:

~~~text
Qwen2.5 1.5B Instruct Q4_K_M
sha256:
6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e

llama.cpp:
b29c606e28a01b1bc8c1351026a0fa6e616bf6c4

transport:
Docker Compose agent-llama service
~~~

PR #49 certifies the Docker-native local inference path. PR #51 reran the protected Agent gates, including real A1 local inference and the real A2 integrated journey, before merge.

## Human conversation evidence

Final successful durable workflow:

~~~text
workflowId:
register-appointment:golden-business:04a232b4721fc6d775b0f763e30a303c

runId:
01a0d3f7-da60-71d9-9e17-4032efd4175d

workflowStatus:
COMPLETED

phase:
CREATED

nextAction:
NONE
~~~

The human journey was:

~~~text
Customer:
ME1 Unique Customer

ManagedEntity:
Renault Logan 2018

Service:
Car Wash

Offering:
Executive Clean

Appointment date:
2026-09-25

Selected slot:
07:00–07:30
~~~

Final durable identities:

~~~text
Appointment:
apt_c802e7adef088ec07c8a1449f2dd1ead

Case:
case_c802e7adef088ec07c8a1449f2dd1ead

SchedulerReservation:
schedres_ec771ad2329977b562014865654a273e
~~~

## Human → Agent route evidence

The user deliberately typed natural language instead of relying on direct canonical-operation buttons.

### ManagedEntity

Human:

~~~text
Quiero usar mi Renault Logan, por favor.
~~~

Visible runtime audit:

~~~text
Agent MODEL · model=yes · context=0
~~~

Confirmed Engine state:

~~~text
Renault Logan 2018
~~~

### Service

Human:

~~~text
Quiero que le hagan un lavado al Logan, por favor.
~~~

Visible runtime audit:

~~~text
Agent MODEL · model=yes · context=2
~~~

Confirmed Engine state:

~~~text
Car Wash
~~~

These two turns are the physical evidence that the human journey invoked the real Agent model path.

### Offering

Human:

~~~text
Me quedo con la opción intermedia, la ejecutiva.
~~~

Visible runtime audit:

~~~text
Agent DETERMINISTIC_BYPASS · model=no · context=4
~~~

Confirmed durable state:

~~~text
Executive Clean
productId = prd_car_wash_executive
~~~

This validates the PR #51 corrective boundary: an unambiguous ordinal reference to an already-loaded ordered candidate list is resolved deterministically rather than delegated to a probabilistic model.

### Date

Human:

~~~text
Quiero hacerlo mañana por la tarde.
~~~

Visible runtime audit:

~~~text
Agent DETERMINISTIC_BYPASS · model=no · context=6
~~~

Confirmed durable date:

~~~text
2026-09-25
~~~

This validates the natural-date corrective boundary: one unambiguous date is normalized before strict Engine execution.

### Slot

Human:

~~~text
A las 07:00.
~~~

Visible runtime audit:

~~~text
Agent DETERMINISTIC_BYPASS · model=no · context=8
~~~

Confirmed durable slot:

~~~text
07:00–07:30
~~~

### Final confirmation

Human:

~~~text
Sí, confirma.
~~~

Visible final narration:

~~~text
Listo, la cita quedó confirmada para 2026-09-25 a las 07:00.
~~~

Terminal Engine state:

~~~text
COMPLETED / CREATED / next=NONE
~~~

## Defects discovered during the human trial

The human trial was intentionally not declared PASS at the first successful-looking UI transition.

It exposed two real defects before the final clean journey:

1. An ordinal natural-language offering request could advance the workflow while durable truth contained the wrong offering.
2. A phrase such as `mañana por la tarde` could still fail at the Agent/Engine date boundary.

Those defects were corrected in PR #50/#51 and the final clean journey then proved:

~~~text
selectedProduct.name = Executive Clean
appointmentDate = 2026-09-25
selectedSlot.start = 07:00
workflowStatus = COMPLETED
phase = CREATED
Appointment exists
SchedulerReservation exists
~~~

The failed/intermediate workflows remain historical debugging evidence and are not reclassified as PASS.

## PASS criteria closure

The A4 manual-trial criteria close as follows:

| Criterion | Evidence |
| --- | --- |
| Human typed a non-deterministic natural-language Agent turn | ManagedEntity and Service turns used `MODEL` |
| Agent reply visible in WebChat | Visible after every human turn |
| Runtime audit route visible | `MODEL` and `DETERMINISTIC_BYPASS` audit lines captured |
| Invalid model output cannot bypass A0 validation | inherited protected A0/A1/A2/A3 gates rerun on PR #51 |
| Canonical Engine action only after valid AgentDecision | final state transitions occurred through Agent Runtime → canonical action path |
| Temporal workflow reached COMPLETED | final workflow status `COMPLETED` |
| Appointment durably created | `apt_c802e7adef088ec07c8a1449f2dd1ead` |
| Scheduler reservation durably created | `schedres_ec771ad2329977b562014865654a273e` |
| Final Agent narration described confirmed state | final reply named date and slot |

## Protected corrective verification

PR #51 final head:

~~~text
0b4a65c932472a9a698bb848472a7371a6c3d49a
~~~

Relevant successful runs on that head:

~~~text
MK1 Agent Layer A0 Contract:
36016086017

MK1 Agent Layer A1 Local Inference:
36016086163

MK1 Agent Layer A2 Integrated Journey:
36016086145

MK1 Agent Layer A3 Runtime:
36016086121

MK1 Agent Layer A4 Manual Trial Wiring:
36016086232
~~~

The A1 real-local-inference and A2 real-integrated-journey jobs both completed successfully before PR #51 was merged.

## Final boundary

This receipt certifies:

~~~text
human
→ WebChat
→ durable Agent Runtime
→ real local Qwen for non-deterministic turns
→ validated/canonical Agent action boundary
→ Temporal
→ Services / Scheduler
→ durable Appointment + SchedulerReservation
→ COMPLETED / CREATED
~~~

It does not claim that all possible natural-language phrasings are correct, that the 1.5B model is universally reliable, or that future Agent capabilities outside this Appointment journey are certified.

## Seal marker

~~~text
FIRST_HUMAN_AGENT_TRIAL_PASS
AGENT_A4_HUMAN_TRIAL_SEALED
~~~
