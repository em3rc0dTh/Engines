import type { RegistrationStateProjection } from '../../contracts/register-new-customer/index.js';
import type { CustomerRegistrationRenderIntent } from './types.js';

const INTENT_BY_FIELD: Readonly<Record<string, CustomerRegistrationRenderIntent>> = {
  'customer.name': 'ASK_CUSTOMER_NAME',
  'customer.contact.phone': 'ASK_CUSTOMER_PHONE',
  'customer.contact.email': 'ASK_CUSTOMER_EMAIL',
  'customer.contact.phoneOrEmail': 'ASK_CUSTOMER_PHONE',
};

export function projectCustomerRegistration(state: RegistrationStateProjection): Readonly<{
  knownFields: readonly string[];
  missingFields: readonly string[];
  nextAction: RegistrationStateProjection['nextAction'];
  renderIntent: CustomerRegistrationRenderIntent;
}> {
  const renderIntent: CustomerRegistrationRenderIntent = state.workflowStatus === 'FAILED'
    ? 'REGISTRATION_FAILED'
    : state.phase === 'CREATED' || state.created
      ? 'REGISTRATION_COMPLETE'
      : state.nextAction === 'FINALIZE_REGISTRATION'
        ? 'FINALIZE_REGISTRATION'
        : INTENT_BY_FIELD[state.missingFields[0] ?? ''] ?? 'WAIT';
  return {
    knownFields: state.knownFields,
    missingFields: state.missingFields,
    nextAction: state.nextAction,
    renderIntent,
  };
}
