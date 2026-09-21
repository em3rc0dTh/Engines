import type {
  ServiceDefinition,
  ServiceOffering,
} from './types.js';

export type ServicesSelectionSnapshot = Readonly<{
  service: ServiceDefinition;
  offering: ServiceOffering;
}>;

export type ServicesSnapshotConsumerInput = Readonly<{
  businessSlug: string;
  offeringIdOrCode: string;
}>;

export type ServicesSnapshotConsumerPhase =
  | 'LOADING'
  | 'WAITING'
  | 'COMPLETED';

export type ServicesSnapshotConsumerState = Readonly<{
  phase: ServicesSnapshotConsumerPhase;
  businessSlug: string;
  offeringIdOrCode: string;
  snapshot?: ServicesSelectionSnapshot;
  continueRequested: boolean;
}>;

export type ServicesSnapshotConsumerResult = Readonly<{
  status: 'COMPLETED';
  snapshot: ServicesSelectionSnapshot;
}>;
