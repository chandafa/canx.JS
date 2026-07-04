import type { MailTransport, MailMessage } from '../types';

/**
 * ArrayDriver — the mail equivalent of Laravel's `Mail::fake()`.
 *
 * It never sends anything over the network; instead every message is captured
 * in the {@link ArrayDriver.sent} array so tests can assert on what was "sent"
 * (e.g. `expect(driver.sent.length).toBe(1)`).
 *
 * A shared {@link ArrayDriver.store} is also kept so tests that only have the
 * mailer config (not the driver instance) can still inspect delivered mail.
 */
export class ArrayDriver implements MailTransport {
  /** Messages captured by this driver instance, in send order. */
  public readonly sent: MailMessage[] = [];

  /** Process-wide capture of every message sent through any ArrayDriver. */
  public static readonly store: MailMessage[] = [];

  async send(message: MailMessage): Promise<{ messageId: string; success: boolean }> {
    this.sent.push(message);
    ArrayDriver.store.push(message);
    const messageId = `array_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { messageId, success: true };
  }

  /** Clear this instance's captured messages. */
  clear(): void {
    this.sent.length = 0;
  }

  /** Clear the shared, process-wide capture. */
  static flush(): void {
    ArrayDriver.store.length = 0;
  }
}
