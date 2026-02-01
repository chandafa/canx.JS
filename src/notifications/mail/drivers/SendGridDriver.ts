import type { MailTransport, MailMessage, MailConfig } from '../types';
import { parseAddress } from '../types';

export class SendGridDriver implements MailTransport {
  private apiKey: string;

  constructor(config: NonNullable<MailConfig['sendgrid']>) {
    this.apiKey = config.apiKey;
  }

  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    const from = parseAddress(message.from || 'noreply@localhost');
    
    const body = {
      personalizations: [{
        to: message.to.map(parseAddress).map(a => ({ email: a.email, name: a.name })),
        cc: message.cc?.map(parseAddress).map(a => ({ email: a.email, name: a.name })),
        bcc: message.bcc?.map(parseAddress).map(a => ({ email: a.email, name: a.name })),
      }],
      from: { email: from.email, name: from.name },
      reply_to: message.replyTo ? parseAddress(message.replyTo) : undefined,
      subject: message.subject,
      content: [
        message.text && { type: 'text/plain', value: message.text },
        message.html && { type: 'text/html', value: message.html },
      ].filter(Boolean),
      attachments: message.attachments?.map(att => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content) 
          ? att.content.toString('base64') 
          : Buffer.from(att.content).toString('base64'),
        type: att.contentType,
      })),
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid error: ${response.status} - ${error}`);
    }

    const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;
    return { messageId, success: true };
  }
}
