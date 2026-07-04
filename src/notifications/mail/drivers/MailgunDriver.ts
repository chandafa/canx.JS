import type { MailTransport, MailMessage, MailConfig } from '../types';
import { formatAddress } from '../types';

/**
 * MailgunDriver — sends via the Mailgun HTTP API.
 *
 * POSTs to `https://<host>/v3/<domain>/messages` with HTTP Basic auth using
 * `base64('api:' + apiKey)`. The body is form-encoded (URL-encoded when there
 * are no attachments, multipart/form-data when there are).
 *
 * `region` selects the Mailgun region host:
 *   - undefined / 'us'      -> api.mailgun.net
 *   - 'eu'                   -> api.eu.mailgun.net
 *   - any other value        -> api.<region>.mailgun.net
 */
export class MailgunDriver implements MailTransport {
  private apiKey: string;
  private domain: string;
  private host: string;

  constructor(config: NonNullable<MailConfig['mailgun']>) {
    this.apiKey = config.apiKey;
    this.domain = config.domain;
    const region = config.region;
    this.host = !region || region === 'us' ? 'api.mailgun.net' : `api.${region}.mailgun.net`;
  }

  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    const url = `https://${this.host}/v3/${this.domain}/messages`;
    const authorization = `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`;

    const fields: Array<[string, string]> = [
      ['from', formatAddress(message.from || 'noreply@localhost')],
      ['subject', message.subject],
    ];
    for (const to of message.to) fields.push(['to', formatAddress(to)]);
    for (const cc of message.cc || []) fields.push(['cc', formatAddress(cc)]);
    for (const bcc of message.bcc || []) fields.push(['bcc', formatAddress(bcc)]);
    if (message.replyTo) fields.push(['h:Reply-To', formatAddress(message.replyTo)]);
    if (message.text) fields.push(['text', message.text]);
    if (message.html) fields.push(['html', message.html]);
    for (const [k, v] of Object.entries(message.headers || {})) fields.push([`h:${k}`, v]);

    let body: BodyInit;
    if (message.attachments && message.attachments.length) {
      const form = new FormData();
      for (const [k, v] of fields) form.append(k, v);
      for (const att of message.attachments) {
        const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
        const bytes = new Uint8Array(buf);
        const blob = new Blob([bytes], { type: att.contentType || 'application/octet-stream' });
        form.append('attachment', blob, att.filename);
      }
      body = form;
    } else {
      const params = new URLSearchParams();
      for (const [k, v] of fields) params.append(k, v);
      body = params;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: authorization },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mailgun error: ${response.status} - ${error}`);
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    const messageId = data.id || `mg_${Date.now()}`;
    return { messageId, success: true };
  }
}
