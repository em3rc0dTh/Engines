import type {
  ManagedEntityCandidate,
  ManagedEntityPolicy,
  ManagedEntityResolutionDecision,
} from './types.js';

export type ManagedEntityResolutionInput = Readonly<{
  policy: ManagedEntityPolicy;
  candidates: readonly ManagedEntityCandidate[];
  requestedManagedEntityId?: string;
}>;

function activeCandidates(
  policy: ManagedEntityPolicy,
  candidates: readonly ManagedEntityCandidate[],
): readonly ManagedEntityCandidate[] {
  return candidates.filter((candidate) =>
    candidate.status === 'ACTIVE'
    && (!policy.entityType || candidate.entityType === policy.entityType));
}

export function decideManagedEntityResolution(
  input: ManagedEntityResolutionInput,
): ManagedEntityResolutionDecision {
  if (input.policy.mode === 'NOT_APPLICABLE') return { kind: 'NOT_APPLICABLE' };

  const candidates = activeCandidates(input.policy, input.candidates);
  const requested = input.requestedManagedEntityId?.trim();

  if (requested) {
    const selected = candidates.find((candidate) => candidate.managedEntityId === requested);
    if (selected) return { kind: 'SELECTED', managedEntity: selected, reason: 'EXPLICIT' };
    return { kind: 'INVALID_SELECTION', requestedManagedEntityId: requested, candidates };
  }

  if (input.policy.mode === 'REQUIRED_CASE_SCOPED') {
    return { kind: 'NEEDS_CREATION', policy: input.policy, candidates };
  }

  if (candidates.length === 0) {
    return { kind: 'NEEDS_CREATION', policy: input.policy, candidates };
  }

  if (candidates.length === 1 && input.policy.selectionMode === 'AUTO_SINGLE') {
    return { kind: 'SELECTED', managedEntity: candidates[0]!, reason: 'AUTO_SINGLE' };
  }

  return { kind: 'NEEDS_SELECTION', policy: input.policy, candidates };
}
