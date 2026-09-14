# ME1 — Physical WebChat Execution Runbook

Date: 2026-09-14

## Purpose

Close the physical browser gates for the deterministic customer-resolution and ManagedEntity slice:

```text
fresh WebChat
→ Customer resolution
→ ManagedEntity resolution
→ Car Wash appointment
```

This runbook certifies only the local physical WebChat path. It does not claim Agent, MCP, LLM, Telegram/WhatsApp provider delivery, v3 WorkTeam scheduling, or v4 OperationalInput behavior.

## Preconditions

Use branch:

```text
feature/managed-entity-resolution-policy
```

Record the exact candidate before beginning:

```bash
git rev-parse HEAD
```

Use a disposable local test database. Case B deliberately requires that its synthetic unknown Customer does not already exist. The fixture command fails closed when that condition is not true.

## 1. Start the physical WebChat stack

From `mk1/runtime`:

```bash
docker compose --profile webchat down -v --remove-orphans
docker compose --profile webchat up --build -d
```

Expected local surfaces:

```text
WebChat      http://127.0.0.1:8790/webchat/
Temporal UI http://127.0.0.1:8233/
CTA          http://127.0.0.1:8787/health
Channel Core http://127.0.0.1:8788/health
```

Check the stack:

```bash
docker compose --profile webchat ps
curl -fsS http://127.0.0.1:8790/health
```

The WebChat health response must report `ok=true`, `agent=false`, and `mcp=false`.

## 2. Prepare deterministic physical fixtures

```bash
docker compose exec -T cta npm run fixture:me1:physical
```

Expected marker:

```text
ME1_PHYSICAL_FIXTURES_READY
```

The fixture establishes:

```text
Case A
name: ME1 Unique Customer
Customer: cus_me1_phys_unique
ManagedEntities:
- Renault Logan 2018
- Nissan Sentra 2020

Case B
name: ME1 New Customer 20260914
email: me1.new.20260914@example.test
Expected precondition: no matching Customer exists.

Case C
name: ME1 Duplicate Customer
Two existing Customers share the same normalized name.
Use email: me1.duplicate.b@example.test
Expected Customer: cus_me1_phys_duplicate_b
```

## 3. Case A — unique existing Customer by name

Open a fresh Incognito/Private browser window at:

```text
http://127.0.0.1:8790/webchat/
```

Execute:

```text
Start Workflow
→ enter: ME1 Unique Customer
```

Required physical observations:

```text
Temporal resolves the Customer as EXISTING.
WebChat MUST NOT ask for email.
WebChat MUST NOT ask for phone.
The next durable gate is ManagedEntity selection.
Both Renault Logan 2018 and Nissan Sentra 2020 are presented.
```

Select:

```text
Renault Logan 2018
```

Then finish the business intent:

```text
Car Wash
→ choose one Offering (Executive Clean is acceptable)
→ choose an available date
→ choose an available slot
→ Finalize Appointment
```

Record:

```text
Conversation id
Workflow id
Appointment id
Selected ManagedEntity
```

The selected ManagedEntity must remain `Renault Logan 2018` through the final Appointment.

## 4. Case B — unknown name, then email

Use a new fresh Incognito/Private browser session so no previous WebChat conversation identity is reused.

Execute:

```text
Start Workflow
→ name: ME1 New Customer 20260914
```

Required observation:

```text
No unique Customer is found.
WebChat asks for email.
```

Enter:

```text
me1.new.20260914@example.test
```

Required observation:

```text
Temporal performs strong-identity lookup.
No existing strong match exists.
The Customer is created deterministically from name + email.
The Workflow moves to ManagedEntity resolution.
```

Because this new Customer has no vehicle, create one in WebChat, for example:

```text
displayName: Toyota Yaris ME1
stable reference: ME1-YARIS-NEW-01
```

Required observation:

```text
ManagedEntity is created for the newly created Customer.
Service selection becomes available.
```

A second Appointment is not required for this customer-resolution gate.

## 5. Case C — duplicate name, then email disambiguation

Use another fresh Incognito/Private browser session.

Execute:

```text
Start Workflow
→ name: ME1 Duplicate Customer
```

Required observation:

```text
Temporal returns AMBIGUOUS.
WebChat asks for email instead of guessing a Customer.
```

Enter:

```text
me1.duplicate.b@example.test
```

Required observation:

```text
Temporal resolves Customer cus_me1_phys_duplicate_b.
No third same-name Customer is created.
The Workflow proceeds to ManagedEntity resolution.
```

## 6. Verify persisted truth

Use the Case A Workflow id recorded from the completed Renault Logan Car Wash flow:

```bash
ME1_PHYSICAL_WORKFLOW_ID='register-appointment:...' \
  docker compose exec -T -e ME1_PHYSICAL_WORKFLOW_ID="$ME1_PHYSICAL_WORKFLOW_ID" \
  cta npm run verify:me1:physical
```

Expected markers:

```text
ME1_PHYSICAL_CUSTOMER_PATHS_PASS
ME1_PHYSICAL_CAR_WASH_PASS
```

The verifier requires all of the following:

```text
Case A Appointment.customerId = cus_me1_phys_unique
Appointment.managedEntityId = men_me1_phys_logan
Case.managedEntityId = men_me1_phys_logan
Reservation.managedEntityId = men_me1_phys_logan
Reservation.status = BOOKED
Service = svc_car_wash
Exactly one APPOINTMENT_REGISTERED timeline event
Case B created exactly one Customer for the synthetic name+email
Case C still has exactly two same-name Customers
Case C email remains mapped to cus_me1_phys_duplicate_b
```

## 7. Evidence to preserve

Preserve the candidate SHA plus the physical observations for Cases A/B/C and the verifier output. Screenshots are useful for the human-facing prompts, but the database verifier is the authority for final Appointment/Case/Reservation subject propagation.

Do not mark ME-SEAL complete if any prompt is skipped incorrectly, if Temporal guesses between duplicate names, if a Case/Reservation points to a different ManagedEntity than the Appointment, or if the physical run was performed against a different unrecorded candidate SHA.
