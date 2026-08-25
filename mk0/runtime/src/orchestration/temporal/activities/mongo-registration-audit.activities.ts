import {
  closeMongoRegistrationAuditRepository,
  persistRegistrationAuditEvents,
  verifyRegistrationAuditEvents,
} from '../../../persistence/mongo/registration-audit.repository.js';
import type { MongoRegistrationAuditActivities } from './mongo-registration-audit.types.js';

function assertAuditStoreAvailable(): void {
  if (process.env.B6_FORCE_MONGO_AUDIT_FAILURE === '1') {
    throw new Error('MONGO_AUDIT_STORE_UNAVAILABLE:forced-b6-certification-failure');
  }
}

export const mongoRegistrationAuditActivities: MongoRegistrationAuditActivities = {
  async persistRegistrationAudit(input) {
    assertAuditStoreAvailable();
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
