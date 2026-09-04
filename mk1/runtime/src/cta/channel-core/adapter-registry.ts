import type { CanonicalChannelEnvelope, ChannelKind } from './types.js';

export type TrustedChannelRoute = Readonly<{
  businessSlug: string;
  registrationRenderIntent?: import('./types.js').CustomerRegistrationRenderIntent;
}>;

export interface ChannelAdapter<RawInbound = unknown> {
  readonly channel: ChannelKind;
  normalizeInbound(raw: RawInbound, route: TrustedChannelRoute): CanonicalChannelEnvelope | undefined;
}

export class ChannelAdapterRegistry {
  private readonly adapters = new Map<ChannelKind, ChannelAdapter<unknown>>();

  register<RawInbound>(adapter: ChannelAdapter<RawInbound>): void {
    this.adapters.set(adapter.channel, adapter as ChannelAdapter<unknown>);
  }

  get(channel: ChannelKind): ChannelAdapter<unknown> {
    const adapter = this.adapters.get(channel);
    if (!adapter) throw new Error(`CHANNEL_ADAPTER_NOT_REGISTERED:${channel}`);
    return adapter;
  }
}
