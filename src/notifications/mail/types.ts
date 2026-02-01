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

export function formatAddress(addr: MailAddress | string): string {
  if (typeof addr === 'string') return addr;
  return addr.name ? `"${addr.name}" <${addr.email}>` : addr.email;
}

export function parseAddress(addr: MailAddress | string): MailAddress {
  if (typeof addr === 'object') return addr;
  const match = addr.match(/^(?:"([^"]+)"\s*)?<?([^>]+)>?$/);
  if (match) {
    return { name: match[1], email: match[2] };
  }
  return { email: addr };
}
