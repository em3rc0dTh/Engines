import {
  decodeMetaCloudApiWebhook,
  MetaCloudApiClient,
  type MetaCloudApiClientOptions,
} from './whatsapp.cloud-api.js';
import type {
  VerifiedWhatsAppInbound,
  WhatsAppTransportPort,
} from './whatsapp.transport.js';

export type OfficialMetaCloudApiTransportOptions = MetaCloudApiClientOptions & Readonly<{
  appSecret: string;
}>;

export class OfficialMetaCloudApiTransport implements WhatsAppTransportPort {
  private readonly client: MetaCloudApiClient;

  constructor(private readonly options: OfficialMetaCloudApiTransportOptions) {
    if (!options.appSecret.trim()) throw new Error('WHATSAPP_APP_SECRET_REQUIRED');
    this.client = new MetaCloudApiClient(options);
  }

  verifyAndNormalize(
    body: string,
    headers: Readonly<Record<string, string | undefined>>,
  ): VerifiedWhatsAppInbound {
    const events = this.verifyAndNormalizeMany(body, headers);
    if (events.length !== 1) throw new Error(`WHATSAPP_META_EXPECTED_ONE_MESSAGE:${events.length}`);
    return events[0]!;
  }

  verifyAndNormalizeMany(
    body: string,
    headers: Readonly<Record<string, string | undefined>>,
  ): readonly VerifiedWhatsAppInbound[] {
    return decodeMetaCloudApiWebhook(body, headers, {
      appSecret: this.options.appSecret,
      expectedPhoneNumberId: this.options.phoneNumberId,
    });
  }

  async send(to: string, message: Readonly<Record<string, unknown>>): Promise<void> {
    await this.client.send(to, message);
  }
}
