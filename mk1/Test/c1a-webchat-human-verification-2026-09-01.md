# C1A — WebChat Human Verification — 2026-09-01 / 2026-09-02

## Verdict

**✅ PASS — C1A WORKFLOW-VISIBLE WEBCHAT HUMAN VERIFIED, INCLUDING POST-FIX VISUAL CONFIRMATION**

This record captures two real manual browser executions performed after the automated C1A certification. It supplements, but does not replace, the CI authority recorded in `Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`.

The public repository intentionally does **not** reproduce tester email addresses, phone numbers, customer IDs, Workflow IDs, Run IDs, or Appointment IDs. Those values were present during testing and were visibly captured by the Workflow, but are redacted here as personal/operational information.

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

Explicit phase boundary during both tests:

```text
Agent  NOT PRESENT
MCP    NOT PRESENT
LLM    NOT PRESENT
```

## Manual execution result

Both human runs completed a full Appointment Workflow through the browser and reached:

```text
workflowStatus  COMPLETED
Temporal phase  CREATED
nextAction      NONE
issues          []
```

The Workflow inspector and WebChat surface showed the same durable Workflow identity and terminal state.

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

## First human run — 2026-09-01

Non-sensitive business values observed:

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

The Spanish human date input `Sábado` normalized to the canonical date and the Workflow proceeded through slot selection to final creation.

### UX defect discovered

The business flow passed, but two presentation timing defects were visible:

```text
Step 08 date prompt rendered twice
Step 11 finalize prompt rendered twice
```

These were not duplicate business effects. Durable state contained one selected date, one selected slot, and one terminal Appointment result.

Root cause:

```text
accepted user action
→ browser cleared lastPromptKey immediately
→ immediate refresh could still observe the previous durable phase
→ same prompt rendered again
→ Temporal then advanced normally
```

Remediation commit:

```text
ed207f8c82ae9138f92fd505209c30c4eeba243b
fix(c1a): prevent duplicate prompts while Temporal advances
```

Post-fix automated regression:

```text
Run           33560864234
Job           100032737031
Result        SUCCESS
Artifact      9821207955
Artifact SHA  4f7fc1ddea852a9501f20078d0df8ecc84dc3c645e8b1362424c6d6f11ae37ff
```

The post-fix run passed strict typecheck, C0 Workflow-view tests, inherited CTA/Appointment regressions, clean Compose startup, WebChat startup, and the complete Appointment-through-WebChat certification path.

## Second human run — 2026-09-02 — post-fix visual verification

A complete new Appointment flow was executed after the renderer correction.

Non-sensitive business values observed:

```text
Business scope          golden-business
Customer resolution     CREATED
Service                 Car Wash
Offering                Salon Clean
Human date input        viernes
Canonical date          2026-09-04
Available slots         3
Selected slot           06:30–07:00
Terminal result         Appointment created
```

Observed durable result:

```text
workflowStatus = COMPLETED
phase          = CREATED
nextAction     = NONE
issues         = []
customer       = CREATED
selectedService.name = Car Wash
selectedProduct.name = Salon Clean
appointmentDate = 2026-09-04
selectedSlot.start = 06:30
selectedSlot.end   = 07:00
```

The `view.steps` projection reported all twelve checkpoints `COMPLETE`, and the dedicated Workflow Inspector displayed the same final state and business projection.

### Post-fix presentation result

The exact defects discovered in the first human run were re-checked:

```text
Step 08 duplicate date prompt       NOT OBSERVED
Step 11 duplicate finalize prompt   NOT OBSERVED
```

The WebChat transitioned cleanly:

```text
WAITING_FOR_DATE
→ user date input
→ WAITING_FOR_SLOT

READY_TO_FINALIZE
→ explicit Finalize Appointment
→ CREATED
```

No duplicated prompt was visible in either transition.

## Additional human observations

- Intermediate durable phases such as `RESOLVING_CUSTOMER`, `CUSTOMER_READY`, and `LOADING_PRODUCTS` remained visible rather than being hidden by the chat renderer.
- Step 09 (`Load Available Slots`) correctly appeared as a Workflow progress checkpoint without inventing an artificial user command.
- A newly created Customer path was also proven, complementing the first run's existing-Customer path.
- Spanish natural date forms remained deterministic CTA inputs without any Agent/LLM interpretation layer.
- The completed Workflow remained inspectable through the separate Workflow Inspector after terminal creation.

## Manual evidence classification

```text
Automated C1A CI proof                ✅ PASS
Human WebChat flow #1                 ✅ PASS
Human Workflow Inspector #1           ✅ PASS
Prompt duplication defect discovered  ✅ DOCUMENTED
Prompt duplication remediation        ✅ IMPLEMENTED
Post-fix automated regression          ✅ PASS
Human WebChat flow #2 post-fix         ✅ PASS
Human Workflow Inspector #2            ✅ PASS
Step 08 duplication after fix          ✅ NOT OBSERVED
Step 11 duplication after fix          ✅ NOT OBSERVED
12-step visible progression            ✅ PASS
EXISTING Customer path                 ✅ PASS
CREATED Customer path                  ✅ PASS
Spanish date normalization             ✅ PASS
Terminal Appointment creation          ✅ PASS
No Agent / No MCP / No LLM             ✅ CONFIRMED
```

## C1A closure statement

C1A is now supported by both automated evidence and repeated human browser evidence, including post-fix visual confirmation of the renderer timing correction.

Truthful bounded statement:

> Engines can drive the explicit CTA → Temporal `RegisterNewAppointment` workflow through the minimal HTML WebChat, expose the real durable phase and next action throughout execution, show the complete 12-step human-readable Workflow map, and reach a persisted terminal Appointment without Agent, MCP, LLM orchestration, or a browser-owned business state machine.

## Remaining boundary

This result does **not** close C1B.

Still open:

```text
server-side durable channel conversation binding
inbound event identity/fingerprint ledger
duplicate browser-event replay proof
same event identity + different material conflict proof
adapter restart/recovery using durable binding
```

Therefore the truthful status is:

```text
C1A workflow-visible WebChat            ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
C1B durable channel semantics           ❌ OPEN
full WebChat channel gate               ❌ NOT YET CLOSED
Telegram                                ⏭ AFTER C1B
```

## Privacy note

The source manual tests contained real contact and execution identifiers. This public repository record stores only the facts necessary for engineering evidence and deliberately omits the actual personal/contact identifiers.