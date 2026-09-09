import type { CanonicalCTAEvent, CTARoute } from './types.js';

export function routeCanonicalCTA(event: CanonicalCTAEvent): CTARoute {
  if (event.action === 'register_appointment') {
    return { kind: 'WORKFLOW', workflowType: 'RegisterNewAppointment', event };
  }
  return { kind: 'UNSUPPORTED', reason: `UNSUPPORTED_CTA_ACTION:${String(event.action)}` };
}
