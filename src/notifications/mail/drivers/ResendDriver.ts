import type { MailTransport, MailMessage, MailConfig } from '../types';
import { formatAddress } from '../types';

export class ResendDriver implements MailTransport {
  private apiKey: string;

  constructor(config: NonNullable<MailConfig['resend']>) {
    this.apiKey = config.apiKey;
  }

  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    const body = {
      from: formatAddress(message.from || 'noreply@localhost'),
      to: message.to.map(formatAddress),
      cc: message.cc?.map(formatAddress),
      bcc: message.bcc?.map(formatAddress),
      reply_to: message.replyTo ? formatAddress(message.replyTo) : undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments?.map(att => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content) 
          ? att.content.toString('base64') 
          : att.content,
      })),
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { id: string };
    return { messageId: data.id, success: true };
  }
}
