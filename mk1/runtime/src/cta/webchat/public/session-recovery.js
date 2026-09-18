export const WEBCHAT_CONVERSATION_STORAGE_KEY = 'engines.webchat.conversationId';

export function isRecoverableStaleConversationError(error) {
  return Boolean(error)
    && typeof error === 'object'
    && error.status === 404
    && error.code === 'CHANNEL_CONVERSATION_NOT_BOUND';
}

function completedStep(steps, id) {
  const step = steps.find((item) => item?.id === id);
  return step?.status === 'COMPLETE' ? step : undefined;
}

export function projectRecoveredTranscript(snapshot) {
  const steps = Array.isArray(snapshot?.view?.steps) ? snapshot.view.steps : [];
  const workflowId = snapshot?.workflowId || snapshot?.state?.workflowId || '';
  if (!workflowId || steps.length === 0) return [];

  const messages = [{
    kind: 'system',
    text: `Recovered durable WebChat conversation.\nWorkflow: ${workflowId}`,
  }];

  const addValue = (id, prompt) => {
    const step = completedStep(steps, id);
    if (!step?.value) return;
    messages.push({ kind: 'system', text: prompt });
    messages.push({ kind: 'user', text: String(step.value) });
  };

  addValue('CUSTOMER_NAME', 'Step 02 — Enter the customer name.');
  addValue('CUSTOMER_EMAIL', 'Step 03 — Enter the customer email.');
  addValue('CUSTOMER_PHONE', 'Step 04 — Enter the customer phone number.');

  if (completedStep(steps, 'CUSTOMER_RESOLUTION')) {
    messages.push({ kind: 'system', text: 'Step 05 — Customer data is captured. Resolve the customer through Temporal.' });
    messages.push({ kind: 'user', text: 'Resolve Customer' });
  }

  addValue('SERVICE_SELECTION', 'Step 06 — Select a Service loaded by the Workflow.');
  addValue('OFFERING_SELECTION', 'Step 07 — Select an Offering / Product for the selected Service.');
  addValue('DATE_SELECTION', 'Step 08 — Enter the appointment date.');

  const slots = completedStep(steps, 'SLOTS_LOADING');
  if (slots?.value) messages.push({ kind: 'meta', text: `Step 09 — Available slots loaded: ${slots.value}` });

  addValue('SLOT_SELECTION', 'Step 10 — Available slots are loaded. Select one.');

  if (completedStep(steps, 'FINALIZE_APPOINTMENT')) {
    messages.push({ kind: 'system', text: 'Step 11 — Persist the Appointment explicitly.' });
    messages.push({ kind: 'user', text: 'Finalize Appointment' });
  }

  const created = completedStep(steps, 'APPOINTMENT_CREATED');
  if (created?.value) {
    messages.push({ kind: 'system', text: `Appointment created.\nAppointment ID: ${created.value}` });
  }

  return messages;
}

export function clearStaleConversationSession(state, storage, currentHref) {
  const staleConversationId = state.conversationId || '';
  state.conversationId = '';
  state.workflowId = '';
  state.snapshot = null;
  state.view = null;
  state.inputMode = null;
  state.lastPromptKey = '';
  state.lastPhaseSignature = '';
  if ('transcriptHydrated' in state) state.transcriptHydrated = false;
  storage.removeItem(WEBCHAT_CONVERSATION_STORAGE_KEY);

  const url = new URL(currentHref);
  url.searchParams.delete('conversationId');
  url.searchParams.delete('workflowId');

  return { staleConversationId, url: url.toString() };
}
