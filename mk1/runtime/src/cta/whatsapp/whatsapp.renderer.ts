import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import type { AppointmentRenderIntent, CustomerRegistrationRenderIntent } from '../channel-core/types.js';

function interactiveRows(
  body: string,
  items: readonly Readonly<{ id: string; title: string }>[],
): Readonly<Record<string, unknown>> {
  if (items.length < 1 || items.length > 3) {
    throw new Error(`WHATSAPP_RENDER_BUTTON_LIMIT:${items.length}`);
  }
  return { type: 'interactive', body, buttons: items };
}

export function renderWhatsAppRegistration(intent: 'CONSENT' | CustomerRegistrationRenderIntent): Readonly<Record<string, unknown>> {
  if (intent === 'CONSENT') return {
    type: 'interactive', body: 'Hola 👋\n\n¿Nos autorizas a registrar tus datos para atenderte desde nuestro sistema?',
    buttons: [
      { id: 'register_customer_yes', title: 'Sí, registrarme' },
      { id: 'register_customer_no', title: 'Ahora no' },
    ],
  };
  if (intent === 'RESOLVE_CUSTOMER_DUPLICATE') return {
    type: 'interactive',
    body: 'Ya encontramos un cliente con datos coincidentes. ¿Qué deseas hacer?',
    buttons: [
      { id: 'resolve_customer_duplicate_existing', title: 'Usar existente' },
      { id: 'resolve_customer_duplicate_new', title: 'Crear nuevo' },
    ],
  };
  const text: Record<Exclude<CustomerRegistrationRenderIntent, 'RESOLVE_CUSTOMER_DUPLICATE'>, string> = {
    ASK_CUSTOMER_NAME: '¿Cuál es tu nombre?',
    ASK_CUSTOMER_PHONE: '¿Cuál es tu teléfono?',
    ASK_CUSTOMER_EMAIL: '¿Cuál es tu correo?',
    FINALIZE_REGISTRATION: 'Tus datos están completos. Confirma para finalizar.',
    REGISTRATION_COMPLETE: '✅ Registro completado.\n\nYa tenemos tus datos registrados.',
    REGISTRATION_FAILED: 'No pudimos completar el registro. Inténtalo nuevamente.',
    WAIT: 'Un momento, estamos procesando tu registro.',
  };
  return { type: 'text', text: text[intent] };
}

export function whatsappAppointmentRenderIntent(state: AppointmentStateProjection): AppointmentRenderIntent {
  if (state.workflowStatus === 'FAILED' || state.phase === 'FAILED') return 'APPOINTMENT_FAILED';
  if (state.workflowStatus === 'COMPLETED' && state.phase === 'CREATED') return 'APPOINTMENT_COMPLETE';

  switch (state.phase) {
    case 'WAITING_FOR_CUSTOMER': {
      const customer = state.customer.customer;
      if (!customer?.name?.trim()) return 'ASK_CUSTOMER_NAME';
      const hasEmail = Boolean(customer.contact?.email?.trim());
      const hasPhone = Boolean(customer.contact?.phones?.[0]?.number?.trim()
        || customer.contact?.phones?.[0]?.normalized?.trim());
      if (!hasEmail && !hasPhone) return 'ASK_CUSTOMER_EMAIL';
      return state.nextAction === 'RESOLVE_CUSTOMER' ? 'RESOLVE_CUSTOMER' : 'WAIT';
    }
    // ManagedEntity interaction is owned by Temporal now. Native WhatsApp
    // selection/creation remains gated to the provider regression slice.
    case 'WAITING_FOR_MANAGED_ENTITY': return 'WAIT';
    case 'WAITING_FOR_SERVICE': return 'SELECT_SERVICE';
    case 'WAITING_FOR_PRODUCT': return 'SELECT_OFFERING';
    case 'WAITING_FOR_DATE': return 'ASK_DATE';
    case 'WAITING_FOR_SLOT': return 'SELECT_SLOT';
    case 'READY_TO_FINALIZE': return 'FINALIZE_APPOINTMENT';
    // The workflow persists the Appointment and audits it before flipping the
    // durable workflowStatus to COMPLETED. Do not surface a terminal success
    // message during that short CREATED/RUNNING window, otherwise provider
    // runners can return before reconciling CTA ingress and channel binding.
    case 'CREATED': return 'WAIT';
    case 'STARTED':
    case 'RESOLVING_CUSTOMER':
    case 'CUSTOMER_READY':
    case 'LOADING_MANAGED_ENTITIES':
    case 'CREATING_MANAGED_ENTITY':
    case 'MANAGED_ENTITY_READY':
    case 'LOADING_SERVICES':
    case 'LOADING_PRODUCTS':
    case 'LOADING_SLOTS':
    case 'RESERVING_APPOINTMENT':
      return 'WAIT';
  }
}

export function renderWhatsAppAppointment(
  state: AppointmentStateProjection,
  intent: AppointmentRenderIntent = whatsappAppointmentRenderIntent(state),
): Readonly<Record<string, unknown>> {
  switch (intent) {
    case 'ASK_CUSTOMER_NAME':
      return { type: 'text', text: 'Vamos a registrar tu cita. ¿Cuál es tu nombre?' };
    case 'ASK_CUSTOMER_EMAIL':
      return { type: 'text', text: 'No pudimos identificar un cliente único solo con esos datos. ¿Cuál es tu correo?' };
    case 'ASK_CUSTOMER_PHONE':
      return { type: 'text', text: '¿Cuál es tu teléfono?' };
    case 'RESOLVE_CUSTOMER': {
      const candidates = state.customer.status === 'AMBIGUOUS'
        ? state.customer.candidateCustomerIds ?? []
        : [];
      if (candidates.length > 0) {
        return interactiveRows(
          'Encontramos más de un cliente que coincide con tus datos. Necesitamos otro dato de identidad antes de continuar.',
          candidates.slice(0, 3).map((customerId) => ({ id: `appointment_customer:${customerId}`, title: customerId.slice(0, 20) })),
        );
      }
      return { type: 'text', text: 'Un momento, Temporal está verificando tus datos.' };
    }
    case 'SELECT_MANAGED_ENTITY':
      return interactiveRows(
        `Selecciona ${state.managedEntity.policy.label.toLowerCase()}.`,
        state.managedEntity.candidates.slice(0, 3).map((entity) => ({
          id: `appointment_managed_entity:${entity.managedEntityId}`,
          title: entity.displayName.slice(0, 20),
        })),
      );
    case 'CREATE_MANAGED_ENTITY':
      return {
        type: 'text',
        text: `Necesitamos crear ${state.managedEntity.policy.label.toLowerCase()} antes de continuar.`,
      };
    case 'SELECT_SERVICE':
      return interactiveRows(
        'Selecciona el servicio para tu cita.',
        state.services.slice(0, 3).map((service) => ({ id: `appointment_service:${service.serviceId}`, title: service.name.slice(0, 20) })),
      );
    case 'SELECT_OFFERING':
      return interactiveRows(
        'Selecciona la opción que deseas reservar.',
        state.products.slice(0, 3).map((product) => ({ id: `appointment_offering:${product.productId}`, title: product.name.slice(0, 20) })),
      );
    case 'ASK_DATE':
      return { type: 'text', text: '¿Para qué fecha deseas la cita? Puedes escribir, por ejemplo, «viernes» o «2026-09-11».' };
    case 'SELECT_SLOT':
      return interactiveRows(
        'Selecciona un horario disponible.',
        state.availableSlots.slice(0, 3).map((slot) => ({
          id: `appointment_slot:${slot.start}`,
          title: `${slot.start}–${slot.end}`.slice(0, 20),
        })),
      );
    case 'FINALIZE_APPOINTMENT':
      return interactiveRows('Todo está listo. Confirma para crear la cita.', [
        { id: 'appointment_finalize', title: 'Confirmar cita' },
      ]);
    case 'APPOINTMENT_COMPLETE': {
      const appointmentId = state.result?.appointmentId ?? 'created';
      const date = state.result?.appointmentDate ?? state.appointmentDate ?? '';
      const slot = state.result?.slot ?? state.selectedSlot;
      return {
        type: 'text',
        text: `✅ Cita creada.\n\nID: ${appointmentId}${date ? `\nFecha: ${date}` : ''}${slot ? `\nHora: ${slot.start}–${slot.end}` : ''}`,
      };
    }
    case 'APPOINTMENT_FAILED':
      return {
        type: 'text',
        text: `No pudimos completar la cita.${state.failure?.code ? `\n\nCódigo: ${state.failure.code}` : ''}`,
      };
    case 'WAIT':
      return { type: 'text', text: 'Un momento, estamos procesando tu cita.' };
  }
}
