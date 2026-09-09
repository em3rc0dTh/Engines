import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import type { AppointmentRenderIntent, CustomerRegistrationRenderIntent } from '../channel-core/types.js';

export type TelegramRender = Readonly<{ text: string; replyMarkup?: Readonly<Record<string, unknown>> }>;

export function renderTelegramRegistration(intent: 'CONSENT' | CustomerRegistrationRenderIntent): TelegramRender {
  switch (intent) {
    case 'CONSENT': return { text: 'Bienvenido.\n\n¿Deseas registrarte para utilizar nuestros servicios?', replyMarkup: {
      inline_keyboard: [[
        { text: 'Registrarme', callback_data: 'register_customer_yes' },
        { text: 'Ahora no', callback_data: 'register_customer_no' },
      ]],
    } };
    case 'ASK_CUSTOMER_NAME': return { text: '¿Cuál es tu nombre?' };
    case 'ASK_CUSTOMER_EMAIL': return {
      text: '¿Cuál es tu correo?',
      replyMarkup: { remove_keyboard: true },
    };
    case 'ASK_CUSTOMER_PHONE': return {
      text: 'Necesito tu teléfono.\n\nSi tu app muestra «Compartir teléfono», puedes usarlo. Si no, escribe tu número.',
      replyMarkup: {
        keyboard: [[{ text: 'Compartir teléfono', request_contact: true }]],
        is_persistent: true,
        resize_keyboard: true,
        input_field_placeholder: 'Comparte tu teléfono o escríbelo',
      },
    };
    case 'RESOLVE_CUSTOMER_DUPLICATE': return {
      text: 'Ya encontramos un cliente con datos coincidentes. ¿Qué deseas hacer?',
      replyMarkup: {
        inline_keyboard: [[
          { text: 'Usar registro existente', callback_data: 'resolve_customer_duplicate_existing' },
          { text: 'Crear registro nuevo', callback_data: 'resolve_customer_duplicate_new' },
        ]],
      },
    };
    case 'REGISTRATION_COMPLETE': return {
      text: '✅ Registro completado.\n\nYa tenemos tus datos registrados.',
      replyMarkup: { remove_keyboard: true },
    };
    case 'REGISTRATION_FAILED': return {
      text: 'No pudimos completar el registro. Inténtalo nuevamente.',
      replyMarkup: { remove_keyboard: true },
    };
    case 'FINALIZE_REGISTRATION': return { text: 'Tus datos están completos. Confirma para finalizar.' };
    case 'WAIT': return { text: 'Un momento, estamos procesando tu registro.' };
  }
}

export function telegramAppointmentRenderIntent(state: AppointmentStateProjection): AppointmentRenderIntent {
  if (state.workflowStatus === 'FAILED' || state.phase === 'FAILED') return 'APPOINTMENT_FAILED';
  if (state.workflowStatus === 'COMPLETED' && state.phase === 'CREATED') return 'APPOINTMENT_COMPLETE';

  switch (state.phase) {
    case 'WAITING_FOR_CUSTOMER': {
      const customer = state.customer.customer;
      if (!customer?.name?.trim()) return 'ASK_CUSTOMER_NAME';
      if (!customer.contact?.email?.trim()) return 'ASK_CUSTOMER_EMAIL';
      if (!customer.contact?.phones?.[0]?.number?.trim()) return 'ASK_CUSTOMER_PHONE';
      return state.nextAction === 'RESOLVE_CUSTOMER' ? 'RESOLVE_CUSTOMER' : 'WAIT';
    }
    // Telegram provider interaction for ME1 is intentionally gated until the
    // provider regression slice. Temporal owns the new phase now; Telegram
    // must not invent selection/creation semantics independently.
    case 'WAITING_FOR_MANAGED_ENTITY': return 'WAIT';
    case 'WAITING_FOR_SERVICE': return 'SELECT_SERVICE';
    case 'WAITING_FOR_PRODUCT': return 'SELECT_OFFERING';
    case 'WAITING_FOR_DATE': return 'ASK_DATE';
    case 'WAITING_FOR_SLOT': return 'SELECT_SLOT';
    case 'READY_TO_FINALIZE': return 'FINALIZE_APPOINTMENT';
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

function inlineRows(items: readonly Readonly<{ text: string; callback_data: string }>[]): Readonly<Record<string, unknown>> {
  return { inline_keyboard: items.map((item) => [item]) };
}

export function renderTelegramAppointment(
  state: AppointmentStateProjection,
  intent: AppointmentRenderIntent = telegramAppointmentRenderIntent(state),
): TelegramRender {
  switch (intent) {
    case 'ASK_CUSTOMER_NAME': return {
      text: 'Vamos a registrar tu cita. ¿Cuál es tu nombre?',
      replyMarkup: { remove_keyboard: true },
    };
    case 'ASK_CUSTOMER_EMAIL': return {
      text: '¿Cuál es tu correo?',
      replyMarkup: { remove_keyboard: true },
    };
    case 'ASK_CUSTOMER_PHONE': return {
      text: '¿Cuál es tu teléfono? Puedes compartirlo con el botón o escribirlo.',
      replyMarkup: {
        keyboard: [[{ text: 'Compartir teléfono', request_contact: true }]],
        is_persistent: true,
        resize_keyboard: true,
        input_field_placeholder: 'Comparte tu teléfono o escríbelo',
      },
    };
    case 'RESOLVE_CUSTOMER': {
      const candidates = state.customer.status === 'AMBIGUOUS'
        ? state.customer.candidateCustomerIds ?? []
        : [];
      if (candidates.length > 0) {
        return {
          text: 'Encontramos más de un cliente que coincide con tus datos. Selecciona el registro que deseas usar.',
          replyMarkup: inlineRows(candidates.map((customerId) => ({
            text: `Usar ${customerId}`,
            callback_data: `appointment_customer:${customerId}`,
          }))),
        };
      }
      return {
        text: 'Tus datos están completos. Un momento...',
        replyMarkup: { remove_keyboard: true },
      };
    }
    case 'SELECT_MANAGED_ENTITY': return {
      text: `Selecciona ${state.managedEntity.policy.label.toLowerCase()}.`,
      replyMarkup: inlineRows(state.managedEntity.candidates.map((entity) => ({
        text: entity.displayName,
        callback_data: `appointment_managed_entity:${entity.managedEntityId}`,
      }))),
    };
    case 'CREATE_MANAGED_ENTITY': return {
      text: `Necesitamos crear ${state.managedEntity.policy.label.toLowerCase()} antes de continuar.`,
      replyMarkup: { remove_keyboard: true },
    };
    case 'SELECT_SERVICE': return {
      text: 'Selecciona el servicio para tu cita.',
      replyMarkup: inlineRows(state.services.map((service) => ({
        text: service.name,
        callback_data: `appointment_service:${service.serviceId}`,
      }))),
    };
    case 'SELECT_OFFERING': return {
      text: 'Selecciona la opción que deseas reservar.',
      replyMarkup: inlineRows(state.products.map((product) => ({
        text: product.name,
        callback_data: `appointment_offering:${product.productId}`,
      }))),
    };
    case 'ASK_DATE': return {
      text: '¿Para qué fecha deseas la cita? Puedes escribir, por ejemplo, «viernes» o «2026-09-11».',
      replyMarkup: { remove_keyboard: true },
    };
    case 'SELECT_SLOT': return {
      text: 'Selecciona un horario disponible.',
      replyMarkup: inlineRows(state.availableSlots.map((slot) => ({
        text: `${slot.start}–${slot.end}`,
        callback_data: `appointment_slot:${slot.start}`,
      }))),
    };
    case 'FINALIZE_APPOINTMENT': return {
      text: 'Todo está listo. Confirma para crear la cita.',
      replyMarkup: inlineRows([{ text: 'Confirmar cita', callback_data: 'appointment_finalize' }]),
    };
    case 'APPOINTMENT_COMPLETE': {
      const appointmentId = state.result?.appointmentId ?? 'created';
      const date = state.result?.appointmentDate ?? state.appointmentDate ?? '';
      const slot = state.result?.slot ?? state.selectedSlot;
      return {
        text: `✅ Cita creada.\n\nID: ${appointmentId}${date ? `\nFecha: ${date}` : ''}${slot ? `\nHora: ${slot.start}–${slot.end}` : ''}`,
        replyMarkup: { remove_keyboard: true },
      };
    }
    case 'APPOINTMENT_FAILED': return {
      text: `No pudimos completar la cita.${state.failure?.code ? `\n\nCódigo: ${state.failure.code}` : ''}`,
      replyMarkup: { remove_keyboard: true },
    };
    case 'WAIT': return {
      text: 'Un momento, estamos procesando tu cita.',
      replyMarkup: { remove_keyboard: true },
    };
  }
}
