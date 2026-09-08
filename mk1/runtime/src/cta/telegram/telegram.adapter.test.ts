import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import { TelegramAdapter } from './telegram.adapter.js';
import {
  renderTelegramAppointment,
  renderTelegramRegistration,
  telegramAppointmentRenderIntent,
} from './telegram.renderer.js';

const adapter = new TelegramAdapter();
const callback = (data: string, update_id = 41) => ({
  update_id,
  callback_query: { data, from: { id: 7 }, message: { chat: { id: 9 } } },
});
const message = (text: string, update_id = 51) => ({
  update_id,
  message: { text, chat: { id: 9 }, from: { id: 7 } },
});

function appointmentState(patch: Partial<AppointmentStateProjection> = {}): AppointmentStateProjection {
  return {
    workflowId: 'register-appointment:golden-business:test',
    workflowStatus: 'RUNNING',
    phase: 'WAITING_FOR_CUSTOMER',
    customer: { status: 'DRAFT', customer: {} },
    services: [],
    products: [],
    availableSlots: [],
    nextAction: 'PROVIDE_CUSTOMER',
    issues: [],
    ...patch,
  } as AppointmentStateProjection;
}

test('TG-RNC-002 affirmative callback starts consented registration with canonical identities', () => {
  assert.deepEqual(adapter.normalizeInbound(callback('register_customer_yes'), { businessSlug: 'golden-business' }), {
    version: 'v1', channel: 'TELEGRAM', businessSlug: 'golden-business',
    externalConversationId: 'telegram:9', externalMessageId: 'telegram:update:41', externalSenderId: 'telegram:user:7',
    action: 'START_CUSTOMER_REGISTRATION', payload: { consentAccepted: true },
  });
});

test('CH-RNC-002 negative consent creates no canonical Workflow operation', () => {
  assert.equal(adapter.normalizeInbound(callback('register_customer_no'), { businessSlug: 'golden-business' }), undefined);
});

test('TG-RNC-001 text maps only through the core-provided render intent', () => {
  const raw = { update_id: 42, message: { text: 'Eduardo', chat: { id: 9 }, from: { id: 7 } } };
  assert.deepEqual(adapter.normalizeInbound(raw, {
    businessSlug: 'golden-business', registrationRenderIntent: 'ASK_CUSTOMER_NAME',
  })?.payload, { customerPatch: { name: 'Eduardo' } });
  assert.throws(() => adapter.normalizeInbound(raw, { businessSlug: 'golden-business' }), /TELEGRAM_CONTEXT_REQUIRED/);
});

test('TG-RNC-003 shared contact supplies a phone patch without owning completeness', () => {
  const raw = { update_id: 43, message: { contact: { phone_number: '+51999111222', user_id: 7 }, chat: { id: 9 }, from: { id: 7 } } };
  assert.deepEqual(adapter.normalizeInbound(raw, { businessSlug: 'golden-business' })?.payload,
    { customerPatch: { contact: { phones: [{ number: '+51999111222' }] } } });
});

test('C2P shared contact with a different Telegram user id is rejected', () => {
  const raw = { update_id: 44, message: { contact: { phone_number: '+51999111222', user_id: 99 }, chat: { id: 9 }, from: { id: 7 } } };
  assert.throws(
    () => adapter.normalizeInbound(raw, { businessSlug: 'golden-business' }),
    /TELEGRAM_CONTACT_SENDER_MISMATCH/,
  );
});

test('B2 Telegram duplicate callback maps only with duplicate render context', () => {
  const envelope = adapter.normalizeInbound(callback('resolve_customer_duplicate_existing', 45), {
    businessSlug: 'golden-business', registrationRenderIntent: 'RESOLVE_CUSTOMER_DUPLICATE',
  });
  assert.equal(envelope?.action, 'RESOLVE_CUSTOMER_DUPLICATE');
  assert.deepEqual(envelope?.payload, { decision: 'USE_EXISTING' });
  assert.throws(() => adapter.normalizeInbound(callback('resolve_customer_duplicate_new', 46), {
    businessSlug: 'golden-business',
  }), /TELEGRAM_CONTEXT_REQUIRED/);
});

test('Telegram renderer exposes consent, persistent shared-contact and duplicate-decision affordances', () => {
  assert.ok(renderTelegramRegistration('CONSENT').replyMarkup);

  const phone = renderTelegramRegistration('ASK_CUSTOMER_PHONE');
  assert.match(phone.text, /Compartir teléfono/);
  assert.deepEqual(phone.replyMarkup, {
    keyboard: [[{ text: 'Compartir teléfono', request_contact: true }]],
    is_persistent: true,
    resize_keyboard: true,
    input_field_placeholder: 'Comparte tu teléfono o escríbelo',
  });

  assert.ok(renderTelegramRegistration('RESOLVE_CUSTOMER_DUPLICATE').replyMarkup);
  assert.deepEqual(renderTelegramRegistration('ASK_CUSTOMER_EMAIL').replyMarkup, { remove_keyboard: true });
});

test('TG-APPT-001 /appointment and /cita normalize to the canonical appointment CTA', () => {
  for (const text of ['/appointment', '/cita', '/appointment@engines_bot']) {
    const envelope = adapter.normalizeInbound(message(text), { businessSlug: 'golden-business' });
    assert.equal(envelope?.action, 'START_APPOINTMENT');
    assert.deepEqual(envelope?.payload, {});
    assert.equal(envelope?.externalConversationId, 'telegram:9');
  }
  assert.equal(adapter.normalizeInbound(callback('register_appointment', 52), {
    businessSlug: 'golden-business',
  })?.action, 'START_APPOINTMENT');
});

test('TG-APPT-002 appointment customer data is accepted only in durable appointment context', () => {
  const name = adapter.normalizeInbound(message('Pepito', 53), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'ASK_CUSTOMER_NAME',
  });
  assert.equal(name?.action, 'PROVIDE_CUSTOMER');
  assert.deepEqual(name?.payload, { customerPatch: { name: 'Pepito' } });

  const phone = adapter.normalizeInbound({
    update_id: 54,
    message: { contact: { phone_number: '+51933075200', user_id: 7 }, chat: { id: 9 }, from: { id: 7 } },
  }, {
    businessSlug: 'golden-business', appointmentRenderIntent: 'ASK_CUSTOMER_PHONE',
  });
  assert.equal(phone?.action, 'PROVIDE_CUSTOMER');
  assert.deepEqual(phone?.payload, { customerPatch: { contact: { phones: [{ number: '+51933075200' }] } } });
});

test('TG-APPT-003 appointment buttons normalize to the same canonical orchestration actions', () => {
  assert.equal(adapter.normalizeInbound(callback('appointment_resolve_customer', 55), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'RESOLVE_CUSTOMER',
  })?.action, 'RESOLVE_CUSTOMER');

  assert.deepEqual(adapter.normalizeInbound(callback('appointment_service:svc_car_wash', 56), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'SELECT_SERVICE',
  })?.payload, { serviceId: 'svc_car_wash' });

  assert.deepEqual(adapter.normalizeInbound(callback('appointment_offering:prd_car_wash_salon', 57), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'SELECT_OFFERING',
  })?.payload, { productId: 'prd_car_wash_salon' });

  assert.deepEqual(adapter.normalizeInbound(message('viernes', 58), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'ASK_DATE',
  }), {
    version: 'v1', channel: 'TELEGRAM', businessSlug: 'golden-business',
    externalConversationId: 'telegram:9', externalMessageId: 'telegram:update:58', externalSenderId: 'telegram:user:7',
    action: 'SET_DATE', payload: { dateInput: 'viernes' },
  });

  assert.deepEqual(adapter.normalizeInbound(callback('appointment_slot:06:00', 59), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'SELECT_SLOT',
  })?.payload, { slotStart: '06:00' });

  assert.equal(adapter.normalizeInbound(callback('appointment_finalize', 60), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'FINALIZE_APPOINTMENT',
  })?.action, 'FINALIZE_APPOINTMENT');

  assert.throws(() => adapter.normalizeInbound(callback('appointment_finalize', 61), {
    businessSlug: 'golden-business', appointmentRenderIntent: 'SELECT_SLOT',
  }), /TELEGRAM_CONTEXT_REQUIRED/);
});

test('TG-APPT-004 renderer follows the durable Appointment projection through selection and completion', () => {
  const serviceState = appointmentState({
    phase: 'WAITING_FOR_SERVICE',
    customer: { status: 'CREATED', customerId: 'cus_1', customer: { name: 'Pepito' } },
    services: [{ serviceId: 'svc_car_wash', code: 'car-wash', name: 'Car Wash' }],
    nextAction: 'SELECT_SERVICE',
  });
  assert.equal(telegramAppointmentRenderIntent(serviceState), 'SELECT_SERVICE');
  assert.match(JSON.stringify(renderTelegramAppointment(serviceState).replyMarkup), /appointment_service:svc_car_wash/);

  const slotState = appointmentState({
    phase: 'WAITING_FOR_SLOT',
    availableSlots: [{ start: '06:00', end: '06:30', durationMinutes: 30 }],
    nextAction: 'SELECT_SLOT',
  });
  assert.match(JSON.stringify(renderTelegramAppointment(slotState).replyMarkup), /appointment_slot:06:00/);

  const completed = appointmentState({
    workflowStatus: 'COMPLETED',
    phase: 'CREATED',
    nextAction: 'NONE',
    result: {
      appointmentId: 'apt_1', customerId: 'cus_1', serviceId: 'svc_car_wash', productId: 'prd_car_wash_salon',
      appointmentDate: '2026-09-11', slot: { start: '06:00', end: '06:30', durationMinutes: 30 },
    },
  });
  assert.equal(telegramAppointmentRenderIntent(completed), 'APPOINTMENT_COMPLETE');
  assert.match(renderTelegramAppointment(completed).text, /apt_1/);
});
