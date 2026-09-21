import assert from 'node:assert/strict';
import test from 'node:test';
import type { CTAIngressClaim, CTAIngressRecord, CTAIngressRepository, CTAIngressStatus } from './ingress.js';
import { CanonicalCTADispatcher, type CTAOrchestrationPort } from './dispatcher.js';
import type { CanonicalCTAEvent } from './types.js';

const event: CanonicalCTAEvent = {
  version: 'cta.v1', eventId: 'cta-1', provider: 'webchat', channel: 'web',
  businessSlug: 'golden-business', providerEventId: 'message-1', externalUserId: 'user-1',
  externalConversationId: 'conversation-1', action: 'register_appointment', eventType: 'button',
  idempotencyKey: 'cta:key-1', correlationId: 'conversation-1', receivedAt: '2026-09-08T12:00:00.000Z', payload: {},
};

class MemoryIngress implements CTAIngressRepository {
  record?: CTAIngressRecord;
  async claim(input: CanonicalCTAEvent): Promise<CTAIngressClaim> {
    if (this.record) {
      this.record = { ...this.record, duplicateCount: this.record.duplicateCount + 1 };
      return { kind: 'DUPLICATE', record: this.record };
    }
    this.record = {
      eventId: input.eventId, provider: input.provider, channel: input.channel, businessSlug: input.businessSlug,
      providerEventId: input.providerEventId, externalUserId: input.externalUserId,
      externalConversationId: input.externalConversationId, action: input.action, status: 'NORMALIZED',
      correlationId: input.correlationId, duplicateCount: 0,
    };
    return { kind: 'CLAIMED', record: this.record };
  }
  async transition(_eventId: string, status: CTAIngressStatus, patch: Readonly<{
    workflowId?: string; caseId?: string; appointmentId?: string; errorCode?: string;
  }> = {}): Promise<CTAIngressRecord> {
    this.record = { ...this.record!, status, ...patch };
    return this.record;
  }
}

test('G3/G4 duplicate ingress dispatches exactly one workflow and one domain graph', async () => {
  const ingress = new MemoryIngress();
  let starts = 0;
  const orchestration: CTAOrchestrationPort = {
    async startRegisterAppointment() {
      starts += 1;
      return { workflowId: 'workflow-1', caseId: 'case-1', appointmentId: 'appointment-1' };
    },
  };
  const dispatcher = new CanonicalCTADispatcher(ingress, orchestration);
  const first = await dispatcher.dispatch(event);
  const replay = await dispatcher.dispatch({ ...event, receivedAt: '2026-09-08T12:01:00.000Z' });
  assert.equal(starts, 1);
  assert.equal(first.ingress.status, 'COMPLETED');
  assert.equal(replay.duplicate, true);
  assert.equal(replay.ingress.workflowId, 'workflow-1');
  assert.equal(replay.ingress.caseId, 'case-1');
  assert.equal(replay.ingress.appointmentId, 'appointment-1');
});

test('G3 failed orchestration leaves an explicit FAILED ingress', async () => {
  const ingress = new MemoryIngress();
  const dispatcher = new CanonicalCTADispatcher(ingress, {
    async startRegisterAppointment() { throw new Error('fixture failure'); },
  });
  await assert.rejects(() => dispatcher.dispatch(event), /fixture failure/);
  assert.equal(ingress.record?.status, 'FAILED');
  assert.equal(ingress.record?.errorCode, 'CTA_ORCHESTRATION_FAILED');
});
