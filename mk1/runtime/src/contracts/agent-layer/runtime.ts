import type {
  AgentDecision,
  AgentModelInput,
  AgentModelProvider,
} from './types.js';
import {
  validateAgentDecision,
  validateAgentModelInput,
} from './validation.js';

/**
 * Executes exactly one conversational model turn.
 *
 * The provider has no execution authority. Its raw output remains unknown until
 * it passes both canonical shape validation and the current Engine capability
 * boundary.
 */
export async function runAgentModelTurn(
  provider: AgentModelProvider,
  input: AgentModelInput,
): Promise<AgentDecision> {
  const canonicalInput = validateAgentModelInput(input);
  const rawDecision = await provider.generateTurn(canonicalInput);
  return validateAgentDecision(rawDecision, canonicalInput);
}
