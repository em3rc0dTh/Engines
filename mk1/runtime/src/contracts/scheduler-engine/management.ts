import type {
  ScheduleOverride,
  ScheduleTemplate,
  SchedulerResource,
  SchedulerResourceStatus,
} from './types.js';

export type SchedulerManagementCommandType =
  | 'CreateResource'
  | 'UpdateResource'
  | 'SetResourceStatus'
  | 'SetScheduleTemplate'
  | 'PutScheduleOverride'
  | 'DeleteScheduleOverride';

export type SchedulerManagementFailureCode =
  | 'RESOURCE_ALREADY_EXISTS'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_REVISION_CONFLICT'
  | 'SCHEDULE_NOT_FOUND'
  | 'SCHEDULE_REVISION_CONFLICT'
  | 'SCHEDULE_RESOURCE_IMMUTABLE'
  | 'OVERRIDE_NOT_FOUND'
  | 'OVERRIDE_REVISION_CONFLICT'
  | 'OVERRIDE_RESOURCE_IMMUTABLE'
  | 'IDEMPOTENCY_MATERIAL_CONFLICT';

export type SchedulerManagementResultType = 'RESOURCE' | 'SCHEDULE' | 'OVERRIDE';

export type SchedulerManagementCommandResult = Readonly<{
  businessSlug: string;
  operationId: string;
  commandType: SchedulerManagementCommandType;
  resultType: SchedulerManagementResultType;
  resultId: string;
  replayed: boolean;
}>;

export type CreateResourceCommand = Readonly<{
  businessSlug: string;
  operationId: string;
  resource: SchedulerResource;
}>;

export type UpdateResourceCommand = Readonly<{
  businessSlug: string;
  operationId: string;
  expectedRevision: number;
  resource: SchedulerResource;
}>;

export type SetResourceStatusCommand = Readonly<{
  businessSlug: string;
  operationId: string;
  resourceId: string;
  expectedRevision: number;
  status: SchedulerResourceStatus;
}>;

export type SetScheduleTemplateCommand = Readonly<{
  businessSlug: string;
  operationId: string;
  expectedRevision: number;
  schedule: ScheduleTemplate;
}>;

export type PutScheduleOverrideCommand = Readonly<{
  businessSlug: string;
  operationId: string;
  expectedRevision: number;
  override: ScheduleOverride;
}>;

export type DeleteScheduleOverrideCommand = Readonly<{
  businessSlug: string;
  operationId: string;
  overrideId: string;
  expectedRevision: number;
}>;
