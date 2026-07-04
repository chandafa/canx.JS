import type { MailTransport, MailMessage, MailConfig } from '../types';
import { formatAddress, parseAddress } from '../types';

type SmtpConfig = NonNullable<MailConfig['smtp']>;

interface SmtpReply {
  code: number;
  lines: string[];
  text: string;
}

/**
 * A minimal, dependency-free SMTP connection built on Bun's TCP sockets.
 *
 * It buffers incoming bytes and resolves one pending reply at a time. SMTP
 * multiline replies (`250-` continuation vs `250 ` final) are collapsed into a
 * single {@link SmtpReply}. Commands are strictly request/response.
 */
class SmtpConnection {
  socket: any = null;
  private buffer = '';
  private pendingLines: string[] = [];
  private replyQueue: SmtpReply[] = [];
  private waiters: Array<(r: SmtpReply) => void> = [];
  private failWaiters: Array<(e: Error) => void> = [];
  private error: Error | null = null;
  closed = false;

  /** Feed a chunk of bytes (string or Uint8Array) from the socket. */
  onData(data: string | Uint8Array): void {
    this.buffer += typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
    let idx: number;
    while ((idx = this.buffer.indexOf('\r\n')) !== -1) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      this.pendingLines.push(line);
      // A final line is "NNN " (space) after the 3-digit code; "NNN-" continues.
      if (/^\d{3} /.test(line)) {
        const lines = this.pendingLines;
        this.pendingLines = [];
        const code = parseInt(line.slice(0, 3), 10);
        const text = lines.map((l) => l.slice(4)).join('\n');
        this.pushReply({ code, lines, text });
      }
    }
  }

  onClose(): void {
    this.closed = true;
    if (!this.error) this.error = new Error('SMTP connection closed by server');
    this.flushErrors();
  }

  onError(err: Error): void {
    this.error = err instanceof Error ? err : new Error(String(err));
    this.flushErrors();
  }

  private pushReply(reply: SmtpReply): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      this.failWaiters.shift();
      waiter(reply);
    } else {
      this.replyQueue.push(reply);
    }
  }

  private flushErrors(): void {
    while (this.failWaiters.length) {
      const fail = this.failWaiters.shift()!;
      this.waiters.shift();
      fail(this.error!);
    }
  }

  /** Await the next complete server reply. */
  read(): Promise<SmtpReply> {
    const queued = this.replyQueue.shift();
    if (queued) return Promise.resolve(queued);
    if (this.error) return Promise.reject(this.error);
    return new Promise<SmtpReply>((resolve, reject) => {
      this.waiters.push(resolve);
      this.failWaiters.push(reject);
    });
  }

  /** Write a line (CRLF appended) to the socket. */
  write(line: string): void {
    if (!this.socket) throw new Error('SMTP socket not connected');
    this.socket.write(line + '\r\n');
  }

  /** Write raw bytes (no CRLF added). */
  writeRaw(data: string): void {
    if (!this.socket) throw new Error('SMTP socket not connected');
    this.socket.write(data);
  }

  /** Send a command and assert the reply code is one of `expected`. */
  async command(cmd: string, expected: number[]): Promise<SmtpReply> {
    if (cmd) this.write(cmd);
    const reply = await this.read();
    if (!expected.includes(reply.code)) {
      const shown = cmd.replace(/^(AUTH\s+\S+).*/i, '$1 ***');
      throw new Error(
        `SMTP command "${shown || '<data>'}" failed: expected ${expected.join('/')}, ` +
          `got ${reply.code} ${reply.text}`,
      );
    }
    return reply;
  }
}

export class SmtpDriver implements MailTransport {
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@canxjs>`;
    const { host, port } = this.config;
    // Implicit TLS on port 465 or when secure is requested.
    const implicitTls = this.config.secure === true || port === 465;

    const conn = new SmtpConnection();
    const socket = await Bun.connect({
      hostname: host,
      port,
      tls: implicitTls,
      socket: {
        data(_socket: any, data: Uint8Array) {
          conn.onData(data);
        },
        open(sock: any) {
          conn.socket = sock;
        },
        close() {
          conn.onClose();
        },
        error(_socket: any, err: Error) {
          conn.onError(err);
        },
      },
    });
    conn.socket = socket;

    try {
      // 1. Greeting.
      await conn.command('', [220]);

      // 2. EHLO -> capabilities.
      const localName = this.hostname();
      let ehlo = await conn.command(`EHLO ${localName}`, [250]);
      let capabilities = ehlo.lines.map((l) => l.slice(4).toUpperCase());

      // 3. STARTTLS (best-effort) when we're not already on TLS.
      if (!implicitTls && capabilities.some((c) => c.startsWith('STARTTLS'))) {
        try {
          await conn.command('STARTTLS', [220]);
          if (typeof (socket as any).upgradeTLS === 'function') {
            (socket as any).upgradeTLS({
              tls: { serverName: host },
              socket: {
                data(_s: any, data: Uint8Array) {
                  conn.onData(data);
                },
                close() {
                  conn.onClose();
                },
                error(_s: any, err: Error) {
                  conn.onError(err);
                },
              },
            });
            // Re-issue EHLO over the secured channel.
            ehlo = await conn.command(`EHLO ${localName}`, [250]);
            capabilities = ehlo.lines.map((l) => l.slice(4).toUpperCase());
          }
          // If upgradeTLS is unavailable we continue best-effort on the
          // (now STARTTLS-negotiated) plain channel rather than aborting.
        } catch {
          // STARTTLS not usable; fall through and try to AUTH as-is.
        }
      }

      // 4. AUTH.
      const auth = this.config.auth;
      if (auth?.user) {
        const authLine = capabilities.find((c) => c.startsWith('AUTH')) || '';
        const supportsPlain = authLine.includes('PLAIN');
        const supportsLogin = authLine.includes('LOGIN');
        if (supportsPlain || (!supportsLogin && !supportsPlain)) {
          const token = Buffer.from(`\0${auth.user}\0${auth.pass}`).toString('base64');
          await conn.command(`AUTH PLAIN ${token}`, [235]);
        } else {
          await conn.command('AUTH LOGIN', [334]);
          await conn.command(Buffer.from(auth.user).toString('base64'), [334]);
          await conn.command(Buffer.from(auth.pass).toString('base64'), [235]);
        }
      }

      // 5. Envelope.
      const from = parseAddress(message.from || 'noreply@localhost');
      await conn.command(`MAIL FROM:<${from.email}>`, [250]);

      const recipients = [
        ...(message.to || []),
        ...(message.cc || []),
        ...(message.bcc || []),
      ].map((r) => parseAddress(r).email);
      if (recipients.length === 0) throw new Error('SMTP: no recipients');
      for (const rcpt of recipients) {
        await conn.command(`RCPT TO:<${rcpt}>`, [250, 251]);
      }

      // 6. DATA.
      await conn.command('DATA', [354]);
      const mime = buildMimeMessage(message, messageId);
      conn.writeRaw(dotStuff(mime) + '\r\n.\r\n');
      await conn.command('', [250]);

      // 7. QUIT.
      try {
        await conn.command('QUIT', [221]);
      } catch {
        /* server may drop the connection abruptly on QUIT */
      }
    } finally {
      try {
        socket.end();
      } catch {
        /* ignore */
      }
    }

    return { messageId, success: true };
  }

  private hostname(): string {
    try {
      // Prefer a real hostname; fall back to a sane EHLO identifier.
      const h = (globalThis as any)?.process?.env?.HOSTNAME;
      return h || 'localhost';
    } catch {
      return 'localhost';
    }
  }
}

/**
 * Escape a leading '.' on any line (SMTP dot-stuffing) so the message body can
 * never be mistaken for the terminating `\r\n.\r\n` sequence.
 */
export function dotStuff(mime: string): string {
  return mime.replace(/\r\n\./g, '\r\n..').replace(/^\./, '.');
}

/**
 * Build an RFC 5322 / MIME message. Chooses the simplest structure that fits:
 *  - text only        -> text/plain
 *  - html only        -> text/html
 *  - text + html      -> multipart/alternative
 *  - + attachments    -> multipart/mixed wrapping the above
 */
export function buildMimeMessage(message: MailMessage, messageId: string): string {
  const hasHtml = !!message.html;
  const hasText = !!message.text;
  const hasAttachments = !!(message.attachments && message.attachments.length);

  const headers: string[] = [
    `From: ${formatAddress(message.from || 'noreply@localhost')}`,
    `To: ${(message.to || []).map(formatAddress).join(', ')}`,
  ];
  if (message.cc && message.cc.length) headers.push(`Cc: ${message.cc.map(formatAddress).join(', ')}`);
  if (message.replyTo) headers.push(`Reply-To: ${formatAddress(message.replyTo)}`);
  headers.push(`Subject: ${encodeHeader(message.subject)}`);
  headers.push(`Message-ID: ${messageId}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push('MIME-Version: 1.0');
  for (const [k, v] of Object.entries(message.headers || {})) headers.push(`${k}: ${v}`);

  const mixedBoundary = `=_mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `=_alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // The "content" part: either a single text/html body or a multipart/alternative.
  const buildBodyPart = (): string => {
    if (hasText && hasHtml) {
      return [
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        '',
        `--${altBoundary}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        message.text,
        `--${altBoundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        message.html,
        `--${altBoundary}--`,
      ].join('\r\n');
    }
    if (hasHtml) {
      return ['Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', message.html].join(
        '\r\n',
      );
    }
    return ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', message.text || ''].join(
      '\r\n',
    );
  };

  if (!hasAttachments) {
    return `${headers.join('\r\n')}\r\n${buildBodyPart()}`;
  }

  // multipart/mixed: body part + attachments.
  headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
  const parts: string[] = [];
  parts.push(`--${mixedBoundary}`);
  parts.push(buildBodyPart());
  for (const att of message.attachments!) {
    const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
    const b64 = content.toString('base64').replace(/(.{76})/g, '$1\r\n');
    parts.push(`--${mixedBoundary}`);
    parts.push(`Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
    parts.push('');
    parts.push(b64);
  }
  parts.push(`--${mixedBoundary}--`);

  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

/** RFC 2047 encode a header value if it contains non-ASCII characters. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}
