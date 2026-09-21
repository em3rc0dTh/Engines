# ME1 — Physical ManagedEntity Seal

Date: 2026-09-21

## Decision

The ME1 ManagedEntity resolution slice is physically sealed on the local WebChat path.

Runtime candidate physically exercised:

~~~text
b442015a443ae15225c781f8a5efc6d7d33cf3ee
~~~

The final physical verifier returned:

~~~text
ME1_PHYSICAL_CUSTOMER_PATHS_PASS
ME1_PHYSICAL_CAR_WASH_PASS
~~~

## Certified physical path

### Case A — unique existing Customer

~~~text
ME1 Unique Customer
  -> existing Customer: cus_me1_phys_unique
  -> email SKIPPED
  -> phone SKIPPED
  -> explicit ManagedEntity selection
  -> Renault Logan 2018
  -> Car Wash
  -> Salon Clean
  -> 2026-09-25
  -> 06:00-06:30
  -> Finalize Appointment
  -> COMPLETED / CREATED
~~~

Persisted identifiers:

~~~text
workflowId: register-appointment:golden-business:9e9a80e11a08d49fd0311189c4f1f784
appointmentId: apt_07fa01ac-db2c-495d-9fa6-6d0a01f225b4
customerId: cus_me1_phys_unique
managedEntityId: men_me1_phys_logan
managedEntity: Renault Logan 2018
caseId: case_c444aa6f-445c-4126-ab3d-623ba3a7ef48
resourceReservationId: rr_405d6f00-6209-4318-87ec-12a39ff923f5
reservationStatus: BOOKED
serviceId: svc_car_wash
productId: prd_car_wash_salon
~~~

The database verifier proved the Appointment, Case and ResourceReservation reference the same selected Renault Logan ManagedEntity and that the reservation is BOOKED.

### Case B — unknown Customer

~~~text
ME1 New Customer 20260914
  -> no unique name match
  -> email requested
  -> me1.new.20260914@example.test
  -> Customer CREATED
  -> phone SKIPPED
  -> ManagedEntity creation required
  -> Toyota Yaris ME1
  -> stable reference: ME1-YARIS-NEW-01
  -> ManagedEntity CREATED
  -> Service selection available
~~~

Persisted created Customer:

~~~text
caseBCreatedCustomerId: cus_560c603e-0109-40a4-96a1-38fd5ce78079
~~~

### Case C — ambiguous Customer

~~~text
ME1 Duplicate Customer
  -> multiple active Customers detected
  -> no Customer guessed
  -> email requested
  -> me1.duplicate.b@example.test
  -> resolved existing Customer
  -> CUSTOMER_READY
  -> ManagedEntity resolution
~~~

Final verifier proved:

~~~text
caseCResolvedCustomerId: cus_me1_phys_duplicate_b
duplicate-name active Customer count remains exactly 2
no third same-name Customer was created
~~~

## Physical defect found and repaired during certification

The first valid Case A execution exposed a WebChat presentation race: while Temporal was still resolving a name-only Customer, the UI briefly rendered the stronger-identity/email prompt.

The durable workflow was correct, but the physical UX contract was not.

Repair receipt:

~~~text
mk1/Build/evidence/managed-entity-me1-case-a-webchat-prompt-race-fix-2026-09-21.md
~~~

After the repair, Case A was rerun physically and passed without the false email prompt.

## Reproduction

Use:

~~~text
mk1/Test/MANAGED_ENTITY_ME1_PHYSICAL_RUNBOOK_2026-09-14.md
~~~

The final persisted-truth verification command is:

~~~bash
export ME1_PHYSICAL_WORKFLOW_ID='register-appointment:...'
docker compose exec -T -e ME1_PHYSICAL_WORKFLOW_ID cta npm run verify:me1:physical
~~~

Required terminal markers:

~~~text
ME1_PHYSICAL_CUSTOMER_PATHS_PASS
ME1_PHYSICAL_CAR_WASH_PASS
~~~

## ME-SEAL

~~~text
customer name discovery                    PASS
unique-name no-extra-identity path         PASS
unknown-name + email Customer creation     PASS
duplicate-name + email disambiguation      PASS
explicit durable ManagedEntity selection   PASS
ManagedEntity creation path                PASS
Appointment -> ManagedEntity propagation   PASS
Case -> ManagedEntity propagation          PASS
Reservation -> ManagedEntity propagation   PASS
Reservation BOOKED                         PASS
Car Wash service propagation               PASS
physical persisted-truth verifier          PASS
ME-SEAL                                     SEALED
~~~

## Truth boundary

This seal certifies the deterministic local WebChat ManagedEntity slice.

Not claimed:

~~~text
Agent
MCP
LLM identity/entity inference
Telegram native ManagedEntity physical certification
WhatsApp native ManagedEntity physical certification
BateYLate request-scoped physical end-to-end
v3 WorkTeam scheduling
v4 OperationalInput implementation
production HA / DR / production readiness
~~~

ME1 can now proceed to merge review. The next internal milestone after merge is the pre-Agent platform-solidity roll-up in PR #34.
