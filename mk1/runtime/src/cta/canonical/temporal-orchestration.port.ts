import { adaptRegisterNewAppointmentCtaInput } from '../register-new-appointment.adapter.js';
import type { TemporalRegisterNewAppointmentPort } from '../../orchestration/temporal/ports/register-new-appointment.temporal-port.js';
import type { CTAOrchestrationPort, CTAWorkflowReceipt } from './dispatcher.js';
import type { CanonicalCTAEvent } from './types.js';

export class TemporalCTAOrchestrationPort implements CTAOrchestrationPort {
  constructor(private readonly appointment: TemporalRegisterNewAppointmentPort) {}

  async startRegisterAppointment(event: CanonicalCTAEvent): Promise<CTAWorkflowReceipt> {
    const draft = event.payload.draft;
    const adapted = adaptRegisterNewAppointmentCtaInput({
      businessSlug: event.businessSlug,
      idempotencyKey: event.idempotencyKey,
      correlationId: event.correlationId,
      ...(draft && typeof draft === 'object' && !Array.isArray(draft) ? { draft } : {}),
    }, { channel: event.channel });
    if (!adapted.ok) throw new Error(`CTA_EVENT_INVALID:${adapted.issues[0]?.message ?? 'draft'}`);
    return this.appointment.start(adapted.value);
  }
}
