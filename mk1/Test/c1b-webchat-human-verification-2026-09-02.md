# C1B — WebChat Human Verification — 2026-09-02

## Verdict

**✅ C1B HUMAN RESTART/RECOVERY VERIFIED**

This record captures the human browser executions reported on 2026-09-02 against `build/mk1-c1b-durable-channel`.

Automated C1B had already certified durable WebChat conversation binding, event replay/conflict semantics, and physical adapter-process restart. Human testing now independently confirms the same operational property from the browser: the tester stopped only the WebChat adapter, restarted `npm run webchat:server` while the durable laboratory remained alive, reopened/resumed the same WebChat conversation, recovered the same active Temporal Workflow, and continued it to terminal Appointment creation.

Contact data and execution identifiers are intentionally not duplicated in this public repository record.

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

The WebChat view and the separate Workflow Inspector converged on the same durable final execution.

## Human restart/recovery proof

The tester explicitly attested that the requested restart procedure worked:

```text
1. Start a new durable WebChat Appointment conversation.
2. Advance the Workflow through Customer / Service / Offering interaction.
3. Stop only the WebChat adapter process with Ctrl+C.
4. Keep Temporal, PostgreSQL, MongoDB, Worker and CTA/channel-core running.
5. Start a new WebChat adapter process with npm run webchat:server.
6. Resume the same external WebChat conversation.
7. Recover the same Temporal Workflow rather than creating a new one.
8. Continue through Date -> Slots -> Slot -> Finalize.
9. Reach COMPLETED / CREATED.
```

Human verdict:

```text
WebChat process replacement           PASS
external conversation recovery        PASS
same durable Workflow recovery        PASS
continued multi-turn execution        PASS
terminal Appointment creation         PASS
12/12 visible Workflow map            PASS
```

This closes the previously pending human restart/recovery attestation.

## Negative-input observations

Human testing also exercised rejection and recovery behavior rather than only the happy path:

```text
non-email text at email step          -> CHANNEL_EVENT_INVALID
invalid/alphanumeric phone material   -> CHANNEL_EVENT_INVALID
short invalid phone material          -> CHANNEL_EVENT_INVALID
unsupported date text                 -> INVALID_DATE
```

After rejection, the conversation remained usable and the tester could submit corrected material without creating a duplicate Workflow or duplicate Appointment result.

## Availability/date observation

A human run also observed a valid weekday/date normalization that advanced into slot loading and then returned to `WAITING_FOR_DATE` when no slots were available for that date. A later valid date produced available slots and completed normally.

### UX finding C1B-H01 — non-blocking

The UI currently re-prompts Step 08 after a no-slot date without an explicit explanation such as:

```text
No available slots for <date>. Choose another date.
```

The durable state transition is correct. This remains a renderer/CTA-view UX improvement, not a Temporal, channel-binding, or Appointment truth defect.

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

This human verification supports the bounded statement:

> A human user can drive the hardened C1B WebChat, recover the same active Temporal Appointment Workflow after replacing the WebChat adapter process, continue the same durable conversation, survive invalid-input corrections, and complete the Appointment at `COMPLETED / CREATED` with WebChat and Workflow Inspector parity.

It does not expand the automated C1B claim into Telegram, WhatsApp, Scheduler, Agent/MCP, production security, or general production readiness.

## Related automated certification

Automated C1B authority remains unchanged:

```text
Source SHA    2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run           33647842017
Job           100307008849
Artifact      9853555059
Artifact SHA  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

Receipt: `../Build/evidence/c1b-durable-channel-certification-2026-09-02.md`.

## Closure

```text
C1A workflow-visible WebChat            ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
C1B durable WebChat semantics           ✅ CERTIFIED + HUMAN RESTART/RECOVERY VERIFIED
C2 Telegram                             🔧 NEXT CHANNEL GATE
```
