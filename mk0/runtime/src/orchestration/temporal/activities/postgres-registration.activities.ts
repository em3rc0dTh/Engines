import {
  checkDuplicate,
  closePostgresRepository,
  createCustomer,
  recordExistingCustomer,
  recordSoftDuplicate,
  reserveRegistration,
} from '../../../persistence/postgres/registration.repository.js';
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
};

export async function closePostgresRegistrationActivities(): Promise<void> {
  await closePostgresRepository();
}
