import {
  ApplicationFailure,
  condition,
  defineQuery,
  defineUpdate,
  executeChild,
  proxyActivities,
  setHandler,
  workflowInfo,
} from '@temporalio/workflow';
import {
  type AppointmentIssue,
  type AppointmentProduct,
  type AppointmentResult,
  type AppointmentService,
  type AppointmentSlot,
  type AppointmentStateProjection,
  type AppointmentUpdateResult,
  type FinalizeAppointmentInput,
  type ProvideAppointmentCustomerInput,
  type RegisterNewAppointmentStartEnvelope,
  type ResolveAppointmentCustomerInput,
  type SelectAppointmentProductInput,
  type SelectAppointmentServiceInput,
  type SelectAppointmentSlotInput,
  type SetAppointmentDateInput,
} from '../../../contracts/register-new-appointment/index.js';
import {
  GOLDEN_REGISTRATION_POLICY_V1,
  REGISTER_NEW_CUSTOMER_OPERATION,
  REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  canonicalJson,
  evaluateRegistrationCompleteness,
  mergeCustomerDraft,
  normalizeCustomerDraft,
  type CustomerDraft,
  type RegisterNewCustomerStartEnvelope,
} from '../../../contracts/register-new-customer/index.js';
import type { AppointmentActivities } from '../activities/appointment.types.js';
import type {
  AppointmentAuditActivities,
  AppointmentAuditEventInput,
  AppointmentAuditEventType,
} from '../activities/appointment-audit.types.js';
import { registerNewCustomerWorkflow } from './register-new-customer.workflow.js';

const BUSINESS_TIME_ZONE = 'America/Lima';

const appointment = proxyActivities<AppointmentActivities>({
  startToCloseTimeout: '5s',
  retry: { initialInterval: '250ms', backoffCoefficient: 2, maximumAttempts: 3 },
});

const audit = proxyActivities<AppointmentAuditActivities>({
  startToCloseTimeout: '5s',
  retry: { initialInterval: '250ms', backoffCoefficient: 2, maximumAttempts: 3 },
});

export const getAppointmentStateQuery = defineQuery<AppointmentStateProjection>('GetAppointmentState');
export const getAppointmentInitialFingerprintQuery = defineQuery<string>('GetAppointmentInitialFingerprint');
export const provideAppointmentCustomerUpdate = defineUpdate<AppointmentUpdateResult, [ProvideAppointmentCustomerInput]>('ProvideAppointmentCustomer');
export const resolveAppointmentCustomerUpdate = defineUpdate<AppointmentUpdateResult, [ResolveAppointmentCustomerInput]>('ResolveAppointmentCustomer');
export const selectAppointmentServiceUpdate = defineUpdate<AppointmentUpdateResult, [SelectAppointmentServiceInput]>('SelectAppointmentService');
export const selectAppointmentProductUpdate = defineUpdate<AppointmentUpdateResult, [SelectAppointmentProductInput]>('SelectAppointmentProduct');
export const setAppointmentDateUpdate = defineUpdate<AppointmentUpdateResult, [SetAppointmentDateInput]>('SetAppointmentDate');
export const selectAppointmentSlotUpdate = defineUpdate<AppointmentUpdateResult, [SelectAppointmentSlotInput]>('SelectAppointmentSlot');
export const finalizeAppointmentUpdate = defineUpdate<AppointmentUpdateResult, [FinalizeAppointmentInput]>('FinalizeAppointment');

function timestamp(): string {
  return new Date(Date.now()).toISOString();
}

function issue(code: AppointmentIssue['code'], path: string, message: string): AppointmentIssue {
  return { code, path, message };
}

function canonicalStartFingerprint(start: RegisterNewAppointmentStartEnvelope): string {
  return canonicalJson({
    operation: start.operation,
    businessSlug: start.businessSlug,
    schemaVersion: start.schemaVersion,
    draft: start.draft ?? {},
  });
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export async function registerNewAppointmentWorkflow(
  start: RegisterNewAppointmentStartEnvelope,
): Promise<AppointmentResult> {
  const info = workflowInfo();
  const fingerprint = canonicalStartFingerprint(start);

  let workflowStatus: AppointmentStateProjection['workflowStatus'] = 'RUNNING';
  let phase: AppointmentStateProjection['phase'] = 'STARTED';
  let issues: AppointmentIssue[] = [];
  let customerDraft: CustomerDraft = normalizeCustomerDraft(start.draft?.customer?.customer);
  let requestedCustomerId = start.draft?.customer?.customerId;
  let customerId: string | undefined;
  let customerStatus: AppointmentStateProjection['customer']['status'] =
    requestedCustomerId || Object.keys(customerDraft).length > 0 ? 'DRAFT' : 'EMPTY';
  let candidateCustomerIds: readonly string[] | undefined;

  let services: readonly AppointmentService[] = [];
  let selectedService: AppointmentService | undefined;
  let products: readonly AppointmentProduct[] = [];
  let selectedProduct: AppointmentProduct | undefined;
  let appointmentDate = start.draft?.appointmentDate;
  let availableSlots: readonly AppointmentSlot[] = [];
  let selectedSlot: AppointmentSlot | undefined;
  let result: AppointmentResult | undefined;
  let failure: AppointmentStateProjection['failure'];
  let appointmentCommandId: string | undefined;

  const acceptedInputIds = new Set<string>();
  let resolveCustomerRequested = Boolean(start.draft?.customer);
  let finalizeRequested = false;

  const requiredAudit: Array<Readonly<{ eventType: AppointmentAuditEventType; logicalKey: string }>> = [];

  function nextAction(): AppointmentStateProjection['nextAction'] {
    if (workflowStatus !== 'RUNNING') return 'NONE';
    switch (phase) {
      case 'WAITING_FOR_CUSTOMER':
        return requestedCustomerId || Object.keys(customerDraft).length > 0
          ? 'RESOLVE_CUSTOMER'
          : 'PROVIDE_CUSTOMER';
      case 'WAITING_FOR_SERVICE': return 'SELECT_SERVICE';
      case 'WAITING_FOR_PRODUCT': return 'SELECT_PRODUCT';
      case 'WAITING_FOR_DATE': return 'PROVIDE_DATE';
      case 'WAITING_FOR_SLOT': return 'SELECT_SLOT';
      case 'READY_TO_FINALIZE': return 'FINALIZE_APPOINTMENT';
      default: return 'NONE';
    }
  }

  function state(): AppointmentStateProjection {
    return {
      workflowId: info.workflowId,
      workflowStatus,
      phase,
      customer: {
        status: customerStatus,
        ...(customerId ? { customerId } : {}),
        ...(Object.keys(customerDraft).length > 0 ? { customer: customerDraft } : {}),
        ...(candidateCustomerIds ? { candidateCustomerIds } : {}),
      },
      services,
      ...(selectedService ? { selectedService } : {}),
      products,
      ...(selectedProduct ? { selectedProduct } : {}),
      ...(appointmentDate ? { appointmentDate } : {}),
      availableSlots,
      ...(selectedSlot ? { selectedSlot } : {}),
      nextAction: nextAction(),
      issues,
      ...(result ? { result } : {}),
      ...(failure ? { failure } : {}),
    };
  }

  function duplicate(inputId: string): boolean {
    if (acceptedInputIds.has(inputId)) return true;
    acceptedInputIds.add(inputId);
    return false;
  }

  function rejected(newIssues: AppointmentIssue[]): AppointmentUpdateResult {
    issues = newIssues;
    return { ok: false, issues, state: state() };
  }

  function accepted(inputId: string): AppointmentUpdateResult {
    const isDuplicate = duplicate(inputId);
    return { ok: true, duplicateInput: isDuplicate, state: state() };
  }

  setHandler(getAppointmentStateQuery, state);
  setHandler(getAppointmentInitialFingerprintQuery, () => fingerprint);

  setHandler(provideAppointmentCustomerUpdate, (input) => {
    if (!input.inputId?.trim()) return rejected([issue('INVALID_INPUT', 'inputId', 'inputId is required')]);
    if (acceptedInputIds.has(input.inputId)) return { ok: true, duplicateInput: true, state: state() };
    if (customerId || !['WAITING_FOR_CUSTOMER', 'STARTED'].includes(phase)) {
      return rejected([issue('INVALID_INPUT', 'customer', 'customer selection is already closed')]);
    }
    if (!input.customerId && !input.customerPatch) {
      return rejected([issue('INVALID_INPUT', 'customer', 'customerId or customerPatch is required')]);
    }
    if (input.customerId) requestedCustomerId = input.customerId.trim();
    if (input.customerPatch) customerDraft = mergeCustomerDraft(customerDraft, input.customerPatch);
    customerStatus = 'DRAFT';
    issues = [];
    return accepted(input.inputId);
  });

  setHandler(resolveAppointmentCustomerUpdate, (input) => {
    if (!input.inputId?.trim()) return rejected([issue('INVALID_INPUT', 'inputId', 'inputId is required')]);
    if (acceptedInputIds.has(input.inputId)) return { ok: true, duplicateInput: true, state: state() };
    if (customerId || phase !== 'WAITING_FOR_CUSTOMER') {
      return rejected([issue('INVALID_INPUT', 'customer', 'customer cannot be resolved in the current phase')]);
    }
    if (!requestedCustomerId && Object.keys(customerDraft).length === 0) {
      return rejected([issue('CUSTOMER_INCOMPLETE', 'customer', 'provide customer identity before resolving')]);
    }
    resolveCustomerRequested = true;
    issues = [];
    return accepted(input.inputId);
  });

  setHandler(selectAppointmentServiceUpdate, (input) => {
    if (!input.inputId?.trim()) return rejected([issue('INVALID_INPUT', 'inputId', 'inputId is required')]);
    if (acceptedInputIds.has(input.inputId)) return { ok: true, duplicateInput: true, state: state() };
    if (phase !== 'WAITING_FOR_SERVICE') return rejected([issue('INVALID_INPUT', 'serviceId', 'service is not selectable in the current phase')]);
    const match = services.find((item) => item.serviceId === input.serviceId || item.code === input.serviceId);
    if (!match) return rejected([issue('SERVICE_NOT_FOUND', 'serviceId', `service ${input.serviceId} is not in the active catalog`)]);
    selectedService = match;
    issues = [];
    return accepted(input.inputId);
  });

  setHandler(selectAppointmentProductUpdate, (input) => {
    if (!input.inputId?.trim()) return rejected([issue('INVALID_INPUT', 'inputId', 'inputId is required')]);
    if (acceptedInputIds.has(input.inputId)) return { ok: true, duplicateInput: true, state: state() };
    if (phase !== 'WAITING_FOR_PRODUCT') return rejected([issue('INVALID_INPUT', 'productId', 'product is not selectable in the current phase')]);
    const match = products.find((item) => item.productId === input.productId || item.code === input.productId);
    if (!match) return rejected([issue('PRODUCT_NOT_FOUND', 'productId', `product ${input.productId} is not available for the selected service`)]);
    selectedProduct = match;
    issues = [];
    return accepted(input.inputId);
  });

  setHandler(setAppointmentDateUpdate, (input) => {
    if (!input.inputId?.trim()) return rejected([issue('INVALID_INPUT', 'inputId', 'inputId is required')]);
    if (acceptedInputIds.has(input.inputId)) return { ok: true, duplicateInput: true, state: state() };
    if (phase !== 'WAITING_FOR_DATE') return rejected([issue('INVALID_INPUT', 'appointmentDate', 'date is not selectable in the current phase')]);
    if (!validIsoDate(input.appointmentDate)) return rejected([issue('INVALID_DATE', 'appointmentDate', 'Workflow requires canonical YYYY-MM-DD')]);
    appointmentDate = input.appointmentDate;
    issues = [];
    return accepted(input.inputId);
  });

  setHandler(selectAppointmentSlotUpdate, (input) => {
    if (!input.inputId?.trim()) return rejected([issue('INVALID_INPUT', 'inputId', 'inputId is required')]);
    if (acceptedInputIds.has(input.inputId)) return { ok: true, duplicateInput: true, state: state() };
    if (phase !== 'WAITING_FOR_SLOT') return rejected([issue('INVALID_INPUT', 'slotStart', 'slot is not selectable in the current phase')]);
    const match = availableSlots.find((slot) => slot.start === input.slotStart);
    if (!match) return rejected([issue('SLOT_NOT_AVAILABLE', 'slotStart', `slot ${input.slotStart} is not in current availability`)]);
    selectedSlot = match;
    issues = [];
    return accepted(input.inputId);
  });

  setHandler(finalizeAppointmentUpdate, (input) => {
    if (!input.inputId?.trim()) return rejected([issue('INVALID_INPUT', 'inputId', 'inputId is required')]);
    if (acceptedInputIds.has(input.inputId)) return { ok: true, duplicateInput: true, state: state() };
    if (phase !== 'READY_TO_FINALIZE') return rejected([issue('NOT_READY_TO_FINALIZE', 'appointment', 'complete customer, service, product, date and slot first')]);
    finalizeRequested = true;
    issues = [];
    return accepted(input.inputId);
  });

  async function persistAuditEvent(
    eventType: AppointmentAuditEventType,
    logicalKey: string,
    metadata?: Readonly<Record<string, unknown>>,
    appointmentId?: string,
  ): Promise<void> {
    const event: AppointmentAuditEventInput = {
      eventType,
      logicalKey,
      businessSlug: start.businessSlug,
      workflowId: info.workflowId,
      phase,
      occurredAt: timestamp(),
      ...(start.request.correlationId ? { correlationId: start.request.correlationId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(appointmentId ? { appointmentId } : {}),
      ...(metadata ? { metadata } : {}),
    };
    await audit.persistAppointmentAudit({ events: [event] });
    if (!requiredAudit.some((item) => item.eventType === eventType && item.logicalKey === logicalKey)) {
      requiredAudit.push({ eventType, logicalKey });
    }
  }

  const reservation = await appointment.reserveAppointmentCommand({ start, workflowId: info.workflowId });
  appointmentCommandId = reservation.appointmentCommandId;
  if (reservation.kind === 'CONFLICT') {
    failure = { code: 'APPOINTMENT_IDEMPOTENCY_CONFLICT', message: 'same appointment idempotency key has different initial material' };
    phase = 'FAILED';
    workflowStatus = 'FAILED';
    throw ApplicationFailure.nonRetryable(failure.message, failure.code);
  }
  if (reservation.appointmentId) {
    const existing = await appointment.getAppointment({ appointmentId: reservation.appointmentId });
    if (!existing) throw ApplicationFailure.nonRetryable('replayed appointment command has no appointment', 'APPOINTMENT_REPLAY_MISSING');
    result = existing;
    customerId = existing.customerId;
    customerStatus = 'EXISTING';
    phase = 'CREATED';
    workflowStatus = 'COMPLETED';
    return existing;
  }

  await persistAuditEvent('APPOINTMENT_SESSION_STARTED', 'session');

  while (!customerId) {
    phase = 'WAITING_FOR_CUSTOMER';
    await condition(() => resolveCustomerRequested);
    resolveCustomerRequested = false;
    phase = 'RESOLVING_CUSTOMER';
    customerStatus = 'RESOLVING';
    candidateCustomerIds = undefined;

    const resolved = await appointment.resolveAppointmentCustomer({
      businessSlug: start.businessSlug,
      ...(requestedCustomerId ? { customerId: requestedCustomerId } : {}),
      ...(Object.keys(customerDraft).length > 0 ? { customer: customerDraft } : {}),
    });

    if (resolved.kind === 'AMBIGUOUS') {
      customerStatus = 'AMBIGUOUS';
      candidateCustomerIds = resolved.candidateCustomerIds;
      issues = [issue('CUSTOMER_AMBIGUOUS', 'customer', 'multiple existing customers match; provide an explicit customerId')];
      requestedCustomerId = undefined;
      continue;
    }

    if (resolved.kind === 'EXISTING') {
      customerId = resolved.customerId;
      customerStatus = 'EXISTING';
      issues = [];
      break;
    }

    if (requestedCustomerId) {
      customerStatus = 'DRAFT';
      issues = [issue('CUSTOMER_NOT_FOUND', 'customerId', `customer ${requestedCustomerId} was not found in ${start.businessSlug}`)];
      requestedCustomerId = undefined;
      continue;
    }

    const completeness = evaluateRegistrationCompleteness(
      GOLDEN_REGISTRATION_POLICY_V1,
      { customer: customerDraft },
    );
    if (!completeness.complete) {
      customerStatus = 'DRAFT';
      issues = [issue('CUSTOMER_INCOMPLETE', 'customer', `new customer is missing: ${completeness.missingFields.join(', ')}`)];
      continue;
    }

    const childStart: RegisterNewCustomerStartEnvelope = {
      operation: REGISTER_NEW_CUSTOMER_OPERATION,
      businessSlug: start.businessSlug,
      schemaVersion: REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
      draft: { customer: customerDraft },
      request: {
        idempotencyKey: `appointment-child:${info.workflowId}`,
        correlationId: start.request.correlationId ?? info.workflowId,
        channel: 'temporal-child',
        completionMode: 'AUTO_WHEN_COMPLETE',
      },
    };
    const child = await executeChild(registerNewCustomerWorkflow, {
      workflowId: `appointment-customer:${info.workflowId}`,
      args: [childStart],
    });
    customerId = child.customerId;
    customerStatus = child.created ? 'CREATED' : 'EXISTING';
    issues = [];
  }

  phase = 'CUSTOMER_READY';
  await persistAuditEvent('APPOINTMENT_CUSTOMER_RESOLVED', 'customer', { customerStatus });

  phase = 'LOADING_SERVICES';
  services = await appointment.listAppointmentServices({ businessSlug: start.businessSlug });
  if (services.length === 0) {
    failure = { code: 'NO_ACTIVE_SERVICES', message: `no active services for ${start.businessSlug}` };
    phase = 'FAILED';
    workflowStatus = 'FAILED';
    throw ApplicationFailure.nonRetryable(failure.message, failure.code);
  }
  phase = 'WAITING_FOR_SERVICE';
  await condition(() => Boolean(selectedService));
  phase = 'LOADING_PRODUCTS';
  await persistAuditEvent('APPOINTMENT_SERVICE_SELECTED', selectedService!.serviceId, { service: selectedService! });

  products = await appointment.listAppointmentProducts({
    businessSlug: start.businessSlug,
    serviceId: selectedService!.serviceId,
  });
  if (products.length === 0) {
    failure = { code: 'NO_ACTIVE_PRODUCTS', message: `no active products for service ${selectedService!.serviceId}` };
    phase = 'FAILED';
    workflowStatus = 'FAILED';
    throw ApplicationFailure.nonRetryable(failure.message, failure.code);
  }
  phase = 'WAITING_FOR_PRODUCT';
  await condition(() => Boolean(selectedProduct));
  await persistAuditEvent('APPOINTMENT_PRODUCT_SELECTED', selectedProduct!.productId, { product: selectedProduct! });

  while (true) {
    phase = 'WAITING_FOR_DATE';
    await condition(() => Boolean(appointmentDate));
    const businessToday = await appointment.getBusinessToday({ timeZone: BUSINESS_TIME_ZONE });
    if (appointmentDate! < businessToday) {
      issues = [issue('PAST_DATE', 'appointmentDate', `${appointmentDate} is before business-local today ${businessToday}`)];
      appointmentDate = undefined;
      continue;
    }

    phase = 'LOADING_SLOTS';
    availableSlots = await appointment.listAppointmentSlots({
      businessSlug: start.businessSlug,
      productId: selectedProduct!.productId,
      appointmentDate: appointmentDate!,
    });
    if (availableSlots.length === 0) {
      issues = [issue('NO_AVAILABILITY', 'appointmentDate', `no available slots for ${appointmentDate}`)];
      appointmentDate = undefined;
      continue;
    }
    issues = [];
    await persistAuditEvent('APPOINTMENT_DATE_SELECTED', appointmentDate!, { availableSlotCount: availableSlots.length });
    break;
  }

  while (true) {
    selectedSlot = undefined;
    finalizeRequested = false;
    phase = 'WAITING_FOR_SLOT';
    await condition(() => Boolean(selectedSlot));
    await persistAuditEvent('APPOINTMENT_SLOT_SELECTED', `${appointmentDate}:${selectedSlot!.start}`, { slot: selectedSlot! });

    phase = 'READY_TO_FINALIZE';
    await condition(() => finalizeRequested);
    await persistAuditEvent('APPOINTMENT_FINALIZE_REQUESTED', 'finalize');

    phase = 'RESERVING_APPOINTMENT';
    const booked = await appointment.bookAppointment({
      appointmentCommandId: appointmentCommandId!,
      workflowId: info.workflowId,
      businessSlug: start.businessSlug,
      customerId: customerId!,
      serviceId: selectedService!.serviceId,
      productId: selectedProduct!.productId,
      appointmentDate: appointmentDate!,
      slotStart: selectedSlot!.start,
      timezone: BUSINESS_TIME_ZONE,
    });

    if (booked.kind === 'SLOT_CONFLICT') {
      availableSlots = booked.availableSlots;
      issues = [issue('SLOT_NOT_AVAILABLE', 'slotStart', 'selected slot was taken before final persistence; choose another slot')];
      await persistAuditEvent('APPOINTMENT_SLOT_CONFLICT', `${appointmentDate}:${selectedSlot!.start}`, {
        remainingSlots: availableSlots,
      });
      if (availableSlots.length === 0) {
        appointmentDate = undefined;
        break;
      }
      continue;
    }

    result = booked.appointment;
    issues = [];
    phase = 'CREATED';
    await persistAuditEvent('APPOINTMENT_CREATED', result.appointmentId, { result }, result.appointmentId);
    const verified = await audit.verifyAppointmentAudit({ workflowId: info.workflowId, required: requiredAudit });
    if (!verified.complete) {
      throw new Error(`APPOINTMENT_AUDIT_INCOMPLETE:${verified.missing.join(',')}`);
    }
    workflowStatus = 'COMPLETED';
    return result;
  }

  // A slot conflict can exhaust the selected date. Re-enter the date/slot portion
  // without restarting the durable appointment session.
  while (!result) {
    phase = 'WAITING_FOR_DATE';
    await condition(() => Boolean(appointmentDate));
    const businessToday = await appointment.getBusinessToday({ timeZone: BUSINESS_TIME_ZONE });
    if (appointmentDate! < businessToday) {
      issues = [issue('PAST_DATE', 'appointmentDate', `${appointmentDate} is before business-local today ${businessToday}`)];
      appointmentDate = undefined;
      continue;
    }
    phase = 'LOADING_SLOTS';
    availableSlots = await appointment.listAppointmentSlots({
      businessSlug: start.businessSlug,
      productId: selectedProduct!.productId,
      appointmentDate: appointmentDate!,
    });
    if (availableSlots.length === 0) {
      issues = [issue('NO_AVAILABILITY', 'appointmentDate', `no available slots for ${appointmentDate}`)];
      appointmentDate = undefined;
      continue;
    }
    await persistAuditEvent('APPOINTMENT_DATE_SELECTED', appointmentDate!, { availableSlotCount: availableSlots.length });
    selectedSlot = undefined;
    phase = 'WAITING_FOR_SLOT';
    await condition(() => Boolean(selectedSlot));
    await persistAuditEvent('APPOINTMENT_SLOT_SELECTED', `${appointmentDate}:${selectedSlot!.start}`, { slot: selectedSlot! });
    finalizeRequested = false;
    phase = 'READY_TO_FINALIZE';
    await condition(() => finalizeRequested);
    await persistAuditEvent('APPOINTMENT_FINALIZE_REQUESTED', `finalize:${appointmentDate}:${selectedSlot!.start}`);
    phase = 'RESERVING_APPOINTMENT';
    const booked = await appointment.bookAppointment({
      appointmentCommandId: appointmentCommandId!,
      workflowId: info.workflowId,
      businessSlug: start.businessSlug,
      customerId: customerId!,
      serviceId: selectedService!.serviceId,
      productId: selectedProduct!.productId,
      appointmentDate: appointmentDate!,
      slotStart: selectedSlot!.start,
      timezone: BUSINESS_TIME_ZONE,
    });
    if (booked.kind === 'SLOT_CONFLICT') {
      availableSlots = booked.availableSlots;
      issues = [issue('SLOT_NOT_AVAILABLE', 'slotStart', 'selected slot was taken before final persistence; choose another slot')];
      await persistAuditEvent('APPOINTMENT_SLOT_CONFLICT', `${appointmentDate}:${selectedSlot!.start}`, { remainingSlots: availableSlots });
      if (availableSlots.length === 0) appointmentDate = undefined;
      continue;
    }
    result = booked.appointment;
    phase = 'CREATED';
    issues = [];
    await persistAuditEvent('APPOINTMENT_CREATED', result.appointmentId, { result }, result.appointmentId);
    const verified = await audit.verifyAppointmentAudit({ workflowId: info.workflowId, required: requiredAudit });
    if (!verified.complete) throw new Error(`APPOINTMENT_AUDIT_INCOMPLETE:${verified.missing.join(',')}`);
    workflowStatus = 'COMPLETED';
    return result;
  }

  throw ApplicationFailure.nonRetryable('appointment workflow ended without result', 'APPOINTMENT_INTERNAL_STATE');
}
