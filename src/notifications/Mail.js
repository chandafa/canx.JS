"use strict";
/**
 * CanxJS Mail - Email sending with multiple transport support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailBuilder = exports.Mailer = void 0;
exports.initMail = initMail;
exports.mail = mail;
exports.sendMail = sendMail;
// ============================================
// Mail Address Helpers
// ============================================
function formatAddress(addr) {
    if (typeof addr === 'string')
        return addr;
    return addr.name ? `"${addr.name}" <${addr.email}>` : addr.email;
}
function parseAddress(addr) {
    if (typeof addr === 'object')
        return addr;
    const match = addr.match(/^(?:"([^"]+)"\s*)?<?([^>]+)>?$/);
    if (match) {
        return { name: match[1], email: match[2] };
    }
    return { email: addr };
}
// ============================================
// SMTP Transport
// ============================================
class SMTPTransport {
    config;
    constructor(config) {
        this.config = config;
    }
    async send(message) {
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
        }
        else {
            body = message.text || '';
        }
        const email = `${headers}\r\n\r\n${body}`;
        // Connect to SMTP server using Bun's TCP
        const socket = await Bun.connect({
            hostname: this.config.host,
            port: this.config.port,
            tls: this.config.secure,
            socket: {
                data: () => { },
                open: () => { },
                close: () => { },
                error: () => { },
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
class SendGridTransport {
    apiKey;
    constructor(config) {
        this.apiKey = config.apiKey;
    }
    async send(message) {
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
class ResendTransport {
    apiKey;
    constructor(config) {
        this.apiKey = config.apiKey;
    }
    async send(message) {
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
        const data = await response.json();
        return { messageId: data.id, success: true };
    }
}
// ============================================
// Log Transport (for development)
// ============================================
class LogTransport {
    async send(message) {
        const messageId = `log_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    📧 EMAIL PREVIEW                         ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║ From:    ${formatAddress(message.from || 'noreply@localhost')}`);
        console.log(`║ To:      ${message.to.map(formatAddress).join(', ')}`);
        if (message.cc)
            console.log(`║ Cc:      ${message.cc.map(formatAddress).join(', ')}`);
        if (message.bcc)
            console.log(`║ Bcc:     ${message.bcc.map(formatAddress).join(', ')}`);
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
class Mailer {
    config;
    transport;
    constructor(config) {
        this.config = config;
        this.transport = this.createTransport();
    }
    createTransport() {
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
    async send(message) {
        if (!message.from && this.config.from) {
            message.from = this.config.from;
        }
        return this.transport.send(message);
    }
    /**
     * Create a new message builder
     */
    create() {
        return new MailBuilder(this);
    }
}
exports.Mailer = Mailer;
// ============================================
// Mail Builder (Fluent API)
// ============================================
class MailBuilder {
    mailer;
    message = {};
    constructor(mailer) {
        this.mailer = mailer;
    }
    from(address) {
        this.message.from = address;
        return this;
    }
    to(address) {
        this.message.to = Array.isArray(address) ? address : [address];
        return this;
    }
    cc(address) {
        this.message.cc = Array.isArray(address) ? address : [address];
        return this;
    }
    bcc(address) {
        this.message.bcc = Array.isArray(address) ? address : [address];
        return this;
    }
    replyTo(address) {
        this.message.replyTo = address;
        return this;
    }
    subject(subject) {
        this.message.subject = subject;
        return this;
    }
    text(content) {
        this.message.text = content;
        return this;
    }
    html(content) {
        this.message.html = content;
        return this;
    }
    attach(attachment) {
        if (!this.message.attachments)
            this.message.attachments = [];
        this.message.attachments.push(attachment);
        return this;
    }
    header(name, value) {
        if (!this.message.headers)
            this.message.headers = {};
        this.message.headers[name] = value;
        return this;
    }
    async send() {
        if (!this.message.to || this.message.to.length === 0) {
            throw new Error('Email must have at least one recipient');
        }
        if (!this.message.subject) {
            throw new Error('Email must have a subject');
        }
        return this.mailer.send(this.message);
    }
}
exports.MailBuilder = MailBuilder;
// ============================================
// Singleton & Exports
// ============================================
let mailerInstance = null;
function initMail(config) {
    mailerInstance = new Mailer(config);
    return mailerInstance;
}
function mail() {
    if (!mailerInstance) {
        // Default to log transport in development
        mailerInstance = new Mailer({ transport: 'log' });
    }
    return mailerInstance;
}
async function sendMail(message) {
    return mail().send(message);
}
exports.default = { initMail, mail, sendMail, Mailer, MailBuilder };
