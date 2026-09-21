import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import { projectAppointmentWorkflow } from './appointment-workflow-view.js';

function baseState(overrides: Partial<AppointmentStateProjection> = {}): AppointmentStateProjection {
  return {
    workflowId: 'wf-test',
    workflowStatus: 'RUNNING',
    phase: 'WAITING_FOR_CUSTOMER',
    customer: { status: 'EMPTY' },
    services: [],
    products: [],
    availableSlots: [],
    nextAction: 'PROVIDE_CUSTOMER',
    issues: [],
    ...overrides,
  };
}

function step(view: ReturnType<typeof projectAppointmentWorkflow>, id: string) {
  const found = view.steps.find((candidate) => candidate.id === id);
  assert.ok(found, `missing step ${id}`);
  return found;
}

test('C0 view exposes customer capture checkpoints without inventing Temporal phases', () => {
  const view = projectAppointmentWorkflow(baseState());
  assert.equal(view.phase, 'WAITING_FOR_CUSTOMER');
  assert.equal(view.nextAction, 'PROVIDE_CUSTOMER');
  assert.equal(view.currentStepId, 'CUSTOMER_NAME');
  assert.equal(step(view, 'WORKFLOW_START').status, 'COMPLETE');
  assert.equal(step(view, 'CUSTOMER_NAME').status, 'ACTIVE');
  assert.equal(step(view, 'CUSTOMER_EMAIL').status, 'PENDING');
});

test('C0 view advances deterministic customer data checkpoints from durable draft state', () => {
  const view = projectAppointmentWorkflow(baseState({
    customer: {
      status: 'DRAFT',
      customer: {
        name: 'Eduardo',
        contact: { email: 'eduardo@example.test' },
      },
    },
    nextAction: 'RESOLVE_CUSTOMER',
  }));
  assert.equal(step(view, 'CUSTOMER_NAME').status, 'COMPLETE');
  assert.equal(step(view, 'CUSTOMER_EMAIL').status, 'COMPLETE');
  assert.equal(step(view, 'CUSTOMER_PHONE').status, 'ACTIVE');
  assert.equal(step(view, 'CUSTOMER_RESOLUTION').status, 'PENDING');
});

test('C0 view marks provider-independent business selections from Workflow state', () => {
  const view = projectAppointmentWorkflow(baseState({
    phase: 'WAITING_FOR_SLOT',
    customer: { status: 'EXISTING', customerId: 'cus-1' },
    services: [{ serviceId: 'svc-1', code: 'WASH', name: 'Car Wash' }],
    selectedService: { serviceId: 'svc-1', code: 'WASH', name: 'Car Wash' },
    products: [{ productId: 'prd-1', serviceId: 'svc-1', code: 'BASIC', name: 'Basic', durationMinutes: 30 }],
    selectedProduct: { productId: 'prd-1', serviceId: 'svc-1', code: 'BASIC', name: 'Basic', durationMinutes: 30 },
    appointmentDate: '2026-09-04',
    availableSlots: [{ start: '06:00', end: '06:30', durationMinutes: 30 }],
    nextAction: 'SELECT_SLOT',
  }));
  assert.equal(step(view, 'CUSTOMER_NAME').status, 'SKIPPED');
  assert.equal(step(view, 'CUSTOMER_RESOLUTION').status, 'COMPLETE');
  assert.equal(step(view, 'SERVICE_SELECTION').status, 'COMPLETE');
  assert.equal(step(view, 'OFFERING_SELECTION').status, 'COMPLETE');
  assert.equal(step(view, 'DATE_SELECTION').status, 'COMPLETE');
  assert.equal(step(view, 'SLOTS_LOADING').status, 'COMPLETE');
  assert.equal(step(view, 'SLOT_SELECTION').status, 'ACTIVE');
  assert.equal(view.currentStepId, 'SLOT_SELECTION');
});

test('C0 view exposes terminal completion and failure explicitly', () => {
  const completed = projectAppointmentWorkflow(baseState({
    workflowStatus: 'COMPLETED',
    phase: 'CREATED',
    customer: { status: 'EXISTING', customerId: 'cus-1' },
    selectedService: { serviceId: 'svc-1', code: 'WASH', name: 'Car Wash' },
    selectedProduct: { productId: 'prd-1', serviceId: 'svc-1', code: 'BASIC', name: 'Basic', durationMinutes: 30 },
    appointmentDate: '2026-09-04',
    selectedSlot: { start: '06:00', end: '06:30', durationMinutes: 30 },
    result: {
      appointmentId: 'apt-1',
      customerId: 'cus-1',
      serviceId: 'svc-1',
      productId: 'prd-1',
      appointmentDate: '2026-09-04',
      slot: { start: '06:00', end: '06:30', durationMinutes: 30 },
    },
    nextAction: 'NONE',
  }));
  assert.equal(step(completed, 'FINALIZE_APPOINTMENT').status, 'COMPLETE');
  assert.equal(step(completed, 'APPOINTMENT_CREATED').status, 'COMPLETE');
  assert.equal(completed.currentStepId, 'APPOINTMENT_CREATED');

  const failed = projectAppointmentWorkflow(baseState({
    workflowStatus: 'FAILED',
    phase: 'FAILED',
    nextAction: 'NONE',
  }));
  assert.equal(step(failed, 'APPOINTMENT_CREATED').status, 'FAILED');
  assert.equal(failed.currentStepId, 'APPOINTMENT_CREATED');
});
