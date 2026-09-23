export const AGENT_A1_LOCAL_MODEL = {
  provider: 'llama.cpp',
  llamaCppVersion: 'v0.4.1',
  llamaCppCommit: 'b29c606e28a01b1bc8c1351026a0fa6e616bf6c4',
  modelRepo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
  modelFile: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
  modelAlias: 'engines-agent-local',
  quantization: 'Q4_K_M',
  parameterClassB: 1.5,
  contextTokens: 4096,
  generationThreads: 4,
  batchThreads: 4,
  parallelGenerations: 1,
  maxOutputTokens: 128,
  inferenceProcessRssLimitMb: 2304,
} as const;

export type AgentA1LocalModelProfile = typeof AGENT_A1_LOCAL_MODEL;
