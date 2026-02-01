import type { MailTransport, MailMessage } from '../types';
import { formatAddress } from '../types';

export class LogDriver implements MailTransport {
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
