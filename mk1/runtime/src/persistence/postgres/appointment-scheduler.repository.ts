import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type {
  AppointmentResult,
  AppointmentSlot,
} from '../../contracts/register-new-appointment/index.js';
import type {
  SchedulerReservation,
  SchedulingDemand,
  SlotCandidate,
} from '../../contracts/scheduler-engine/index.js';
import type {
  ServiceDefinition,
  ServiceOffering,
} from '../../contracts/services-engine/index.js';
import { PostgresSchedulerFoundationRepository } from './scheduler-foundation.repository.js';
import { queryDeterministicAvailability } from '../../scheduler/availability-engine.js';
import {
  materializeAndPersistSchedulingDemand,
} from '../../scheduler/services-demand-handoff.js';
import {
  confirmReservationAtomic,
  SchedulerReservationError,
} from '../../scheduler/reservation-engine.js';

const APPOINTMENT_GRID_MINUTES = 30;
const MAX_TIME_ZONE_OFFSET_HOURS = 14;
const HOUR_MS = 60 * 60_000;

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 12 });
  return pool;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export type SchedulerBackedBookAppointmentInput = Readonly<{
  appointmentCommandId: string;
  workflowId: string;
  businessSlug: string;
  customerId: string;
  serviceId: string;
  productId: string;
  appointmentDate: string;
  slotStart: string;
  timezone?: string;
}>;

export type SchedulerBackedBookAppointmentResult =
  | Readonly<{ kind: 'BOOKED'; appointment: AppointmentResult; replay: boolean }>
  | Readonly<{ kind: 'SLOT_CONFLICT'; availableSlots: readonly AppointmentSlot[] }>;

type CandidateProjection = Readonly<{
  candidate: SlotCandidate;
  slot: AppointmentSlot;
}>;

type LocalDateTime = Readonly<{
  date: string;
  time: string;
}>;

export function appointmentSchedulingDemandId(
  businessSlug: string,
  workflowId: string,
  offeringId: string,
): string {
  const digest = sha256(`${businessSlug}\u0000${workflowId}\u0000${offeringId}`).slice(0, 40);
  return `appointment-demand-${digest}`;
}

function appointmentSchedulerOperationId(workflowId: string): string {
  return `appointment-finalize:${workflowId}`;
}

function localDateTime(instant: string, timeZone: string): LocalDateTime {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instant))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function broadUtcWindow(appointmentDate: string): Readonly<{ startAt: string; endAt: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    throw new Error(`APPOINTMENT_SCHEDULER_INVALID_DATE:${appointmentDate}`);
  }
  const midnightUtc = Date.parse(`${appointmentDate}T00:00:00.000Z`);
  if (!Number.isFinite(midnightUtc)) {
    throw new Error(`APPOINTMENT_SCHEDULER_INVALID_DATE:${appointmentDate}`);
  }
  return {
    startAt: new Date(midnightUtc - MAX_TIME_ZONE_OFFSET_HOURS * HOUR_MS).toISOString(),
    endAt: new Date(midnightUtc + (24 + MAX_TIME_ZONE_OFFSET_HOURS) * HOUR_MS).toISOString(),
  };
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Freeze the exact Services projections shown to one durable Appointment
 * workflow. A retry of the same Activity/material is a replay; if mutable
 * Services advances before a lost Activity result is retried, the immutable
 * demand identity fails closed rather than silently switching revisions.
 */
export async function freezeAppointmentSchedulingDemands(input: Readonly<{
  businessSlug: string;
  workflowId: string;
  service: ServiceDefinition;
  offerings: readonly ServiceOffering[];
}>): Promise<readonly ServiceOffering[]> {
  if (
    input.service.businessSlug !== input.businessSlug
    || input.offerings.some((offering) =>
      offering.businessSlug !== input.businessSlug || offering.serviceId !== input.service.serviceId)
  ) {
    throw new Error('APPOINTMENT_SCHEDULER_SERVICES_SCOPE_MISMATCH');
  }

  const schedulable = input.offerings.filter((offering) =>
    offering.status === 'ACTIVE' && offering.scheduling !== undefined,
  );

  for (const offering of schedulable) {
    await materializeAndPersistSchedulingDemand(
      db(),
      { service: input.service, offering },
      appointmentSchedulingDemandId(input.businessSlug, input.workflowId, offering.offeringId),
    );
  }
  return schedulable;
}

async function loadAppointmentDemand(
  businessSlug: string,
  workflowId: string,
  productId: string,
): Promise<SchedulingDemand> {
  const repository = new PostgresSchedulerFoundationRepository(db());
  const demandId = appointmentSchedulingDemandId(businessSlug, workflowId, productId);
  const demand = await repository.getDemand(businessSlug, demandId);
  if (!demand) {
    throw new Error(`APPOINTMENT_SCHEDULER_DEMAND_NOT_FROZEN:${demandId}`);
  }
  if (demand.offering.offeringId !== productId) {
    throw new Error(`APPOINTMENT_SCHEDULER_DEMAND_OFFERING_MISMATCH:${demandId}`);
  }
  return demand;
}

async function queryAppointmentCandidates(input: Readonly<{
  businessSlug: string;
  workflowId: string;
  productId: string;
  appointmentDate: string;
}>): Promise<Readonly<{ demand: SchedulingDemand; candidates: readonly CandidateProjection[] }>> {
  const demand = await loadAppointmentDemand(
    input.businessSlug,
    input.workflowId,
    input.productId,
  );
  const resources = await db().query<{ resource_id: string; time_zone: string }>(
    `SELECT resource_id, time_zone
       FROM scheduler_resources
      WHERE business_slug = $1 AND status = 'ACTIVE'
      ORDER BY time_zone ASC, resource_id ASC`,
    [input.businessSlug],
  );
  const byTimeZone = new Map<string, string[]>();
  for (const resource of resources.rows) {
    const ids = byTimeZone.get(resource.time_zone) ?? [];
    ids.push(resource.resource_id);
    byTimeZone.set(resource.time_zone, ids);
  }

  const window = broadUtcWindow(input.appointmentDate);
  const asOf = new Date().toISOString();
  const projected: CandidateProjection[] = [];

  for (const [timeZone, resourceIds] of [...byTimeZone.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const availability = await queryDeterministicAvailability(db(), {
      businessSlug: input.businessSlug,
      requestId: `appointment:${input.workflowId}:${input.appointmentDate}:${timeZone}`,
      demand,
      window: {
        startAt: window.startAt,
        endAt: window.endAt,
        timeZone,
      },
      preferredResourceIds: resourceIds,
    }, {
      granularityMinutes: APPOINTMENT_GRID_MINUTES,
      generatedAt: asOf,
      asOf,
    });

    for (const candidate of availability.slots) {
      // G2-S7 closes the one-concrete-resource Appointment path. G2-S8 owns
      // generalized multi-resource Appointment composition.
      if (candidate.assignments.length !== 1) continue;
      const start = localDateTime(candidate.startAt, candidate.timeZone);
      if (start.date !== input.appointmentDate) continue;
      const end = localDateTime(candidate.endAt, candidate.timeZone);
      projected.push({
        candidate,
        slot: {
          start: start.time,
          end: end.time,
          durationMinutes: demand.offering.durationMinutes,
        },
      });
    }
  }

  projected.sort((left, right) =>
    left.candidate.startAt.localeCompare(right.candidate.startAt)
      || left.candidate.endAt.localeCompare(right.candidate.endAt)
      || left.candidate.candidateId.localeCompare(right.candidate.candidateId),
  );

  // The inherited Appointment contract selects by local HH:mm. Until G2-S8
  // exposes resource composition, retain one deterministic candidate per local
  // start value so channel renderers cannot select an ambiguous duplicate.
  const seenStarts = new Set<string>();
  const deduped = projected.filter((entry) => {
    if (seenStarts.has(entry.slot.start)) return false;
    seenStarts.add(entry.slot.start);
    return true;
  });

  return { demand, candidates: deduped };
}

export async function listAppointmentSlotsViaScheduler(input: Readonly<{
  businessSlug: string;
  workflowId: string;
  productId: string;
  appointmentDate: string;
}>): Promise<readonly AppointmentSlot[]> {
  const result = await queryAppointmentCandidates(input);
  return result.candidates.map((entry) => entry.slot);
}

async function schedulerReservationById(
  client: PoolClient,
  businessSlug: string,
  reservationId: string,
): Promise<SchedulerReservation | undefined> {
  const reservationResult = await client.query<{
    reservation_id: string;
    business_slug: string;
    demand_id: string;
    start_at: Date | string;
    end_at: Date | string;
    time_zone: string;
    status: SchedulerReservation['status'];
    revision: number;
    created_at: Date | string;
    updated_at: Date | string;
  }>(
    `SELECT reservation_id, business_slug, demand_id, start_at, end_at, time_zone,
            status, revision, created_at, updated_at
       FROM scheduler_reservations
      WHERE business_slug = $1 AND reservation_id = $2`,
    [businessSlug, reservationId],
  );
  const row = reservationResult.rows[0];
  if (!row) return undefined;
  const assignments = await client.query<{ resource_id: string; capacity_units: number }>(
    `SELECT resource_id, capacity_units
       FROM scheduler_reservation_assignments
      WHERE business_slug = $1 AND reservation_id = $2
      ORDER BY resource_id ASC`,
    [businessSlug, reservationId],
  );
  return {
    reservationId: row.reservation_id,
    businessSlug: row.business_slug,
    demandId: row.demand_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    timeZone: row.time_zone,
    assignments: assignments.rows.map((assignment) => ({
      resourceId: assignment.resource_id,
      capacityUnits: assignment.capacity_units,
    })),
    status: row.status,
    revision: row.revision,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function appointmentById(
  client: PoolClient,
  appointmentId: string,
): Promise<AppointmentResult | undefined> {
  const result = await client.query<{
    appointment_id: string;
    customer_id: string;
    service_id: string;
    product_id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    managed_entity_id: string | null;
    case_id: string | null;
    resource_reservation_id: string | null;
    scheduler_reservation_id: string | null;
  }>(
    `SELECT appointment_id, customer_id, service_id, product_id,
            appointment_date::text, start_time::text, end_time::text,
            managed_entity_id, case_id, resource_reservation_id,
            scheduler_reservation_id
       FROM appointments
      WHERE appointment_id = $1`,
    [appointmentId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const start = row.start_time.slice(0, 5);
  const end = row.end_time.slice(0, 5);
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const durationMinutes = ((endHour! * 60 + endMinute!) - (startHour! * 60 + startMinute!) + 1440) % 1440;
  return {
    appointmentId: row.appointment_id,
    customerId: row.customer_id,
    ...(row.managed_entity_id ? { managedEntityId: row.managed_entity_id } : {}),
    ...(row.case_id ? { caseId: row.case_id } : {}),
    ...(row.resource_reservation_id ? { resourceReservationId: row.resource_reservation_id } : {}),
    ...(row.scheduler_reservation_id ? { schedulerReservationId: row.scheduler_reservation_id } : {}),
    serviceId: row.service_id,
    productId: row.product_id,
    appointmentDate: row.appointment_date.slice(0, 10),
    slot: { start, end, durationMinutes },
  };
}

export async function getSchedulerBackedAppointmentById(
  appointmentId: string,
): Promise<AppointmentResult | undefined> {
  const client = await db().connect();
  try {
    return await appointmentById(client, appointmentId);
  } finally {
    client.release();
  }
}

async function persistAppointmentFromSchedulerReservation(
  input: SchedulerBackedBookAppointmentInput,
  operationId: string,
  expectedDemand: SchedulingDemand,
  reservationId: string,
): Promise<AppointmentResult> {
  return transaction(async (client) => {
    const commandResult = await client.query<{
      status: 'RESERVED' | 'BOOKED';
      appointment_id: string | null;
    }>(
      `SELECT status, appointment_id
         FROM appointment_commands
        WHERE appointment_command_id = $1 AND business_slug = $2
        FOR UPDATE`,
      [input.appointmentCommandId, input.businessSlug],
    );
    const command = commandResult.rows[0];
    if (!command) throw new Error('APPOINTMENT_COMMAND_NOT_FOUND');
    if (command.status === 'BOOKED' && command.appointment_id) {
      const existing = await appointmentById(client, command.appointment_id);
      if (!existing) throw new Error('APPOINTMENT_BOOKED_COMMAND_WITHOUT_APPOINTMENT');
      return existing;
    }

    const schedulerCommand = await client.query<{
      command_type: string;
      result_type: string | null;
      result_id: string | null;
    }>(
      `SELECT command_type, result_type, result_id
         FROM scheduler_commands
        WHERE business_slug = $1 AND operation_id = $2
        FOR UPDATE`,
      [input.businessSlug, operationId],
    );
    const schedulerLedger = schedulerCommand.rows[0];
    if (
      !schedulerLedger
      || schedulerLedger.command_type !== 'ConfirmReservation'
      || schedulerLedger.result_type !== 'RESERVATION'
      || schedulerLedger.result_id !== reservationId
    ) {
      throw new Error('APPOINTMENT_SCHEDULER_CONFIRMATION_LEDGER_MISMATCH');
    }

    const reservation = await schedulerReservationById(client, input.businessSlug, reservationId);
    if (!reservation || reservation.status !== 'RESERVED') {
      throw new Error('APPOINTMENT_SCHEDULER_RESERVATION_NOT_RESERVED');
    }
    if (reservation.demandId !== expectedDemand.demandId) {
      throw new Error('APPOINTMENT_SCHEDULER_DEMAND_MISMATCH');
    }
    if (reservation.assignments.length !== 1) {
      throw new Error('APPOINTMENT_SCHEDULER_G2_S8_MULTI_RESOURCE_NOT_CERTIFIED');
    }

    const demandRow = await client.query<{
      service_id: string;
      offering_id: string;
      service_revision: number;
      offering_revision: number;
    }>(
      `SELECT service_id, offering_id, service_revision, offering_revision
         FROM scheduler_demands
        WHERE business_slug = $1 AND demand_id = $2`,
      [input.businessSlug, reservation.demandId],
    );
    const frozen = demandRow.rows[0];
    if (
      !frozen
      || frozen.service_id !== input.serviceId
      || frozen.offering_id !== input.productId
      || frozen.service_revision !== expectedDemand.service.revision
      || frozen.offering_revision !== expectedDemand.offering.revision
    ) {
      throw new Error('APPOINTMENT_SCHEDULER_FROZEN_SELECTION_MISMATCH');
    }

    const customer = await client.query(
      `SELECT 1
         FROM customers
        WHERE business_slug = $1 AND customer_id = $2 AND status = 'ACTIVE'`,
      [input.businessSlug, input.customerId],
    );
    if ((customer.rowCount ?? 0) !== 1) throw new Error('CUSTOMER_NOT_FOUND');

    // Appointment foreign keys remain presentation/domain references only.
    // Active catalog head is deliberately NOT re-read: frozen Scheduler demand
    // revisions are the finalization semantics certified by G2-S6/G2-S7.
    const catalogIdentity = await client.query(
      `SELECT 1
         FROM service_products p
         JOIN service_catalog s
           ON s.business_slug = p.business_slug AND s.service_id = p.service_id
        WHERE p.business_slug = $1
          AND p.product_id = $2
          AND p.service_id = $3`,
      [input.businessSlug, input.productId, input.serviceId],
    );
    if ((catalogIdentity.rowCount ?? 0) !== 1) throw new Error('PRODUCT_SERVICE_MISMATCH');

    const localStart = localDateTime(reservation.startAt, reservation.timeZone);
    const localEnd = localDateTime(reservation.endAt, reservation.timeZone);
    if (localStart.date !== input.appointmentDate || localStart.time !== input.slotStart) {
      throw new Error('APPOINTMENT_SCHEDULER_SELECTED_SLOT_MISMATCH');
    }

    const managedEntityCandidate = `men_${randomUUID()}`;
    const managedEntity = await client.query<{ managed_entity_id: string }>(
      `INSERT INTO managed_entities
        (managed_entity_id,business_slug,customer_id,entity_type,external_ref)
       VALUES ($1,$2,$3,'CUSTOMER_SUBJECT','default')
       ON CONFLICT (business_slug,customer_id,entity_type,external_ref)
       DO UPDATE SET status='ACTIVE'
       RETURNING managed_entity_id`,
      [managedEntityCandidate, input.businessSlug, input.customerId],
    );
    const managedEntityId = managedEntity.rows[0]!.managed_entity_id;

    const caseId = `case_${sha256(`${input.businessSlug}:${input.workflowId}`).slice(0, 32)}`;
    await client.query(
      `INSERT INTO operational_cases
        (case_id,business_slug,customer_id,managed_entity_id,workflow_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [caseId, input.businessSlug, input.customerId, managedEntityId, input.workflowId],
    );

    const appointmentId = `apt_${sha256(`${input.businessSlug}:${input.workflowId}`).slice(0, 32)}`;
    const resourceId = reservation.assignments[0]!.resourceId;
    await client.query(
      `INSERT INTO appointments (
         appointment_id, business_slug, workflow_id, customer_id, service_id, product_id,
         appointment_date, start_time, end_time, timezone, resource_key, status,
         managed_entity_id, case_id, resource_reservation_id, scheduler_reservation_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8::time,$9::time,$10,$11,'BOOKED',$12,$13,NULL,$14)`,
      [
        appointmentId,
        input.businessSlug,
        input.workflowId,
        input.customerId,
        input.serviceId,
        input.productId,
        localStart.date,
        localStart.time,
        localEnd.time,
        reservation.timeZone,
        resourceId,
        managedEntityId,
        caseId,
        reservation.reservationId,
      ],
    );

    const timelineEventId = `tle_${sha256(`${input.businessSlug}:${input.workflowId}:APPOINTMENT_REGISTERED`).slice(0, 32)}`;
    await client.query(
      `INSERT INTO operational_timeline_events (
         timeline_event_id,business_slug,case_id,appointment_id,resource_reservation_id,
         event_type,workflow_id,payload_json
       ) VALUES ($1,$2,$3,$4,NULL,'APPOINTMENT_REGISTERED',$5,$6::jsonb)`,
      [
        timelineEventId,
        input.businessSlug,
        caseId,
        appointmentId,
        input.workflowId,
        JSON.stringify({
          customerId: input.customerId,
          managedEntityId,
          catalogOfferingId: input.productId,
          schedulerReservationId: reservation.reservationId,
          schedulerDemandId: reservation.demandId,
        }),
      ],
    );

    const commandUpdate = await client.query(
      `UPDATE appointment_commands
          SET status = 'BOOKED', appointment_id = $2, updated_at = NOW()
        WHERE appointment_command_id = $1 AND status = 'RESERVED'`,
      [input.appointmentCommandId, appointmentId],
    );
    if (commandUpdate.rowCount !== 1) {
      throw new Error('APPOINTMENT_COMMAND_FINALIZATION_CONFLICT');
    }

    const appointment = await appointmentById(client, appointmentId);
    if (!appointment) throw new Error('APPOINTMENT_SCHEDULER_PERSISTENCE_MISSING');
    return appointment;
  });
}

export async function bookAppointmentViaScheduler(
  input: SchedulerBackedBookAppointmentInput,
): Promise<SchedulerBackedBookAppointmentResult> {
  const appointmentCommand = await db().query<{
    status: 'RESERVED' | 'BOOKED';
    appointment_id: string | null;
  }>(
    `SELECT status, appointment_id
       FROM appointment_commands
      WHERE appointment_command_id = $1 AND business_slug = $2`,
    [input.appointmentCommandId, input.businessSlug],
  );
  const command = appointmentCommand.rows[0];
  if (!command) throw new Error('APPOINTMENT_COMMAND_NOT_FOUND');
  if (command.status === 'BOOKED' && command.appointment_id) {
    const existing = await getSchedulerBackedAppointmentById(command.appointment_id);
    if (!existing) throw new Error('APPOINTMENT_BOOKED_COMMAND_WITHOUT_APPOINTMENT');
    return { kind: 'BOOKED', appointment: existing, replay: true };
  }

  const operationId = appointmentSchedulerOperationId(input.workflowId);
  const frozenDemand = await loadAppointmentDemand(
    input.businessSlug,
    input.workflowId,
    input.productId,
  );
  if (
    frozenDemand.service.serviceId !== input.serviceId
    || frozenDemand.offering.offeringId !== input.productId
  ) {
    throw new Error('APPOINTMENT_SCHEDULER_FROZEN_SELECTION_MISMATCH');
  }

  // Activity retry after Scheduler commit but before Appointment persistence:
  // recover the durable Scheduler result first, so own capacity does not look
  // like a fresh slot conflict.
  const previousSchedulerCommand = await db().query<{
    command_type: string;
    result_type: string | null;
    result_id: string | null;
  }>(
    `SELECT command_type, result_type, result_id
       FROM scheduler_commands
      WHERE business_slug = $1 AND operation_id = $2`,
    [input.businessSlug, operationId],
  );
  const previous = previousSchedulerCommand.rows[0];
  if (previous) {
    if (
      previous.command_type !== 'ConfirmReservation'
      || previous.result_type !== 'RESERVATION'
      || !previous.result_id
    ) {
      throw new Error('APPOINTMENT_SCHEDULER_COMMAND_IDENTITY_CONFLICT');
    }
    const existingReservationClient = await db().connect();
    try {
      const reservation = await schedulerReservationById(
        existingReservationClient,
        input.businessSlug,
        previous.result_id,
      );
      if (!reservation) throw new Error('APPOINTMENT_SCHEDULER_REPLAY_RESERVATION_MISSING');
    } finally {
      existingReservationClient.release();
    }
    const appointment = await persistAppointmentFromSchedulerReservation(
      input,
      operationId,
      frozenDemand,
      previous.result_id,
    );
    return { kind: 'BOOKED', appointment, replay: true };
  }

  const availability = await queryAppointmentCandidates({
    businessSlug: input.businessSlug,
    workflowId: input.workflowId,
    productId: input.productId,
    appointmentDate: input.appointmentDate,
  });
  const selected = availability.candidates.find((entry) => entry.slot.start === input.slotStart);
  if (!selected) {
    return {
      kind: 'SLOT_CONFLICT',
      availableSlots: availability.candidates.map((entry) => entry.slot),
    };
  }

  let reservation: SchedulerReservation;
  try {
    const confirmed = await confirmReservationAtomic(db(), {
      businessSlug: input.businessSlug,
      operationId,
      demand: frozenDemand,
      candidateId: selected.candidate.candidateId,
      requestedStartAt: selected.candidate.startAt,
    });
    reservation = confirmed.reservation;
  } catch (error) {
    if (
      error instanceof SchedulerReservationError
      && ['CAPACITY_CONFLICT', 'SLOT_NO_LONGER_AVAILABLE', 'RESOURCE_INACTIVE'].includes(error.code)
    ) {
      const refreshed = await listAppointmentSlotsViaScheduler({
        businessSlug: input.businessSlug,
        workflowId: input.workflowId,
        productId: input.productId,
        appointmentDate: input.appointmentDate,
      });
      return { kind: 'SLOT_CONFLICT', availableSlots: refreshed };
    }
    throw error;
  }

  const appointment = await persistAppointmentFromSchedulerReservation(
    input,
    operationId,
    frozenDemand,
    reservation.reservationId,
  );
  return { kind: 'BOOKED', appointment, replay: false };
}

export async function closeAppointmentSchedulerRepository(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
