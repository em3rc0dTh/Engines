# C0/C1 — Workflow Visibility Contract

## Status

**IMPLEMENTATION CONTRACT — WEBCHAT FIRST / NO AGENT / NO MCP**

This document freezes a requirement of the CTA multi-channel proof: a human operator must be able to see exactly where a durable Temporal Workflow is, what has already happened, what data has been captured, and what action is legal next.

The visibility surface does not invent a second workflow state machine. It projects the state already owned by Temporal.

## Required surfaces

C1 exposes two intentionally simple HTML surfaces:

```text
/webchat/
  conversational interaction surface

/webchat/workflow.html?workflowId=<id>
  live Workflow execution inspector
```

Both read the same durable Workflow state.

## Relationship to the CLI

The existing Appointment lab console already exposes:

```text
workflowId
runId
workflowStatus
phase
nextAction
Customer
Services
Products / Offerings
Date
Available Slots
Issues
Result
```

The WebChat must show the same information rather than hiding orchestration behind a conversational UI.

CLI and WebChat are two renderers over the same CTA → Temporal interaction path.

## Visible Appointment path

The canonical Appointment workflow phases remain the source of truth:

```text
STARTED
WAITING_FOR_CUSTOMER
RESOLVING_CUSTOMER
CUSTOMER_READY
LOADING_SERVICES
WAITING_FOR_SERVICE
LOADING_PRODUCTS
WAITING_FOR_PRODUCT
WAITING_FOR_DATE
LOADING_SLOTS
WAITING_FOR_SLOT
READY_TO_FINALIZE
RESERVING_APPOINTMENT
CREATED
FAILED
```

The UI also exposes a human-readable execution checklist:

```text
01 Start Workflow
02 Customer name
03 Customer email
04 Customer phone
05 Resolve Customer
06 Select Service
07 Select Offering / Product
08 Set Date
09 Load Available Slots
10 Select Slot
11 Finalize Appointment
12 Appointment Created
```

Customer name/email/phone are presentation-level data-capture checkpoints, not new Temporal phases. They are projected from the Customer draft already held by the Workflow.

## Step states

Every visible step has one of:

```text
COMPLETE
ACTIVE
PENDING
SKIPPED
FAILED
```

The projection is deterministic from `AppointmentStateProjection`. The browser does not decide that a business step is complete because a local animation or form advanced.

## Required header

Both pages must continuously expose:

```text
workflowId
runId
workflowStatus
Temporal phase
nextAction
businessSlug / laboratory scope where available
last refresh time
```

The current Temporal phase and `nextAction` must always remain visible during manual testing.

## Chat behavior

The WebChat is deterministic and intentionally non-agentic.

It may prompt for Customer data, render Services as buttons, render Offerings as buttons, ask for a date, render available slots, and expose an explicit Finalize action.

It must not infer intent with an LLM, choose tools, reinterpret policy, or bypass the explicit Workflow Update operations.

Example:

```text
WebChat asks: Customer name
user enters: Eduardo
WebChat sends: ProvideAppointmentCustomer(name)
Temporal remains authority

WebChat asks: Customer email
user enters: ...
WebChat sends: ProvideAppointmentCustomer(email)

WebChat asks: Customer phone
user enters: ...
WebChat sends: ProvideAppointmentCustomer(phone)

WebChat exposes: Resolve Customer
user confirms
WebChat sends: ResolveAppointmentCustomer
```

The same pattern continues through Service, Offering, Date, Slot and Finalize.

## Inspector behavior

The inspector is not a separate business application. It is an engineering observability view.

It displays:

```text
current phase
next action
full step checklist
Customer projection
selected Service
selected Offering
Appointment date
available slots
selected slot
issues
terminal result
raw durable state
```

This page is deliberately useful during C1 WebChat and later C2 Telegram tests. A Telegram conversation may be observed from the same inspector because the inspector follows the Workflow, not the provider.

## Multi-channel reuse

The human-readable step projection belongs in CTA presentation/core code, not inside WebChat JavaScript.

Later:

```text
WebChat renderer  ─┐
Telegram renderer ─┼─> same AppointmentWorkflowView
future transport  ─┘
```

Provider differences stop at adapter/renderer boundaries.

## Explicit exclusions

```text
Agent                    NOT PRESENT
MCP                      NOT PRESENT
LLM intent router        NOT PRESENT
AI tool selection        NOT PRESENT
frontend workflow owner  NOT ALLOWED
provider-specific business branching NOT ALLOWED
```

## Acceptance requirement

C1 is not considered visually testable until the user can open the WebChat, start a real `RegisterNewAppointment` Workflow, and watch the inspector move through the real Temporal phases while each explicit action is executed.
