import type {
  AgentA0ResourceBudget,
  AgentResolvedProfile,
  AgentSystemInvariants,
} from './types.js';

export const DEFAULT_AGENT_PROFILE: AgentResolvedProfile = {
  identity: {
    name: 'Assistant',
    role: 'Customer Assistant',
  },
  soul: {
    helpfulness: 0.9,
    patience: 0.9,
    empathy: 0.8,
    userAgency: 1,
    groundedness: 1,
  },
  personality: {
    warmth: 0.75,
    formality: 0.45,
    initiative: 0.55,
    humor: 0.1,
    verbosity: 'CONCISE',
  },
  voice: {
    locale: 'es-PE',
    emojiStyle: 'LIGHT',
  },
};

export const AGENT_SYSTEM_INVARIANTS: AgentSystemInvariants = {
  engineOwnsBusinessTruth: true,
  noDirectPersistence: true,
  onlyEngineAllowedActions: true,
  neverInventExecution: true,
  credentialsStayOutsideModelContext: true,
};

/**
 * Hard product budget for the initial Agent Layer.
 *
 * This is the total target node, not a dedicated model host.
 */
export const AGENT_A0_RESOURCE_BUDGET: AgentA0ResourceBudget = {
  totalNodeVcpu: 4,
  totalNodeMemoryMb: 8192,
  gpuRequired: false,
  targetModelParametersB: 1.5,
  quantization: 'Q4',
  normalContextTokens: 2048,
  maxContextTokens: 4096,
  maxOutputTokens: 128,
  maxParallelGenerations: 1,
};
