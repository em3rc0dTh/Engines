export type ChannelKind = 'WEBCHAT' | 'TELEGRAM' | 'WHATSAPP';

export type CanonicalChannelAction =
  | 'START_CUSTOMER_REGISTRATION'
  | 'PROVIDE_CUSTOMER_DATA'
  | 'FINALIZE_CUSTOMER_REGISTRATION'
  | 'START_APPOINTMENT'
  | 'PROVIDE_CUSTOMER'
  | 'RESOLVE_CUSTOMER'
  | 'SELECT_SERVICE'
  | 'SELECT_OFFERING'
  | 'SET_DATE'
  | 'SELECT_SLOT'
  | 'FINALIZE_APPOINTMENT';

export type CanonicalChannelEnvelope = Readonly<{
  version: 'v1';
  channel: ChannelKind;
  businessSlug: string;
  externalConversationId: string;
  externalMessageId: string;
  externalSenderId: string;
  action: CanonicalChannelAction;
  payload: Readonly<Record<string, unknown>>;
}>;

export type ChannelBindingStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED';
export type ChannelEventStatus = 'PROCESSING' | 'APPLIED' | 'REJECTED';

export type ChannelConversationBinding = Readonly<{
  businessSlug: string;
  channel: ChannelKind;
  externalConversationId: string;
  workflowId: string;
  operation: string;
  bindingStatus: ChannelBindingStatus;
  createdAt: string;
  updatedAt: string;
}>;

export type ChannelInboundEvent = Readonly<{
  businessSlug: string;
  channel: ChannelKind;
  externalMessageId: string;
  externalConversationId: string;
  materialHash: string;
  status: ChannelEventStatus;
  response?: unknown;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type ChannelEventClaim =
  | Readonly<{ kind: 'CLAIMED'; event: ChannelInboundEvent }>
  | Readonly<{ kind: 'RESUME_PROCESSING'; event: ChannelInboundEvent }>
  | Readonly<{ kind: 'REPLAY_APPLIED'; event: ChannelInboundEvent; response: unknown }>
  | Readonly<{ kind: 'REPLAY_REJECTED'; event: ChannelInboundEvent; response: unknown }>;

export type CanonicalChannelExecutionResponse = Readonly<{
  ok: boolean;
  replayed: boolean;
  workflowId?: string;
  runId?: string;
  binding?: ChannelConversationBinding;
  operationResult?: unknown;
  code?: string;
}>;

export type CustomerRegistrationRenderIntent =
  | 'ASK_CUSTOMER_NAME'
  | 'ASK_CUSTOMER_PHONE'
  | 'ASK_CUSTOMER_EMAIL'
  | 'FINALIZE_REGISTRATION'
  | 'REGISTRATION_COMPLETE'
  | 'REGISTRATION_FAILED'
  | 'WAIT';
