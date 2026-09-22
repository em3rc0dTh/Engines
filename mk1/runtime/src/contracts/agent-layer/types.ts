export type AgentJsonPrimitive = string | number | boolean | null;
export type AgentJsonValue = AgentJsonPrimitive | AgentJsonObject | readonly AgentJsonValue[];
export interface AgentJsonObject {
  readonly [key: string]: AgentJsonValue;
}

export type AgentVerbosity = 'TERSE' | 'CONCISE' | 'NATURAL';
export type AgentEmojiStyle = 'NONE' | 'LIGHT' | 'MODERATE';

export type AgentIdentity = Readonly<{
  name: string;
  role: string;
}>;

/**
 * Configurable character principles.
 *
 * These values affect conversational expression only. They never weaken the
 * non-configurable Engine authority boundary.
 */
export type AgentSoul = Readonly<{
  helpfulness: number;
  patience: number;
  empathy: number;
  userAgency: number;
  groundedness: number;
}>;

export type AgentPersonality = Readonly<{
  warmth: number;
  formality: number;
  initiative: number;
  humor: number;
  verbosity: AgentVerbosity;
}>;

export type AgentVoice = Readonly<{
  locale: string;
  emojiStyle: AgentEmojiStyle;
}>;

export type AgentResolvedProfile = Readonly<{
  identity: AgentIdentity;
  soul: AgentSoul;
  personality: AgentPersonality;
  voice: AgentVoice;
}>;

export type AgentProfileOverrides = Readonly<{
  identity?: Partial<AgentIdentity>;
  soul?: Partial<AgentSoul>;
  personality?: Partial<AgentPersonality>;
  voice?: Partial<AgentVoice>;
}>;

export type AgentConversationTurn = Readonly<{
  role: 'USER' | 'AGENT';
  text: string;
}>;

export type AgentEngineProjection = Readonly<{
  phase: string;
  facts: AgentJsonObject;
  allowedActions: readonly string[];
  hints?: readonly string[];
}>;

export type AgentConversationContext = Readonly<{
  businessSlug: string;
  conversationId: string;
  locale: string;
  recentTurns: readonly AgentConversationTurn[];
  currentMessage: string;
  engine: AgentEngineProjection;
}>;

export type AgentModelInput = Readonly<{
  schemaVersion: 1;
  profile: AgentResolvedProfile;
  conversation: AgentConversationContext;
}>;

export type AgentProposedAction = Readonly<{
  action: string;
  arguments: AgentJsonObject;
}>;

export type AgentDecision =
  | Readonly<{
      schemaVersion: 1;
      kind: 'RESPOND';
      reply: string;
    }>
  | Readonly<{
      schemaVersion: 1;
      kind: 'CLARIFY';
      reply: string;
    }>
  | Readonly<{
      schemaVersion: 1;
      kind: 'PROPOSE_ACTION';
      reply: string;
      proposedAction: AgentProposedAction;
    }>;

/**
 * Model output is intentionally unknown.
 *
 * Providers are not trusted to uphold business or capability constraints.
 * Every output must cross validateAgentDecision before Engines may consume it.
 */
export interface AgentModelProvider {
  readonly providerId: string;
  generateTurn(input: AgentModelInput): Promise<unknown>;
}

export type AgentSystemInvariants = Readonly<{
  engineOwnsBusinessTruth: true;
  noDirectPersistence: true;
  onlyEngineAllowedActions: true;
  neverInventExecution: true;
  credentialsStayOutsideModelContext: true;
}>;

export type AgentA0ResourceBudget = Readonly<{
  totalNodeVcpu: 4;
  totalNodeMemoryMb: 8192;
  gpuRequired: false;
  targetModelParametersB: 1.5;
  quantization: 'Q4';
  normalContextTokens: 2048;
  maxContextTokens: 4096;
  maxOutputTokens: 128;
  maxParallelGenerations: 1;
}>;
