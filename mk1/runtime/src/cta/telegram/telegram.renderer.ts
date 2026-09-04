import type { CustomerRegistrationRenderIntent } from '../channel-core/types.js';

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
    case 'ASK_CUSTOMER_EMAIL': return { text: '¿Cuál es tu correo?' };
    case 'ASK_CUSTOMER_PHONE': return { text: 'Necesito tu teléfono.', replyMarkup: {
      keyboard: [[{ text: 'Compartir teléfono', request_contact: true }]], one_time_keyboard: true, resize_keyboard: true,
    } };
    case 'REGISTRATION_COMPLETE': return { text: '✅ Registro completado.\n\nYa tenemos tus datos registrados.' };
    case 'REGISTRATION_FAILED': return { text: 'No pudimos completar el registro. Inténtalo nuevamente.' };
    case 'FINALIZE_REGISTRATION': return { text: 'Tus datos están completos. Confirma para finalizar.' };
    case 'WAIT': return { text: 'Un momento, estamos procesando tu registro.' };
  }
}
