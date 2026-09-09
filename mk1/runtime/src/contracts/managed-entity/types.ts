export type ManagedEntityPolicyMode = 'REQUIRED_REUSABLE' | 'REQUIRED_CASE_SCOPED' | 'NOT_APPLICABLE';

export type ManagedEntitySelectionMode = 'ALWAYS_CONFIRM' | 'AUTO_SINGLE';

export type ManagedEntityFieldType = 'text' | 'number' | 'date' | 'boolean' | 'string_list';

export type ManagedEntityFieldDefinition = Readonly<{
  key: string;
  label: string;
  type: ManagedEntityFieldType;
  required: boolean;
}>;

export type ManagedEntityPolicy = Readonly<{
  mode: ManagedEntityPolicyMode;
  entityType?: string;
  label?: string;
  selectionMode?: ManagedEntitySelectionMode;
  creationFields?: readonly ManagedEntityFieldDefinition[];
}>;

export type ManagedEntityCandidate = Readonly<{
  managedEntityId: string;
  businessSlug: string;
  entityType: string;
  displayName: string;
  summary?: string;
  data?: Readonly<Record<string, unknown>>;
  status: 'ACTIVE' | 'INACTIVE';
}>;

export type ManagedEntityResolutionDecision =
  | Readonly<{ kind: 'NOT_APPLICABLE' }>
  | Readonly<{ kind: 'NEEDS_CREATION'; policy: ManagedEntityPolicy; candidates: readonly ManagedEntityCandidate[] }>
  | Readonly<{ kind: 'NEEDS_SELECTION'; policy: ManagedEntityPolicy; candidates: readonly ManagedEntityCandidate[] }>
  | Readonly<{ kind: 'SELECTED'; managedEntity: ManagedEntityCandidate; reason: 'EXPLICIT' | 'AUTO_SINGLE' }>
  | Readonly<{ kind: 'INVALID_SELECTION'; requestedManagedEntityId: string; candidates: readonly ManagedEntityCandidate[] }>;
