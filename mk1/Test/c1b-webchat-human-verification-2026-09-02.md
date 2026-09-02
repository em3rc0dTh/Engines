# C1B — WebChat Human Verification — 2026-09-02

## Verdict

**HUMAN E2E COMPLETION OBSERVED — RESTART/RECOVERY ATTESTATION PENDING**

This record captures the human browser execution reported on 2026-09-02 against `build/mk1-c1b-durable-channel`.

The submitted transcript proves a complete durable Appointment execution through the hardened WebChat channel and matching Workflow Inspector. It does **not** itself contain an observable process-stop/process-start event, so the human restart/recovery claim remains pending explicit tester confirmation even though automated C1B already certifies that property.

## Human-observed terminal state

```text
workflowStatus       COMPLETED
Temporal phase       CREATED
nextAction           NONE
bindingStatus        COMPLETED
all visible steps    12 / 12 COMPLETE
issues               []
appointment result   present
Workflow Inspector   same final durable state
Agent                absent
MCP                  absent
```

The WebChat view and the separate Workflow Inspector agreed on the same Workflow ID, Run ID, final phase, selected business data, slot, and created Appointment result.

## Negative-input observations

The human run also exercised rejection and recovery behavior rather than only the happy path:

```text
email step: non-email text        -> CHANNEL_EVENT_INVALID
phone step: alphanumeric input    -> CHANNEL_EVENT_INVALID
date step: unsupported text       -> INVALID_DATE
```

After each rejection, the Workflow remained usable and the user continued without a duplicated Appointment result.

## Availability/date observation

A valid human weekday input for Sunday advanced to slot loading and then returned to `WAITING_FOR_DATE`, after which the user selected Saturday and received three slots.

This is consistent with a date that normalizes successfully but has no available slots in the current laboratory schedule.

### UX finding C1B-H01 — non-blocking

The UI currently re-prompts Step 08 after a no-slot date without an explicit human explanation such as:

```text
No available slots for <date>. Choose another date.
```

The durable state transition is correct, but the presentation can be clearer. This is a renderer/CTA-view UX issue, not a Temporal or Appointment truth defect.

## Business result observed

The user selected:

```text
Service   Car Wash
Offering  Basic Clean
Date      2026-09-05
Slot      06:00–06:30
```

The final durable projection contained one created Customer and one created Appointment result. Contact values and execution identifiers are intentionally not duplicated in this repository record.

## Human-visible step map

```text
01 Start Workflow                COMPLETE
02 Customer name                 COMPLETE
03 Customer email                COMPLETE
04 Customer phone                COMPLETE
05 Resolve Customer              COMPLETE
06 Select Service                COMPLETE
07 Select Offering / Product     COMPLETE
08 Set Date                      COMPLETE
09 Load Available Slots          COMPLETE
10 Select Slot                   COMPLETE
11 Finalize Appointment          COMPLETE
12 Appointment Created           COMPLETE
```

## Evidence boundary

This report supports:

> A human user can drive the hardened C1B WebChat through invalid-input recovery and complete the real durable `RegisterNewAppointment` Workflow, with WebChat and Workflow Inspector converging on `COMPLETED / CREATED` and all twelve visible checkpoints complete.

This submitted transcript alone does **not** prove that the tester actually stopped and restarted the WebChat process mid-run. Automated C1B certification already proves adapter restart/recovery; the human restart/recovery label should be added only after explicit tester attestation.

## Related certification

Automated C1B authority:

```text
Source SHA    2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run           33647842017
Job           100307008849
Artifact      9853555059
Artifact SHA  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

Receipt: `../Build/evidence/c1b-durable-channel-certification-2026-09-02.md`.

## Pending tester attestation

To upgrade the human verdict to **C1B HUMAN RESTART/RECOVERY VERIFIED**, record one explicit statement that during this same run the tester:

1. stopped only the WebChat adapter process;
2. restarted `npm run webchat:server` while Temporal/PostgreSQL/Worker remained alive;
3. reopened/resumed the same external WebChat conversation;
4. recovered the same Workflow and continued to the terminal result shown above.
