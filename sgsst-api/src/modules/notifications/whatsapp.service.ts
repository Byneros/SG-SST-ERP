import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

type WhatsAppInput = {
  to: string;
  text: string;
};

export class WhatsAppDeliveryError extends Error {
  constructor(
    message: string,
    readonly response?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  async sendText(input: WhatsAppInput) {
    if (!env.whatsappEnabled) {
      this.logger.log(`[whatsapp disabled] ${input.to}`);
      return { sent: false, disabled: true };
    }

    if (!env.whatsappPhoneNumberId || !env.whatsappAccessToken) {
      this.logger.warn(
        'WhatsApp is enabled but WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is missing',
      );
      return { sent: false, misconfigured: true };
    }

    const response = await fetch(
      `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.whatsappAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.to.replace(/^\+/, ''),
          type: 'text',
          text: {
            preview_url: false,
            body: input.text,
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await this.parseResponse(response);
      throw new WhatsAppDeliveryError(
        `WhatsApp API failed with ${response.status}`,
        body,
      );
    }

    return { sent: true, response: await this.parseResponse(response) };
  }

  private async parseResponse(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { body: text.slice(0, 1000) };
    }
  }
}
