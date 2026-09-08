import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import { WhatsAppAdapter } from './whatsapp.adapter.js';
import { renderWhatsAppAppointment, renderWhatsAppRegistration } from './whatsapp.renderer.js';
import { MetaCloudApiTransport, type VerifiedWhatsAppInbound } from './whatsapp.transport.js';

const body = JSON.stringify({
  conversationId: 'conv-1', messageId: 'wamid-1', senderId: '51999111222', senderPhone: '+51999111222',
  kind: 'INTERACTIVE', interactiveId: 'register_customer_yes',
});
const secret = 'test-secret';
const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
const transport = new MetaCloudApiTransport(secret, async () => {});
const adapter = new WhatsAppAdapter();

function asTextEvent(base: VerifiedWhatsAppInbound, text: string): VerifiedWhatsAppInbound {
  return {
    verified: true,
    provider: base.provider,
    conversationId: base.conversationId,
    messageId: base.messageId,
    senderId: base.senderId,
    ...(base.senderPhone ? { senderPhone: base.senderPhone } : {}),
    kind: 'TEXT',
    text,
  };
}

test('WA-RNC-005 rejects an unauthenticated webhook before the adapter', () => {
  assert.throws(() => transport.verifyAndNormalize(body, { 'x-hub-signature-256': 'sha256=00' }), /UNAUTHENTICATED/);
});

test('WA-RNC-001 verified inbound crosses the transport port', () => {
  assert.equal(transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature }).verified, true);
});

test('WA-RNC-002 consent start prefills verified sender phone', () => {
  const event = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const envelope = adapter.normalizeInbound(event, { businessSlug: 'golden-business' });
  assert.equal(envelope?.action, 'START_CUSTOMER_REGISTRATION');
  assert.deepEqual(envelope?.payload, { consentAccepted: true, draft: { customer: { contact: {
    phones: [{ number: '+51999111222', isWhatsapp: true, primary: true }],
  } } } });
});

test('WA-RNC-003 text needs a core-derived intent and maps to one patch', () => {
  const base = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const event = asTextEvent(base, 'eduardo@example.com');
  assert.deepEqual(adapter.normalizeInbound(event, {
    businessSlug: 'golden-business', registrationRenderIntent: 'ASK_CUSTOMER_EMAIL',
  })?.payload, { customerPatch: { contact: { email: 'eduardo@example.com' } } });
});

test('WA-RNC-004 negative interactive consent produces no Workflow operation', () => {
  const event = { ...transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature }), interactiveId: 'register_customer_no' };
  assert.equal(adapter.normalizeInbound(event, { businessSlug: 'golden-business' }), undefined);
});

test('B2 WhatsApp duplicate interactive reply maps only with duplicate render context', () => {
  const base = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const event = { ...base, interactiveId: 'resolve_customer_duplicate_existing' };
  const envelope = adapter.normalizeInbound(event, {
    businessSlug: 'golden-business', registrationRenderIntent: 'RESOLVE_CUSTOMER_DUPLICATE',
  });
  assert.equal(envelope?.action, 'RESOLVE_CUSTOMER_DUPLICATE');
  assert.deepEqual(envelope?.payload, { decision: 'USE_EXISTING' });
  assert.throws(() => adapter.normalizeInbound(event, { businessSlug: 'golden-business' }), /WHATSAPP_CONTEXT_REQUIRED/);
});

test('WhatsApp renderer exposes duplicate-decision interactives', () => {
  const rendered = renderWhatsAppRegistration('RESOLVE_CUSTOMER_DUPLICATE');
  assert.equal(rendered.type, 'interactive');
  assert.ok(Array.isArray(rendered.buttons));
});

test('WA-APPT-001 appointment text command enters canonical appointment path with verified phone provenance', () => {
  const base = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const event = asTextEvent(base, '/appointment');
  const envelope = adapter.normalizeInbound(event, { businessSlug: 'golden-business' });
  assert.equal(envelope?.action, 'START_APPOINTMENT');
  assert.deepEqual(envelope?.payload, {
    draft: { customer: { customer: { contact: { phones: [{
      number: '+51999111222', isWhatsapp: true, primary: true,
    }] } } } },
  });
});

test('WA-APPT-002 appointment customer text maps only in durable appointment context', () => {
  const base = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const event = asTextEvent(base, 'Eduardo');
  const envelope = adapter.normalizeInbound(event, {
    businessSlug: 'golden-business', appointmentRenderIntent: 'ASK_CUSTOMER_NAME',
  });
  assert.equal(envelope?.action, 'PROVIDE_CUSTOMER');
  assert.deepEqual(envelope?.payload, { customerPatch: { name: 'Eduardo' } });
});

test('WA-APPT-003 interactive selections stay on canonical appointment actions', () => {
  const base = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const service = adapter.normalizeInbound({ ...base, interactiveId: 'appointment_service:svc_car_wash' }, {
    businessSlug: 'golden-business', appointmentRenderIntent: 'SELECT_SERVICE',
  });
  assert.equal(service?.action, 'SELECT_SERVICE');
  assert.deepEqual(service?.payload, { serviceId: 'svc_car_wash' });

  const finalize = adapter.normalizeInbound({ ...base, interactiveId: 'appointment_finalize' }, {
    businessSlug: 'golden-business', appointmentRenderIntent: 'FINALIZE_APPOINTMENT',
  });
  assert.equal(finalize?.action, 'FINALIZE_APPOINTMENT');
});

test('WA-APPT-004 appointment renderer exposes service and completion states', () => {
  const serviceState = {
    workflowId: 'wf-1', workflowStatus: 'RUNNING', phase: 'WAITING_FOR_SERVICE',
    customer: { status: 'EXISTING', customerId: 'cus-1' },
    services: [{ serviceId: 'svc_car_wash', code: 'car-wash', name: 'Car Wash' }],
    products: [], availableSlots: [], nextAction: 'SELECT_SERVICE', issues: [],
  } as AppointmentStateProjection;
  const service = renderWhatsAppAppointment(serviceState);
  assert.equal(service.type, 'interactive');
  assert.ok(Array.isArray(service.buttons));

  const completed = {
    ...serviceState,
    workflowStatus: 'COMPLETED',
    phase: 'CREATED',
    nextAction: 'NONE',
    result: {
      appointmentId: 'apt-1', caseId: 'case-1', customerId: 'cus-1', managedEntityId: 'men-1',
      resourceReservationId: 'rr-1', appointmentDate: '2026-09-12', slot: { start: '06:00', end: '06:30' },
    },
  } as AppointmentStateProjection;
  assert.match(String(renderWhatsAppAppointment(completed).text), /apt-1/);
});
