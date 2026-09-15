import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ConfirmReservationInput,
  CreateHoldInput,
  ScheduleOverride,
  ScheduleTemplate,
  SchedulerHold,
  SchedulerReservation,
  SchedulerResource,
  SchedulingDemand,
  SlotCandidate,
} from './types.js';
import {
  validateConfirmReservationInput,
  validateCreateHoldInput,
  validateScheduleOverride,
  validateScheduleTemplate,
  validateSchedulerHold,
  validateSchedulerReservation,
  validateSchedulerResource,
  validateSchedulingDemand,
  validateSlotCandidate,
} from './validation.js';

const resource: SchedulerResource = {
  resourceId: 'res_bay_2',
  businessSlug: 'golden-business',
  code: 'bay-2',
  kind: 'BAY',
  name: 'Bay 2',
  status: 'ACTIVE',
  timeZone: 'America/Lima',
  capacity: 2,
  capabilities: [
    { code: 'WASH_BAY', capacityUnits: 2, metadata: { lane: 'north' } },
  ],
  revision: 1,
};

const schedule: ScheduleTemplate = {
  scheduleId: 'schedule_bay_2_v1',
  businessSlug: resource.businessSlug,
  resourceId: resource.resourceId,
  timeZone: resource.timeZone,
  weeklyWindows: [
    { weekday: 1, startLocal: '08:00', endLocal: '12:00', capacity: 2 },
    { weekday: 1, startLocal: '13:00', endLocal: '17:00', capacity: 2 },
  ],
  revision: 1,
};

const override: ScheduleOverride = {
  overrideId: 'override_bay_2_maintenance',
  businessSlug: resource.businessSlug,
  resourceId: resource.resourceId,
  startAt: '2026-09-21T12:00:00-05:00',
  endAt: '2026-09-21T13:00:00-05:00',
  kind: 'UNAVAILABLE',
  reasonCode: 'MAINTENANCE',
  revision: 1,
};

const demand: SchedulingDemand = {
  schemaVersion: 1,
  businessSlug: resource.businessSlug,
  demandId: 'demand_appointment_1',
  service: { serviceId: 'svc_car_wash', revision: 4 },
  offering: {
    offeringId: 'prd_car_wash_executive',
    revision: 7,
    durationMinutes: 30,
  },
  capacityUnits: 1,
  requiredCapabilities: [
    { code: 'WASH_BAY', quantity: 1, resourceKinds: ['BAY'] },
  ],
  buffers: { beforeMinutes: 5, afterMinutes: 10 },
};

const candidate: SlotCandidate = {
  candidateId: 'candidate_1',
  startAt: '2026-09-21T10:00:00-05:00',
  endAt: '2026-09-21T10:30:00-05:00',
  timeZone: 'America/Lima',
  assignments: [{ resourceId: resource.resourceId, capacityUnits: 1 }],
};

const createHold: CreateHoldInput = {
  businessSlug: resource.businessSlug,
  operationId: 'hold-operation-1',
  demandId: demand.demandId,
  candidateId: candidate.candidateId,
  expiresInSeconds: 300,
};

const hold: SchedulerHold = {
  holdId: 'hold_1',
  businessSlug: resource.businessSlug,
  demandId: demand.demandId,
  startAt: candidate.startAt,
  endAt: candidate.endAt,
  assignments: candidate.assignments,
  expiresAt: '2026-09-14T19:00:00Z',
  status: 'ACTIVE',
};

const confirm: ConfirmReservationInput = {
  businessSlug: resource.businessSlug,
  operationId: 'confirm-operation-1',
  demand,
  candidateId: candidate.candidateId,
  holdId: hold.holdId,
  requestedStartAt: candidate.startAt,
};

const reservation: SchedulerReservation = {
  reservationId: 'reservation_1',
  businessSlug: resource.businessSlug,
  demandId: demand.demandId,
  startAt: candidate.startAt,
  endAt: candidate.endAt,
  timeZone: candidate.timeZone,
  assignments: candidate.assignments,
  status: 'RESERVED',
  revision: 1,
  createdAt: '2026-09-14T18:00:00Z',
  updatedAt: '2026-09-14T18:00:00Z',
};

test('G2-S0 accepts the frozen Scheduler contract family', () => {
  assert.deepEqual(validateSchedulerResource(resource), []);
  assert.deepEqual(validateScheduleTemplate(schedule), []);
  assert.deepEqual(validateScheduleOverride(override), []);
  assert.deepEqual(validateSchedulingDemand(demand), []);
  assert.deepEqual(validateSlotCandidate(candidate), []);
  assert.deepEqual(validateCreateHoldInput(createHold), []);
  assert.deepEqual(validateSchedulerHold(hold), []);
  assert.deepEqual(validateConfirmReservationInput(confirm), []);
  assert.deepEqual(validateSchedulerReservation(reservation), []);
});

test('G2-S0 freezes Services snapshot identity in SchedulingDemand', () => {
  assert.equal(demand.schemaVersion, 1);
  assert.deepEqual(demand.service, { serviceId: 'svc_car_wash', revision: 4 });
  assert.deepEqual(demand.offering, {
    offeringId: 'prd_car_wash_executive',
    revision: 7,
    durationMinutes: 30,
  });
  assert.deepEqual(demand.requiredCapabilities, [
    { code: 'WASH_BAY', quantity: 1, resourceKinds: ['BAY'] },
  ]);
});

test('G2-S0 preserves availability shown != reservation persisted', () => {
  assert.equal('status' in candidate, false);
  assert.equal('reservationId' in candidate, false);
  assert.equal(candidate.candidateId, createHold.candidateId);
  assert.equal(candidate.candidateId, confirm.candidateId);
  assert.notEqual(hold.holdId, reservation.reservationId);
});

test('G2-S0 rejects invalid timezone, capacity and schedule material', () => {
  assert.ok(validateSchedulerResource({ ...resource, timeZone: 'Not/AZone' }).some((entry) => entry.code === 'INVALID_TIME_ZONE'));
  assert.ok(validateSchedulerResource({ ...resource, capacity: 0 }).some((entry) => entry.code === 'INVALID_CAPACITY'));
  assert.ok(validateScheduleTemplate({
    ...schedule,
    weeklyWindows: [{ weekday: 7, startLocal: '10:30', endLocal: '10:00' }],
  }).some((entry) => entry.code === 'INVALID_SCHEDULE' || entry.code === 'INVALID_INTERVAL'));
  assert.ok(validateScheduleOverride({
    ...override,
    kind: 'CAPACITY',
  }).some((entry) => entry.code === 'INVALID_CAPACITY'));
});

test('G2-S0 rejects server-local ambiguous instants and duplicate assignments', () => {
  assert.ok(validateSlotCandidate({
    ...candidate,
    startAt: '2026-09-21T10:00:00',
  }).some((entry) => entry.code === 'INVALID_INTERVAL'));
  assert.ok(validateSchedulerReservation({
    ...reservation,
    assignments: [reservation.assignments[0]!, reservation.assignments[0]!],
  }).some((entry) => entry.code === 'INVALID_ASSIGNMENT'));
});

test('G2-S0 freezes operation identity at Scheduler mutation boundaries', () => {
  assert.ok(validateCreateHoldInput({ ...createHold, operationId: ' ' }).some((entry) => entry.code === 'INVALID_IDENTITY'));
  assert.ok(validateConfirmReservationInput({ ...confirm, operationId: '' }).some((entry) => entry.code === 'INVALID_IDENTITY'));
  assert.ok(validateConfirmReservationInput({
    ...confirm,
    businessSlug: 'other-business',
  }).some((entry) => entry.code === 'INVALID_BUSINESS_SCOPE'));
});
