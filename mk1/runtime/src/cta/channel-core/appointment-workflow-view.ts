import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';

export type ChannelWorkflowStepStatus = 'COMPLETE' | 'ACTIVE' | 'PENDING' | 'SKIPPED' | 'FAILED';

export type AppointmentWorkflowStepId =
  | 'WORKFLOW_START'
  | 'CUSTOMER_NAME'
  | 'CUSTOMER_EMAIL'
  | 'CUSTOMER_PHONE'
  | 'CUSTOMER_RESOLUTION'
  | 'SERVICE_SELECTION'
  | 'OFFERING_SELECTION'
  | 'DATE_SELECTION'
  | 'SLOTS_LOADING'
  | 'SLOT_SELECTION'
  | 'FINALIZE_APPOINTMENT'
  | 'APPOINTMENT_CREATED';

export type AppointmentWorkflowStepView = Readonly<{
  id: AppointmentWorkflowStepId;
  number: number;
  label: string;
  status: ChannelWorkflowStepStatus;
  value?: string;
}>;

export type AppointmentWorkflowView = Readonly<{
  workflowId: string;
  workflowStatus: AppointmentStateProjection['workflowStatus'];
  phase: AppointmentStateProjection['phase'];
  nextAction: AppointmentStateProjection['nextAction'];
  currentStepId: AppointmentWorkflowStepId;
  steps: readonly AppointmentWorkflowStepView[];
  issues: AppointmentStateProjection['issues'];
  result?: AppointmentStateProjection['result'];
}>;

const RESOLVED_CUSTOMER_STATUSES = new Set(['EXISTING', 'CREATED']);
const SERVICE_ACTIVE_PHASES = new Set(['CUSTOMER_READY', 'LOADING_SERVICES', 'WAITING_FOR_SERVICE']);
const OFFERING_ACTIVE_PHASES = new Set(['LOADING_PRODUCTS', 'WAITING_FOR_PRODUCT']);
const DATE_ACTIVE_PHASES = new Set(['WAITING_FOR_DATE']);
const SLOTS_ACTIVE_PHASES = new Set(['LOADING_SLOTS']);
const SLOT_ACTIVE_PHASES = new Set(['WAITING_FOR_SLOT']);
const FINALIZE_ACTIVE_PHASES = new Set(['READY_TO_FINALIZE', 'RESERVING_APPOINTMENT']);

function valueStatus(value: string | undefined, active: boolean, skipped: boolean): ChannelWorkflowStepStatus {
  if (value) return 'COMPLETE';
  if (skipped) return 'SKIPPED';
  return active ? 'ACTIVE' : 'PENDING';
}

function phoneValue(state: AppointmentStateProjection): string | undefined {
  const first = state.customer.customer?.contact?.phones?.[0];
  return first?.number ?? first?.normalized;
}

function currentStep(steps: readonly AppointmentWorkflowStepView[]): AppointmentWorkflowStepId {
  return steps.find((step) => step.status === 'FAILED')?.id
    ?? steps.find((step) => step.status === 'ACTIVE')?.id
    ?? [...steps].reverse().find((step) => step.status === 'COMPLETE')?.id
    ?? 'WORKFLOW_START';
}

export function projectAppointmentWorkflow(state: AppointmentStateProjection): AppointmentWorkflowView {
  const customerResolved = Boolean(state.customer.customerId)
    && RESOLVED_CUSTOMER_STATUSES.has(state.customer.status);
  const customerCaptureOpen = !customerResolved
    && (state.phase === 'WAITING_FOR_CUSTOMER' || state.phase === 'RESOLVING_CUSTOMER' || state.phase === 'STARTED');

  const name = state.customer.customer?.name?.trim() || undefined;
  const email = state.customer.customer?.contact?.email?.trim() || undefined;
  const phone = phoneValue(state)?.trim() || undefined;
  const customerSkip = customerResolved;

  const customerNameStatus = valueStatus(name, customerCaptureOpen && !name, customerSkip && !name);
  const customerEmailStatus = valueStatus(
    email,
    customerCaptureOpen && Boolean(name) && !email,
    customerSkip && !email,
  );
  const customerPhoneStatus = valueStatus(
    phone,
    customerCaptureOpen && Boolean(name) && Boolean(email) && !phone,
    customerSkip && !phone,
  );

  const resolutionStatus: ChannelWorkflowStepStatus = customerResolved
    ? 'COMPLETE'
    : state.phase === 'RESOLVING_CUSTOMER'
      ? 'ACTIVE'
      : state.nextAction === 'RESOLVE_CUSTOMER' && Boolean(name) && Boolean(email) && Boolean(phone)
        ? 'ACTIVE'
        : 'PENDING';

  const created = state.phase === 'CREATED' && state.workflowStatus === 'COMPLETED';
  const failed = state.phase === 'FAILED' || state.workflowStatus === 'FAILED';

  const steps: AppointmentWorkflowStepView[] = [
    { id: 'WORKFLOW_START', number: 1, label: 'Start Workflow', status: 'COMPLETE', value: state.workflowId },
    { id: 'CUSTOMER_NAME', number: 2, label: 'Customer name', status: customerNameStatus, ...(name ? { value: name } : {}) },
    { id: 'CUSTOMER_EMAIL', number: 3, label: 'Customer email', status: customerEmailStatus, ...(email ? { value: email } : {}) },
    { id: 'CUSTOMER_PHONE', number: 4, label: 'Customer phone', status: customerPhoneStatus, ...(phone ? { value: phone } : {}) },
    {
      id: 'CUSTOMER_RESOLUTION',
      number: 5,
      label: 'Resolve Customer',
      status: resolutionStatus,
      ...(state.customer.customerId ? { value: state.customer.customerId } : {}),
    },
    {
      id: 'SERVICE_SELECTION',
      number: 6,
      label: 'Select Service',
      status: state.selectedService
        ? 'COMPLETE'
        : SERVICE_ACTIVE_PHASES.has(state.phase) && customerResolved
          ? 'ACTIVE'
          : 'PENDING',
      ...(state.selectedService ? { value: state.selectedService.name } : {}),
    },
    {
      id: 'OFFERING_SELECTION',
      number: 7,
      label: 'Select Offering / Product',
      status: state.selectedProduct
        ? 'COMPLETE'
        : OFFERING_ACTIVE_PHASES.has(state.phase)
          ? 'ACTIVE'
          : 'PENDING',
      ...(state.selectedProduct ? { value: state.selectedProduct.name } : {}),
    },
    {
      id: 'DATE_SELECTION',
      number: 8,
      label: 'Set Date',
      status: state.appointmentDate
        ? 'COMPLETE'
        : DATE_ACTIVE_PHASES.has(state.phase)
          ? 'ACTIVE'
          : 'PENDING',
      ...(state.appointmentDate ? { value: state.appointmentDate } : {}),
    },
    {
      id: 'SLOTS_LOADING',
      number: 9,
      label: 'Load Available Slots',
      status: state.availableSlots.length > 0 || state.selectedSlot
        ? 'COMPLETE'
        : SLOTS_ACTIVE_PHASES.has(state.phase)
          ? 'ACTIVE'
          : 'PENDING',
      ...(state.availableSlots.length > 0 ? { value: `${state.availableSlots.length} slot(s)` } : {}),
    },
    {
      id: 'SLOT_SELECTION',
      number: 10,
      label: 'Select Slot',
      status: state.selectedSlot
        ? 'COMPLETE'
        : SLOT_ACTIVE_PHASES.has(state.phase)
          ? 'ACTIVE'
          : 'PENDING',
      ...(state.selectedSlot ? { value: `${state.selectedSlot.start}–${state.selectedSlot.end}` } : {}),
    },
    {
      id: 'FINALIZE_APPOINTMENT',
      number: 11,
      label: 'Finalize Appointment',
      status: created
        ? 'COMPLETE'
        : FINALIZE_ACTIVE_PHASES.has(state.phase)
          ? 'ACTIVE'
          : 'PENDING',
    },
    {
      id: 'APPOINTMENT_CREATED',
      number: 12,
      label: 'Appointment Created',
      status: failed ? 'FAILED' : created ? 'COMPLETE' : 'PENDING',
      ...(state.result?.appointmentId ? { value: state.result.appointmentId } : {}),
    },
  ];

  return {
    workflowId: state.workflowId,
    workflowStatus: state.workflowStatus,
    phase: state.phase,
    nextAction: state.nextAction,
    currentStepId: currentStep(steps),
    steps,
    issues: state.issues,
    ...(state.result ? { result: state.result } : {}),
  };
}
