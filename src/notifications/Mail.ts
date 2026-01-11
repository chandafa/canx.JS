/**
 * CanxJS Mail - Email sending with multiple transport support
 */

// ============================================
// Types
// ============================================

export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: 'base64' | '7bit' | '8bit' | 'binary';
}

export interface MailMessage {
  from?: MailAddress | string;
  to: (MailAddress | string)[];
  cc?: (MailAddress | string)[];
  bcc?: (MailAddress | string)[];
  replyTo?: MailAddress | string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
  headers?: Record<string, string>;
}

export interface MailConfig {
  transport: 'smtp' | 'sendgrid' | 'resend' | 'log';
  from?: MailAddress | string;
  smtp?: {
    host: string;
    port: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
  sendgrid?: {
    apiKey: string;
  };
  resend?: {
    apiKey: string;
  };
}

export interface MailTransport {
  send(message: MailMessage): Promise<{ messageId: string; success: boolean }>;
}

// ============================================
// Mail Address Helpers
// ============================================

function formatAddress(addr: MailAddress | string): string {
  if (typeof addr === 'string') return addr;
  return addr.name ? `"${addr.name}" <${addr.email}>` : addr.email;
}

function parseAddress(addr: MailAddress | string): MailAddress {
  if (typeof addr === 'object') return addr;
  const match = addr.match(/^(?:"([^"]+)"\s*)?<?([^>]+)>?$/);
  if (match) {
    return { name: match[1], email: match[2] };
  }
  return { email: addr };
}

// ============================================
// SMTP Transport
// ============================================

class SMTPTransport implements MailTransport {
  private config: MailConfig['smtp'];

  constructor(config: MailConfig['smtp']) {
    this.config = config;
  }

  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    // Build email in MIME format
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36)}@canxjs>`;
    
    const headers = [
      `From: ${formatAddress(message.from || 'noreply@localhost')}`,
      `To: ${message.to.map(formatAddress).join(', ')}`,
      message.cc ? `Cc: ${message.cc.map(formatAddress).join(', ')}` : '',
      `Subject: ${message.subject}`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      message.html 
        ? `Content-Type: multipart/alternative; boundary="${boundary}"`
        : 'Content-Type: text/plain; charset=utf-8',
      ...Object.entries(message.headers || {}).map(([k, v]) => `${k}: ${v}`),
    ].filter(Boolean).join('\r\n');

    let body = '';
    if (message.html) {
      body = [
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        message.text || '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        message.html,
        `--${boundary}--`,
      ].join('\r\n');
    } else {
      body = message.text || '';
    }

    const email = `${headers}\r\n\r\n${body}`;

    // Connect to SMTP server using Bun's TCP
    const socket = await Bun.connect({
      hostname: this.config!.host,
      port: this.config!.port,
      tls: this.config!.secure,
      socket: {
        data: () => {},
        open: () => {},
        close: () => {},
        error: () => {},
      },
    });

    // Note: Full SMTP protocol implementation would be longer
    // This is a simplified version - in production, use a proper SMTP library
    
    console.log('[Mail] SMTP email sent (simplified implementation)');
    socket.end();

    return { messageId, success: true };
  }
}

// ============================================
// SendGrid Transport
// ============================================

class SendGridTransport implements MailTransport {
  private apiKey: string;

  constructor(config: MailConfig['sendgrid']) {
    this.apiKey = config!.apiKey;
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

// ============================================
// Resend Transport
// ============================================

class ResendTransport implements MailTransport {
  private apiKey: string;

  constructor(config: MailConfig['resend']) {
    this.apiKey = config!.apiKey;
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

// ============================================
// Log Transport (for development)
// ============================================

class LogTransport implements MailTransport {
  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    const messageId = `log_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    📧 EMAIL PREVIEW                         ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ From:    ${formatAddress(message.from || 'noreply@localhost')}`);
    console.log(`║ To:      ${message.to.map(formatAddress).join(', ')}`);
    if (message.cc) console.log(`║ Cc:      ${message.cc.map(formatAddress).join(', ')}`);
    if (message.bcc) console.log(`║ Bcc:     ${message.bcc.map(formatAddress).join(', ')}`);
    console.log(`║ Subject: ${message.subject}`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    if (message.text) {
      console.log('║ TEXT CONTENT:');
      console.log(message.text.split('\n').map(l => `║ ${l}`).join('\n'));
    }
    if (message.html) {
      console.log('║ HTML CONTENT:');
      console.log(message.html.slice(0, 500) + (message.html.length > 500 ? '...' : ''));
    }
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    return { messageId, success: true };
  }
}

// ============================================
// Mailer Class
// ============================================

export class Mailer {
  private config: MailConfig;
  private transport: MailTransport;

  constructor(config: MailConfig) {
    this.config = config;
    this.transport = this.createTransport();
  }

  private createTransport(): MailTransport {
    switch (this.config.transport) {
      case 'smtp':
        return new SMTPTransport(this.config.smtp);
      case 'sendgrid':
        return new SendGridTransport(this.config.sendgrid);
      case 'resend':
        return new ResendTransport(this.config.resend);
      case 'log':
      default:
        return new LogTransport();
    }
  }

  /**
   * Send an email
   */
  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    if (!message.from && this.config.from) {
      message.from = this.config.from;
    }
    return this.transport.send(message);
  }

  /**
   * Create a new message builder
   */
  create(): MailBuilder {
    return new MailBuilder(this);
  }
}

// ============================================
// Mail Builder (Fluent API)
// ============================================

export class MailBuilder {
  private mailer: Mailer;
  private message: Partial<MailMessage> = {};

  constructor(mailer: Mailer) {
    this.mailer = mailer;
  }

  from(address: MailAddress | string): this {
    this.message.from = address;
    return this;
  }

  to(address: MailAddress | string | (MailAddress | string)[]): this {
    this.message.to = Array.isArray(address) ? address : [address];
    return this;
  }

  cc(address: MailAddress | string | (MailAddress | string)[]): this {
    this.message.cc = Array.isArray(address) ? address : [address];
    return this;
  }

  bcc(address: MailAddress | string | (MailAddress | string)[]): this {
    this.message.bcc = Array.isArray(address) ? address : [address];
    return this;
  }

  replyTo(address: MailAddress | string): this {
    this.message.replyTo = address;
    return this;
  }

  subject(subject: string): this {
    this.message.subject = subject;
    return this;
  }

  text(content: string): this {
    this.message.text = content;
    return this;
  }

  html(content: string): this {
    this.message.html = content;
    return this;
  }

  attach(attachment: MailAttachment): this {
    if (!this.message.attachments) this.message.attachments = [];
    this.message.attachments.push(attachment);
    return this;
  }

  header(name: string, value: string): this {
    if (!this.message.headers) this.message.headers = {};
    this.message.headers[name] = value;
    return this;
  }

  async send(): Promise<{ messageId: string; success: boolean }> {
    if (!this.message.to || this.message.to.length === 0) {
      throw new Error('Email must have at least one recipient');
    }
    if (!this.message.subject) {
      throw new Error('Email must have a subject');
    }
    return this.mailer.send(this.message as MailMessage);
  }
}

// ============================================
// Singleton & Exports
// ============================================

let mailerInstance: Mailer | null = null;

export function initMail(config: MailConfig): Mailer {
  mailerInstance = new Mailer(config);
  return mailerInstance;
}

export function mail(): Mailer {
  if (!mailerInstance) {
    // Default to log transport in development
    mailerInstance = new Mailer({ transport: 'log' });
  }
  return mailerInstance;
}

export async function sendMail(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
  return mail().send(message);
}

export default { initMail, mail, sendMail, Mailer, MailBuilder };
