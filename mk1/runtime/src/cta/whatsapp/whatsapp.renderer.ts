import type { CustomerRegistrationRenderIntent } from '../channel-core/types.js';

export function renderWhatsAppRegistration(intent: 'CONSENT' | CustomerRegistrationRenderIntent): Readonly<Record<string, unknown>> {
  if (intent === 'CONSENT') return {
    type: 'interactive', body: 'Hola 👋\n\n¿Nos autorizas a registrar tus datos para atenderte desde nuestro sistema?',
    buttons: [
      { id: 'register_customer_yes', title: 'Sí, registrarme' },
      { id: 'register_customer_no', title: 'Ahora no' },
    ],
  };
  const text: Record<CustomerRegistrationRenderIntent, string> = {
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
