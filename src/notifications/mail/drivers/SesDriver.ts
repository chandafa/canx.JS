import type { MailTransport, MailMessage, MailConfig } from '../types';
import { SmtpDriver } from './SmtpDriver';

/**
 * SesDriver — sends through Amazon SES.
 *
 * Rather than hand-rolling a full AWS SigV4 signer, this delegates to the
 * dependency-free {@link SmtpDriver} against SES's SMTP endpoint
 * (`email-smtp.<region>.amazonaws.com`), using the account's SMTP credentials.
 * SES SMTP requires TLS, so we use implicit TLS on port 465 by default.
 *
 * The `username`/`password` are the SES SMTP credentials (NOT the raw AWS
 * access key / secret — SES derives dedicated SMTP credentials).
 */
export class SesDriver implements MailTransport {
  private smtp: SmtpDriver;

  constructor(config: NonNullable<MailConfig['ses']>) {
    const port = config.port ?? 465;
    this.smtp = new SmtpDriver({
      host: config.host || `email-smtp.${config.region}.amazonaws.com`,
      port,
      secure: config.secure ?? port === 465,
      auth: { user: config.username, pass: config.password },
    });
  }

  send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    return this.smtp.send(message);
  }
}
