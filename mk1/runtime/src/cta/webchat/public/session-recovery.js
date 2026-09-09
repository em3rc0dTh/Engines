export const WEBCHAT_CONVERSATION_STORAGE_KEY = 'engines.webchat.conversationId';

export function isRecoverableStaleConversationError(error) {
  return Boolean(error)
    && typeof error === 'object'
    && error.status === 404
    && error.code === 'CHANNEL_CONVERSATION_NOT_BOUND';
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
  storage.removeItem(WEBCHAT_CONVERSATION_STORAGE_KEY);

  const url = new URL(currentHref);
  url.searchParams.delete('conversationId');
  url.searchParams.delete('workflowId');

  return { staleConversationId, url: url.toString() };
}
