import {
  checkDuplicate,
  closePostgresRepository,
  createCustomer,
  recordExistingCustomer,
  recordSoftDuplicate,
  reserveRegistration,
} from '../../../persistence/postgres/registration.repository.js';
import {
  closePostgresFinalizationRepository,
  completeRegistration,
  markRegistrationAudited,
} from '../../../persistence/postgres/registration-finalization.repository.js';
import type { PostgresRegistrationActivities } from './postgres-registration.types.js';

export const postgresRegistrationActivities: PostgresRegistrationActivities = {
  reserveRegistrationSession: (input) => reserveRegistration(input.start, input.workflowId),
  checkCustomerDuplicate: (input) =>
    checkDuplicate(input.businessSlug, input.customer, input.duplicatePolicy),
  recordExistingCustomer: (input) => recordExistingCustomer(input.registrationId, input.customerId),
  recordSoftDuplicate: (input) => recordSoftDuplicate(input.registrationId),
  createCustomer: (input) =>
    createCustomer(
      input.registrationId,
      input.businessSlug,
      input.customer,
      input.enforceHardUniqueDocument,
    ),
  markRegistrationAudited: (input) =>
    markRegistrationAudited(input.registrationId, input.customerId, input.outcome),
  completeRegistration: (input) =>
    completeRegistration(input.registrationId, input.customerId, input.outcome),
};

export async function closePostgresRegistrationActivities(): Promise<void> {
  await Promise.all([closePostgresRepository(), closePostgresFinalizationRepository()]);
}
