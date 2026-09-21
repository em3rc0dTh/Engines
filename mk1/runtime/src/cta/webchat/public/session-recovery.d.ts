export const WEBCHAT_CONVERSATION_STORAGE_KEY: string;

export function isRecoverableStaleConversationError(error: unknown): boolean;

export function clearStaleConversationSession<
  T extends {
    conversationId: string;
    workflowId: string;
    snapshot: unknown;
    view: unknown;
    inputMode: unknown;
    lastPromptKey: string;
    lastPhaseSignature: string;
  },
>(
  state: T,
  storage: { removeItem(key: string): void },
  currentHref: string,
): Readonly<{ staleConversationId: string; url: string }>;
