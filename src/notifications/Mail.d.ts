/**
 * CanxJS Mail - Email sending with multiple transport support
 */
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
    send(message: MailMessage): Promise<{
        messageId: string;
        success: boolean;
    }>;
}
export declare class Mailer {
    private config;
    private transport;
    constructor(config: MailConfig);
    private createTransport;
    /**
     * Send an email
     */
    send(message: MailMessage): Promise<{
        messageId: string;
        success: boolean;
    }>;
    /**
     * Create a new message builder
     */
    create(): MailBuilder;
}
export declare class MailBuilder {
    private mailer;
    private message;
    constructor(mailer: Mailer);
    from(address: MailAddress | string): this;
    to(address: MailAddress | string | (MailAddress | string)[]): this;
    cc(address: MailAddress | string | (MailAddress | string)[]): this;
    bcc(address: MailAddress | string | (MailAddress | string)[]): this;
    replyTo(address: MailAddress | string): this;
    subject(subject: string): this;
    text(content: string): this;
    html(content: string): this;
    attach(attachment: MailAttachment): this;
    header(name: string, value: string): this;
    send(): Promise<{
        messageId: string;
        success: boolean;
    }>;
}
export declare function initMail(config: MailConfig): Mailer;
export declare function mail(): Mailer;
export declare function sendMail(message: MailMessage): Promise<{
    messageId: string;
    success: boolean;
}>;
declare const _default: {
    initMail: typeof initMail;
    mail: typeof mail;
    sendMail: typeof sendMail;
    Mailer: typeof Mailer;
    MailBuilder: typeof MailBuilder;
};
export default _default;
