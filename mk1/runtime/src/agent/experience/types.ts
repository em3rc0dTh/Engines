import type {
  AgentConversationTurn,
  AgentEngineProjection,
  AgentJsonObject,
  AgentResolvedProfile,
} from '../../contracts/agent-layer/index.js';

export const A5_DISTILLATION_FIELDS = [
  'customer_name',
  'problem_statement',
  'symptom',
  'vehicle_reference',
  'managed_entity_type',
  'service_intent',
  'offering_preference',
  'date_preference',
  'slot_preference',
  'confirmation',
  'desired_outcome',
] as const;

export type A5DistillationField = typeof A5_DISTILLATION_FIELDS[number];

export type A5DistilledFact = Readonly<{
  field: A5DistillationField;
  value: string;
}>;

export type A5ProgressiveDistillation = Readonly<{
  observed: readonly A5DistilledFact[];
  inferred: readonly A5DistilledFact[];
}>;

export type A5ExperienceModelInput = Readonly<{
  schemaVersion: 1;
  profile: AgentResolvedProfile;
  businessDisplayName: string;
  conversation: Readonly<{
    businessSlug: string;
    conversationId: string;
    locale: string;
    recentTurns: readonly AgentConversationTurn[];
    currentMessage: string;
    engine: AgentEngineProjection;
  }>;
}>;

export type A5ExperienceModelOutput = Readonly<{
  schemaVersion: 1;
  reply: string;
  distillation: A5ProgressiveDistillation;
  proposedAction?: Readonly<{
    action: string;
    arguments: AgentJsonObject;
  }>;
}>;

export interface A5ExperienceModelProvider {
  readonly providerId: string;
  generateTurn(input: A5ExperienceModelInput): Promise<unknown>;
}
