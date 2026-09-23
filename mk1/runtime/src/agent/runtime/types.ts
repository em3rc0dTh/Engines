import type {
  AgentConversationTurn,
  AgentDecision,
  AgentJsonObject,
} from '../../contracts/agent-layer/index.js';

export type AgentRuntimeRoute = 'MODEL' | 'DETERMINISTIC_BYPASS' | 'SAFE_FALLBACK';

export type AgentRuntimeMessageInput = Readonly<{
  businessSlug: string;
  channel: string;
  externalConversationId: string;
  externalMessageId: string;
  externalSenderId: string;
  text: string;
}>;

export type AgentRuntimeAudit = Readonly<{
  route: AgentRuntimeRoute;
  modelInvoked: boolean;
  contextTurnCount: number;
  enginePhaseBefore?: string;
  enginePhaseAfter?: string;
  interpretation?: AgentDecision;
  detail?: AgentJsonObject;
}>;

export type AgentRuntimeWorkerContext = Readonly<{
  recentTurns: readonly AgentConversationTurn[];
}>;

export type AgentRuntimeWorkerResult<T> = Readonly<{
  value: T;
  reply: string;
  audit: Omit<AgentRuntimeAudit, 'contextTurnCount'>;
}>;

export type AgentRuntimeExecution<T> = Readonly<{
  value: T;
  replayed: boolean;
  audit: AgentRuntimeAudit;
}>;

export type AgentRuntimeClaim =
  | Readonly<{ kind: 'NEW' }>
  | Readonly<{
      kind: 'REPLAY_APPLIED';
      response: unknown;
      reply: string;
      route: AgentRuntimeRoute;
      modelInvoked: boolean;
      contextTurnCount: number;
      enginePhaseBefore?: string;
      enginePhaseAfter?: string;
    }>
  | Readonly<{
      kind: 'REPLAY_FAILED';
      errorCode: string;
    }>;

export interface AgentRuntimeStore {
  claim(input: AgentRuntimeMessageInput): Promise<AgentRuntimeClaim>;
  recentTurns(input: Readonly<{
    businessSlug: string;
    channel: string;
    externalConversationId: string;
    excludeExternalMessageId?: string;
    maxConversationTurns?: number;
  }>): Promise<readonly AgentConversationTurn[]>;
  complete(input: Readonly<{
    message: AgentRuntimeMessageInput;
    response: unknown;
    reply: string;
    route: AgentRuntimeRoute;
    modelInvoked: boolean;
    contextTurnCount: number;
    interpretation?: AgentDecision;
    enginePhaseBefore?: string;
    enginePhaseAfter?: string;
  }>): Promise<void>;
  fail(input: Readonly<{
    message: AgentRuntimeMessageInput;
    errorCode: string;
  }>): Promise<void>;
}
