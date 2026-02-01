/**
 * CanxJS Mail - Email sending with multiple transport support
 */

import type { MailMessage, MailConfig, MailTransport, MailAddress, MailAttachment } from './mail/types';
import { LogDriver } from './mail/drivers/LogDriver';
import { SmtpDriver } from './mail/drivers/SmtpDriver';
import { SendGridDriver } from './mail/drivers/SendGridDriver';
import { ResendDriver } from './mail/drivers/ResendDriver';
import { view as renderView } from '../mvc/View';

// Re-export types for consumers
export type { MailMessage, MailConfig, MailTransport, MailAddress, MailAttachment };

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
        if (!this.config.smtp) throw new Error('SMTP config requirement missing');
        return new SmtpDriver(this.config.smtp);
      case 'sendgrid':
        if (!this.config.sendgrid) throw new Error('SendGrid config requirement missing');
        return new SendGridDriver(this.config.sendgrid);
      case 'resend':
        if (!this.config.resend) throw new Error('Resend config requirement missing');
        return new ResendDriver(this.config.resend);
      case 'log':
      default:
        return new LogDriver();
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

  async view(view: string, data: Record<string, unknown> = {}): Promise<this> {
    const html = await renderView(view, data);
    this.message.html = html;
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
