import {
  closeMongoRegistrationAuditRepository,
  persistRegistrationAuditEvents,
  verifyRegistrationAuditEvents,
} from '../../../persistence/mongo/registration-audit.repository.js';
import type {
  MongoRegistrationAuditActivities,
  RegistrationAuditEventInput,
} from './mongo-registration-audit.types.js';

function forcedFailureEventType(): RegistrationAuditEventInput['eventType'] | undefined {
  const value = process.env.B6_FORCE_MONGO_AUDIT_FAILURE_EVENT_TYPE?.trim();
  if (!value) return undefined;
  return value as RegistrationAuditEventInput['eventType'];
}

function assertAuditStoreAvailable(events?: readonly RegistrationAuditEventInput[]): void {
  if (process.env.B6_FORCE_MONGO_AUDIT_FAILURE === '1') {
    throw new Error('MONGO_AUDIT_STORE_UNAVAILABLE:forced-b6-certification-failure');
  }

  const eventType = forcedFailureEventType();
  if (eventType && events?.some((event) => event.eventType === eventType)) {
    throw new Error(`MONGO_AUDIT_STORE_UNAVAILABLE:forced-event:${eventType}`);
  }
}

export const mongoRegistrationAuditActivities: MongoRegistrationAuditActivities = {
  async persistRegistrationAudit(input) {
    assertAuditStoreAvailable(input.events);
    return persistRegistrationAuditEvents(input.events);
  },

  async verifyRegistrationAudit(input) {
    assertAuditStoreAvailable();
    return verifyRegistrationAuditEvents(input.workflowId, input.requiredLogicalEvents);
  },
};

export async function closeMongoRegistrationAuditActivities(): Promise<void> {
  await closeMongoRegistrationAuditRepository();
}
