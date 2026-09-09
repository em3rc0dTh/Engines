export type ManagedEntityLifecycle = 'DURABLE_REUSABLE' | 'REQUEST_SCOPED';
export type ManagedEntityRequirement = 'REQUIRED' | 'OPTIONAL' | 'NONE';
export type ManagedEntitySelectionMode = 'ALWAYS_EXPLICIT' | 'AUTO_IF_SINGLE' | 'CREATE_NEW_DEFAULT';

export type ManagedEntityPolicy = Readonly<{
  requirement: ManagedEntityRequirement;
  lifecycle: ManagedEntityLifecycle;
  selectionMode: ManagedEntitySelectionMode;
  type: string;
  label: string;
}>;

export type ManagedEntityCandidate = Readonly<{
  managedEntityId: string;
  type: string;
  displayName: string;
  summary?: string;
}>;

export type ManagedEntityResolutionDecision =
  | Readonly<{ kind: 'NOT_REQUIRED' }>
  | Readonly<{ kind: 'CREATE_NEW'; reason: 'NONE_FOUND' | 'REQUEST_SCOPED_DEFAULT' }>
  | Readonly<{ kind: 'SELECT'; candidates: readonly ManagedEntityCandidate[] }>
  | Readonly<{ kind: 'SELECTED'; managedEntity: ManagedEntityCandidate }>;

export function decideManagedEntityResolution(
  policy: ManagedEntityPolicy,
  candidates: readonly ManagedEntityCandidate[],
): ManagedEntityResolutionDecision {
  if (policy.requirement === 'NONE') return { kind: 'NOT_REQUIRED' };

  const compatible = candidates.filter((candidate) => candidate.type === policy.type);

  if (policy.lifecycle === 'REQUEST_SCOPED' && policy.selectionMode === 'CREATE_NEW_DEFAULT') {
    return { kind: 'CREATE_NEW', reason: 'REQUEST_SCOPED_DEFAULT' };
  }

  if (compatible.length === 0) {
    return policy.requirement === 'OPTIONAL'
      ? { kind: 'NOT_REQUIRED' }
      : { kind: 'CREATE_NEW', reason: 'NONE_FOUND' };
  }

  if (compatible.length === 1 && policy.selectionMode === 'AUTO_IF_SINGLE') {
    return { kind: 'SELECTED', managedEntity: compatible[0]! };
  }

  return { kind: 'SELECT', candidates: compatible };
}

export const GALLO_VEHICLE_MANAGED_ENTITY_POLICY: ManagedEntityPolicy = {
  requirement: 'REQUIRED',
  lifecycle: 'DURABLE_REUSABLE',
  selectionMode: 'ALWAYS_EXPLICIT',
  type: 'vehicle',
  label: 'Vehículo',
};

export const BATEYLATE_DESSERT_REQUEST_MANAGED_ENTITY_POLICY: ManagedEntityPolicy = {
  requirement: 'REQUIRED',
  lifecycle: 'REQUEST_SCOPED',
  selectionMode: 'CREATE_NEW_DEFAULT',
  type: 'dessert_request',
  label: 'Solicitud de postre',
};
