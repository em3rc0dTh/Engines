# B2 Temporal Topology + Continuity Certification — 2026-08-24

## Verdict

**B2 = CERTIFIED**

This record certifies the mk0 B2 claim that accepted Workflow execution truth belongs to Temporal rather than to one Node.js Worker process.

The certification used the real Temporal Service and SDK runtime inherited from B0 and the executable contract baseline certified in B1.

## Certified source

```text
repository:  em3rc0dTh/Engines
branch:      build/mk0-b2-temporal-topology
commit:      d089e1ecc4e5334de7808537c842e9b36adb919a
CI run:      32807348661
artifact:    mk0-b2-temporal-continuity-32807348661
artifact id: 9548597318
artifact sha256:
             f5a25c43e43b238888b9e7fb071b54e5be1713651f631403b64b235038dbf22d
```

## Observed execution

```text
Workflow type: b2ContinuitySmoke
Workflow ID:   mk0-b2-continuity-b2-827c8a16-3cee-4e1f-9706-4cc89c0a8abd
Run ID:        01a03714-a6ac-74b7-9026-6385604df81b
Task Queue:    engines-mk0-registration
Timer:         8000 ms
```

## Continuity experiment

The CI performed this sequence:

```text
1. start real Temporal Service + Web UI
2. start Worker process #1
3. start b2ContinuitySmoke
4. Query same Workflow until WAITING_ON_TEMPORAL_TIMER
5. SIGKILL Worker process #1
6. confirm process #1 is dead
7. allow the durable Temporal timer to expire with no B2 Worker alive
8. describe the exact Workflow ID + Run ID while Worker is absent
9. assert Temporal still reports WORKFLOW_EXECUTION_STATUS_RUNNING
10. start distinct Worker process #2
11. request result using the exact original Workflow ID + Run ID
12. assert result COMPLETED with the same Workflow ID + Run ID
13. capture final visibility and Event History
```

Observed process identities:

```text
Worker #1 PID: 3122
termination:   SIGKILL
Worker #2 PID: 3285
distinct:      true
```

## Critical no-Worker observation

After the timer had elapsed and before Worker #2 existed, Temporal `workflow describe` reported:

```text
status:      WORKFLOW_EXECUTION_STATUS_RUNNING
workflowId:  mk0-b2-continuity-b2-827c8a16-3cee-4e1f-9706-4cc89c0a8abd
runId:       01a03714-a6ac-74b7-9026-6385604df81b
historyLength: 7
```

This is the key B2 proof: the execution remained present in Temporal while the original Worker process no longer existed.

## Recovery observation

Worker process #2 recovered the execution and the client resolved:

```json
{
  "ok": true,
  "workflowId": "mk0-b2-continuity-b2-827c8a16-3cee-4e1f-9706-4cc89c0a8abd",
  "runId": "01a03714-a6ac-74b7-9026-6385604df81b",
  "phase": "COMPLETED",
  "taskQueue": "engines-mk0-registration",
  "status": "COMPLETED"
}
```

The original Workflow ID and Run ID did not change.

## Event History evidence

The captured Temporal Event History contains, among other events:

```text
EVENT_TYPE_WORKFLOW_EXECUTION_STARTED
EVENT_TYPE_TIMER_STARTED
EVENT_TYPE_TIMER_FIRED
EVENT_TYPE_WORKFLOW_TASK_TIMED_OUT
EVENT_TYPE_WORKFLOW_TASK_SCHEDULED
EVENT_TYPE_WORKFLOW_TASK_STARTED
EVENT_TYPE_WORKFLOW_TASK_COMPLETED
EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED
```

The Workflow Task timeout is retained as observed evidence rather than hidden. Temporal subsequently scheduled/processed Workflow work and reached the correct terminal result after Worker replacement.

## Assertions

```text
locked npm install                         PASS
strict TypeScript type-check              PASS
real Temporal Service                     PASS
Temporal Web UI reachable                 PASS
waiting state observed by Query           PASS
Worker #1 killed with SIGKILL             PASS
timer elapsed with no Worker              PASS
same execution visible with no Worker     PASS
Worker #2 is a distinct process           PASS
Worker #2 recovered execution             PASS
same Workflow ID                          PASS
same Run ID                               PASS
Event History captured                    PASS
no business side effects                  PASS
```

## Scope boundary

B2 still contains no production `RegisterNewCustomer` Workflow and no business persistence side effects.

It does not create or write:

```text
Customer
registration command rows
MongoDB execution/audit records
attachments
Appointment
ResourceReservation
```

B2 proves Temporal topology, visibility and process-replacement continuity only.

## Architectural consequence

The following claim is now evidence-backed for mk0:

> An accepted Workflow Execution is not owned by the CTA process or by one Worker process. Temporal preserves the execution and a replacement Worker can continue the same Workflow ID / Run ID from durable Event History.

This certification does not yet prove the business `RegisterNewCustomer` Workflow. That begins only after the CTA boundary is implemented in B3 and the interactive Workflow is introduced in B4.
