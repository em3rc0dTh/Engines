import type { CTAIngressRecord, CTAIngressRepository } from './ingress.js';
import { routeCanonicalCTA } from './router.js';
import type { CanonicalCTAEvent } from './types.js';

export type CTAWorkflowReceipt = Readonly<{
  workflowId: string;
  caseId?: string;
  appointmentId?: string;
}>;

export interface CTAOrchestrationPort {
  startRegisterAppointment(event: CanonicalCTAEvent): Promise<CTAWorkflowReceipt>;
}

export type CTADispatchResult = Readonly<{ duplicate: boolean; ingress: CTAIngressRecord }>;

export class CanonicalCTADispatcher {
  constructor(private readonly repository: CTAIngressRepository, private readonly orchestration: CTAOrchestrationPort) {}

  async dispatch(event: CanonicalCTAEvent): Promise<CTADispatchResult> {
    const claim = await this.repository.claim(event);
    if (claim.kind === 'DUPLICATE') return { duplicate: true, ingress: claim.record };

    const route = routeCanonicalCTA(event);
    if (route.kind === 'UNSUPPORTED') {
      return { duplicate: false, ingress: await this.repository.transition(event.eventId, 'REJECTED', { errorCode: route.reason }) };
    }

    await this.repository.transition(event.eventId, 'DISPATCHED');
    try {
      await this.repository.transition(event.eventId, 'PROCESSING');
      const receipt = await this.orchestration.startRegisterAppointment(event);
      const completed = Boolean(receipt.caseId && receipt.appointmentId);
      return {
        duplicate: false,
        ingress: await this.repository.transition(event.eventId, completed ? 'COMPLETED' : 'PROCESSING', receipt),
      };
    } catch (error) {
      await this.repository.transition(event.eventId, 'FAILED', {
        errorCode: 'CTA_ORCHESTRATION_FAILED',
      });
      throw error;
    }
  }
}
