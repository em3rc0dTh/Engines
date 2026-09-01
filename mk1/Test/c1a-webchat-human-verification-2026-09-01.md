# C1A — WebChat Human Verification — 2026-09-01

## Verdict

**✅ PASS — HUMAN MANUAL VERIFICATION OF THE C1A WORKFLOW-VISIBLE WEBCHAT**

This record captures a real manual browser execution performed after the automated C1A certification. It supplements, but does not replace, the CI authority recorded in `Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`.

The public repository intentionally does **not** reproduce the tester's email address or phone number. Those values were present during the test and were visibly captured by the Workflow, but are redacted here as personal information.

## Tested architecture

```text
Browser WebChat
      ↓
WebChat transport / renderer
      ↓
existing CTA HTTP boundary
      ↓
Temporal
      ↓
RegisterNewAppointment
      ↓
existing persistence / audit boundaries
```

Explicit phase boundary during this test:

```text
Agent  NOT PRESENT
MCP    NOT PRESENT
LLM    NOT PRESENT
```

## Manual execution result

The tester completed one full Appointment Workflow through the browser.

Observed terminal state:

```text
workflowStatus  COMPLETED
Temporal phase  CREATED
nextAction      NONE
issues          []
```

The Workflow inspector and chat surface both showed the same durable Workflow identity and terminal state.

## Human-visible path executed

```text
01 Start Workflow               COMPLETE
02 Customer name                COMPLETE
03 Customer email               COMPLETE
04 Customer phone               COMPLETE
05 Resolve Customer             COMPLETE
06 Select Service               COMPLETE
07 Select Offering / Product    COMPLETE
08 Set Date                     COMPLETE
09 Load Available Slots         COMPLETE
10 Select Slot                  COMPLETE
11 Finalize Appointment         COMPLETE
12 Appointment Created          COMPLETE
```

## Important observed values

Non-sensitive business values observed during the manual run:

```text
Business scope          golden-business
Customer resolution     EXISTING
Service                 Car Wash
Offering                Executive Clean
Human date input        Sábado
Canonical date          2026-09-05
Available slots         3
Selected slot           07:00–07:30
Terminal result         Appointment created
```

The Spanish human date input `Sábado` normalized to the canonical date `2026-09-05` and the Workflow proceeded to slot selection and final creation.

## Durable-state observations

The final raw state showed:

```text
workflowStatus = COMPLETED
phase          = CREATED
nextAction     = NONE
issues         = []
customer       = EXISTING
selectedService.name = Car Wash
selectedProduct.name = Executive Clean
appointmentDate = 2026-09-05
selectedSlot.start = 07:00
selectedSlot.end   = 07:30
```

The `view.steps` projection also reported every checkpoint as `COMPLETE`.

This is important because the browser did not merely display a success message; the terminal result was reflected in the same durable Temporal-derived state used by the Workflow inspector.

## UX observations found during the human test

The business flow passed, but two presentation issues were visible and should be corrected before calling the WebChat polished:

1. The Step 08 date prompt was rendered twice around the transition from date submission to `WAITING_FOR_SLOT`.
2. The Step 11 finalize prompt was rendered twice around the transition from `READY_TO_FINALIZE` to `CREATED`.

These are **presentation/render timing defects**, not duplicate business effects. The durable state contains one selected date, one selected slot, and one terminal Appointment result.

Also observed:

- Step 09 (`Load Available Slots`) is correctly represented in the execution map as a durable progress checkpoint rather than requiring an artificial user action.
- The completed Workflow remained inspectable with the raw durable state visible.

## Manual evidence classification

This test strengthens the C1A claim from automated browser-transport execution to an actual human interaction proof:

```text
Automated C1A CI proof          ✅ PASS
Human manual WebChat proof      ✅ PASS
Human Workflow inspector proof  ✅ PASS
12-step visible progression     ✅ PASS
Spanish date normalization      ✅ PASS
Terminal Appointment creation   ✅ PASS
No Agent / No MCP               ✅ CONFIRMED
```

## Remaining boundary

This manual result does **not** close C1B.

Still open:

```text
server-side durable channel conversation binding
inbound event identity/fingerprint ledger
duplicate browser-event replay proof
same event identity + different material conflict proof
adapter restart/recovery using durable binding
```

Therefore the truthful status remains:

```text
C1A workflow-visible WebChat            ✅ CERTIFIED + HUMAN VERIFIED
C1B durable channel semantics           ❌ OPEN
full WebChat channel gate               ❌ NOT YET CLOSED
Telegram                                ⏭ AFTER C1B
```

## Privacy note

The source manual test contained real contact data. This repository record deliberately stores only the fact that email/phone capture succeeded and omits the actual values. Public engineering evidence must not require publishing tester PII.
