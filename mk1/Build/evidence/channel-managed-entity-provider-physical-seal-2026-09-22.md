# Channel × ManagedEntity — Native Provider Physical Seal

Date: 2026-09-22
PR: #34 — Platform solidity: pre-Agent system-wide certification gate
Branch: cert/platform-solidity-pre-agent

## Decision

Native ManagedEntity interaction is physically sealed for the two provider paths exercised in this campaign.

~~~text
Kapso / WhatsApp CREATE_MANAGED_ENTITY     PASS
Kapso / WhatsApp SELECT_MANAGED_ENTITY     PASS
Telegram CREATE_MANAGED_ENTITY             PASS
Telegram SELECT_MANAGED_ENTITY             PASS
Telegram SELECT durable persistence        PASS
current-head NO_AVAILABILITY presentation  PASS

CHANNEL × MANAGEDENTITY                    SEALED
~~~

This receipt is intentionally multi-head because defects were discovered and repaired during physical certification. Each observation remains bound to the source that was actually exercised.

## Physical source lineage

~~~text
cf9f8b89d735f408cb2ce84f8a29c9a958c481a3
  native Telegram/WhatsApp ManagedEntity candidate
  Kapso CREATE + SELECT physically exercised
  Telegram CREATE physically exercised

bd25a49567c908bb058435faac3a80e073be8ab3
  Telegram compact ManagedEntity callback fix
  Telegram SELECT physically exercised

5561836de64b0e8dc3cd0c71b77316940affd337
  provider NO_AVAILABILITY / PAST_DATE presentation fix
  current-head NO_AVAILABILITY physically exercised
  exact-head automated platform certification passed
~~~

The documentation commit containing this receipt is not retroactively presented as the source physically exercised above.

## Kapso / WhatsApp — CREATE_MANAGED_ENTITY

Observed path:

~~~text
real WhatsApp sandbox user
→ Kapso webhook
→ Engines Kapso runner
→ /appointment
→ Customer resolution
→ WAITING_FOR_MANAGED_ENTITY
→ CREATE_MANAGED_ENTITY
→ Renault Logan M4 | M4-KAPSO-VEH-001
→ Car Wash
→ Salon Clean
→ 2026-09-26
→ 06:00–06:30
→ Finalize
→ ✅ Cita creada
~~~

Persisted result:

~~~text
appointment_id:
apt_b212716b2db2adf27331452662e5ef25

managed_entity_id:
men_388168a2-58b2-493b-a221-7838e78c3aab

display_name:
Renault Logan M4

external_ref:
m4-kapso-veh-001

scheduler_reservation_id:
schedres_fb64d2027c396f91754f00d4e21ba857

scheduler status:
RESERVED

scheduler assignments:
1
~~~

Persisted invariant:

~~~text
Appointment.managed_entity_id
=
OperationalCase.managed_entity_id
=
men_388168a2-58b2-493b-a221-7838e78c3aab

Appointment.resource_reservation_id
=
NULL
~~~

Verdict:

~~~text
KAPSO CREATE_MANAGED_ENTITY ✅ PHYSICAL PASS
~~~

## Kapso / WhatsApp — SELECT_MANAGED_ENTITY

A second real Appointment rendered and reused Renault Logan M4.

~~~text
appointment_id:
apt_ca4d7ab3d02306350555940e6ea006c5

managed_entity_id:
men_388168a2-58b2-493b-a221-7838e78c3aab

scheduler_reservation_id:
schedres_98375d4a891888aab7fa1c099c27cd0a

scheduler status:
RESERVED

scheduler assignments:
1
~~~

CREATE and SELECT therefore reuse the same durable ManagedEntity while owning distinct Scheduler reservations.

~~~text
KAPSO SELECT_MANAGED_ENTITY ✅ PHYSICAL PASS
KAPSO × MANAGEDENTITY       ✅ SEALED
~~~

## Telegram — CREATE_MANAGED_ENTITY

Observed path:

~~~text
real Telegram account
→ official Bot API / getUpdates
→ /appointment
→ Customer identity resolution
→ WAITING_FOR_MANAGED_ENTITY
→ CREATE_MANAGED_ENTITY
→ Renault Logan Telegram M4 | M4-TG-VEH-001
→ Car Wash
→ offering
→ 2026-09-26
→ 07:00–07:30
→ Finalize
→ ✅ Cita creada
~~~

Persisted result:

~~~text
workflow_id:
register-appointment:golden-business:cc5be67fcc741514112bcbf90392d6db

appointment_id:
apt_cd9941e1320ab2acf9d6aff46eb05623

managed_entity_id:
men_e874d7ed-8a3f-438d-a03e-37bb92b0a764

case_managed_entity_id:
men_e874d7ed-8a3f-438d-a03e-37bb92b0a764

resource_reservation_id:
NULL

scheduler_reservation_id:
schedres_8a0ce51103b8fc040ff0d1e218dd60f0

scheduler status:
RESERVED

scheduler assignments:
1

display_name:
Renault Logan Telegram M4

external_ref:
m4-tg-veh-001
~~~

~~~text
TELEGRAM CREATE_MANAGED_ENTITY ✅ PHYSICAL PASS
~~~

## Telegram — SELECT_MANAGED_ENTITY

The second Appointment rendered:

~~~text
Selecciona vehículo
→ Renault Logan Telegram M4
~~~

After callback hardening, the user selected the existing vehicle and completed:

~~~text
appointment_id:
apt_c89912076c6de344b88434ecc303f250

date:
2026-09-25

slot:
06:30–07:00
~~~

Direct PostgreSQL verification:

~~~text
workflow_id:
register-appointment:golden-business:25a841c522834e49a672d1594fc27d5b

managed_entity_id:
men_e874d7ed-8a3f-438d-a03e-37bb92b0a764

case_managed_entity_id:
men_e874d7ed-8a3f-438d-a03e-37bb92b0a764

resource_reservation_id:
NULL

scheduler_reservation_id:
schedres_bd424c2391cfdb5bfb2f240218b759c6

scheduler status:
RESERVED

scheduler assignments:
1

display_name:
Renault Logan Telegram M4

external_ref:
m4-tg-veh-001
~~~

~~~text
TELEGRAM SELECT_MANAGED_ENTITY ✅ PHYSICAL PASS
TELEGRAM SELECT DURABLE SQL    ✅ PASS
TELEGRAM × MANAGEDENTITY       ✅ SEALED
~~~

## Defect 1 — stale local Telegram image

Symptom:

~~~text
TELEGRAM_APPOINTMENT_QUERY_TIMEOUT:WAITING_FOR_MANAGED_ENTITY
~~~

Temporal had already reached the correct durable phase, but the local Telegram image still contained the older WAITING_FOR_MANAGED_ENTITY → WAIT behavior.

Cause: docker compose run reused a previously built local image.

Recovery:

~~~text
docker compose build telegram-bot
docker compose --profile telegram run --rm --no-deps telegram-bot
~~~

No repository defect was attributed to this local stale-image condition.

## Defect 2 — Telegram callback payload too long

Symptom:

~~~text
TELEGRAM_BOT_API_HTTP:sendMessage:400
~~~

The original callback was:

~~~text
appointment_managed_entity:<UUID>
~~~

It exceeded Telegram callback_data limits for UUID-backed ids.

Repair source:

~~~text
bd25a49567c908bb058435faac3a80e073be8ab3
~~~

New callback:

~~~text
ame:<managedEntityId>
~~~

The adapter keeps legacy callback compatibility. Regression coverage asserts the UUID-shaped callback stays within 64 UTF-8 bytes. The SELECT journey was rerun physically and passed.

## Defect 3 — no-availability presentation ambiguity

During Telegram SELECT certification the user entered a valid Saturday with exhausted Scheduler capacity.

Temporal correctly did:

~~~text
valid date
→ Scheduler returns 0 slots
→ issue NO_AVAILABILITY
→ appointmentDate cleared
→ WAITING_FOR_DATE
~~~

The provider originally repeated only the generic date prompt.

Repair source:

~~~text
5561836de64b0e8dc3cd0c71b77316940affd337
~~~

New provider behavior:

~~~text
NO_AVAILABILITY
→ No hay horarios disponibles para esa fecha. Elige otra fecha.

PAST_DATE
→ Esa fecha ya pasó. Elige una fecha futura.
~~~

Current-head physical recheck:

~~~text
Sábado
→ explicit NO_AVAILABILITY message
→ Viernes
→ Scheduler slots rendered
→ journey continued normally
~~~

~~~text
CURRENT-HEAD NO_AVAILABILITY UX ✅ PHYSICAL PASS
~~~

## Scheduler truth retained

The current G2-S7+ runtime intentionally does not write a legacy ResourceReservation shadow row for new Scheduler-backed Appointments.

~~~text
Appointment.managed_entity_id
=
OperationalCase.managed_entity_id

Appointment.resource_reservation_id
=
NULL

Appointment.scheduler_reservation_id
→ SchedulerReservation(status = RESERVED)

SchedulerReservationAssignment count
=
1 for the currently certified one-resource path
~~~

SchedulerReservation does not carry managed_entity_id. Operational subject belongs to Appointment/Case and capacity belongs to Scheduler.

## Privacy boundary

Not committed:

~~~text
operator phone numbers
private contact details
provider tokens
webhook secrets
access credentials
screenshots containing private account material
~~~

## Claim boundary

Certified:

~~~text
Kapso native ManagedEntity CREATE + SELECT
Telegram native ManagedEntity CREATE + SELECT
durable Appointment/Case ManagedEntity propagation
Scheduler-backed reservation linkage
Telegram callback hardening for UUID ManagedEntity ids
provider NO_AVAILABILITY physical behavior
Channel × ManagedEntity
~~~

Not certified by this receipt:

~~~text
production HA / DR
production rollout
all Telegram client variants
direct Meta Cloud API physical Appointment path
all Meta/TikTok capabilities
Agent
MCP
LLM entity inference
~~~

Final verdict:

~~~text
CHANNEL × MANAGEDENTITY ✅ PHYSICALLY SEALED
~~~
