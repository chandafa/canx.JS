/**
 * CanxJS SMS Channel
 * 
 * SMS notification channel with support for Twilio and Vonage.
 * Similar to Laravel's SMS channel for notifications.
 */

// ============================================
// Types
// ============================================

export interface SmsMessage {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
}

export interface SmsDriverConfig {
  from?: string;
  [key: string]: unknown;
}

export interface SmsDriver {
  name: string;
  send(message: SmsMessage): Promise<SmsResult>;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  cost?: number;
}

export interface TwilioConfig extends SmsDriverConfig {
  accountSid: string;
  authToken: string;
  from: string;
  messagingServiceSid?: string;
}

export interface VonageConfig extends SmsDriverConfig {
  apiKey: string;
  apiSecret: string;
  from: string;
  signatureSecret?: string;
}

// ============================================
// Twilio Driver
// ============================================

export class TwilioDriver implements SmsDriver {
  name = 'twilio';
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    const { accountSid, authToken, messagingServiceSid } = this.config;
    const from = message.from || this.config.from;

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      
      const body = new URLSearchParams({
        To: message.to,
        Body: message.body,
        ...(messagingServiceSid 
          ? { MessagingServiceSid: messagingServiceSid }
          : { From: from }),
      });

      // Add media URLs if present
      if (message.mediaUrl) {
        message.mediaUrl.forEach((url, index) => {
          body.append(`MediaUrl[${index}]`, url);
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Twilio API error',
          provider: 'twilio',
        };
      }

      return {
        success: true,
        messageId: data.sid,
        provider: 'twilio',
        cost: parseFloat(data.price) || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'twilio',
      };
    }
  }
}

// ============================================
// Vonage Driver
// ============================================

export class VonageDriver implements SmsDriver {
  name = 'vonage';
  private config: VonageConfig;

  constructor(config: VonageConfig) {
    this.config = config;
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    const { apiKey, apiSecret } = this.config;
    const from = message.from || this.config.from;

    try {
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          from,
          to: message.to,
          text: message.body,
        }),
      });

      const data = await response.json() as any;
      const firstMessage = data.messages?.[0];

      if (firstMessage?.status !== '0') {
        return {
          success: false,
          error: firstMessage?.['error-text'] || 'Vonage API error',
          provider: 'vonage',
        };
      }

      return {
        success: true,
        messageId: firstMessage?.['message-id'],
        provider: 'vonage',
        cost: parseFloat(firstMessage?.['message-price']) || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'vonage',
      };
    }
  }
}

// ============================================
// Log Driver (for testing)
// ============================================

export class LogSmsDriver implements SmsDriver {
  name = 'log';
  private logs: SmsMessage[] = [];

  async send(message: SmsMessage): Promise<SmsResult> {
    console.log('[SMS]', message.to, ':', message.body);
    this.logs.push(message);
    
    return {
      success: true,
      messageId: `log_${Date.now()}`,
      provider: 'log',
    };
  }

  getLogs(): SmsMessage[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

// ============================================
// SMS Manager
// ============================================

export class SmsManager {
  private drivers: Map<string, SmsDriver> = new Map();
  private defaultDriver: string = 'log';

  /**
   * Register a driver
   */
  driver(name: string, driver: SmsDriver): this {
    this.drivers.set(name, driver);
    return this;
  }

  /**
   * Set the default driver
   */
  via(name: string): this {
    this.defaultDriver = name;
    return this;
  }

  /**
   * Get a driver instance
   */
  getDriver(name?: string): SmsDriver {
    const driverName = name || this.defaultDriver;
    const driver = this.drivers.get(driverName);
    
    if (!driver) {
      throw new Error(`SMS driver "${driverName}" not configured`);
    }
    
    return driver;
  }

  /**
   * Send an SMS message
   */
  async send(to: string, body: string, from?: string): Promise<SmsResult> {
    const message: SmsMessage = { to, body, from };
    return this.getDriver().send(message);
  }

  /**
   * Send a raw message object
   */
  async raw(message: SmsMessage): Promise<SmsResult> {
    return this.getDriver().send(message);
  }

  /**
   * Configure Twilio driver
   */
  twilio(config: TwilioConfig): this {
    return this.driver('twilio', new TwilioDriver(config));
  }

  /**
   * Configure Vonage driver
   */
  vonage(config: VonageConfig): this {
    return this.driver('vonage', new VonageDriver(config));
  }

  /**
   * Configure log driver (default)
   */
  log(): this {
    return this.driver('log', new LogSmsDriver());
  }
}

// ============================================
// Global Instance
// ============================================

let smsInstance: SmsManager | null = null;

/**
 * Initialize SMS manager
 */
export function initSms(config?: { default?: string }): SmsManager {
  smsInstance = new SmsManager();
  smsInstance.log(); // Always register log driver
  
  if (config?.default) {
    smsInstance.via(config.default);
  }
  
  return smsInstance;
}

/**
 * Get the global SMS manager
 */
export function sms(): SmsManager {
  if (!smsInstance) {
    smsInstance = initSms();
  }
  return smsInstance;
}

/**
 * Send an SMS (shorthand)
 * 
 * @example
 * await sendSms('+1234567890', 'Hello from CanxJS!');
 */
export async function sendSms(to: string, body: string, from?: string): Promise<SmsResult> {
  return sms().send(to, body, from);
}

// ============================================
// SMS Notification Channel
// ============================================

/**
 * SMS channel for the notification system
 */
export class SmsChannel {
  private manager: SmsManager;

  constructor(manager?: SmsManager) {
    this.manager = manager || sms();
  }

  /**
   * Send notification via SMS
   */
  async send(notifiable: { phone?: string; routeNotificationFor?(channel: string): string | undefined }, notification: { toSms?(notifiable: any): SmsMessage | string }): Promise<SmsResult | null> {
    // Get phone number
    const phone = notifiable.routeNotificationFor?.('sms') || notifiable.phone;
    
    if (!phone) {
      console.warn('[SmsChannel] No phone number for notifiable');
      return null;
    }

    // Get SMS content
    const smsContent = notification.toSms?.(notifiable);
    
    if (!smsContent) {
      console.warn('[SmsChannel] Notification does not implement toSms()');
      return null;
    }

    // Build message
    const message: SmsMessage = typeof smsContent === 'string'
      ? { to: phone, body: smsContent }
      : { ...smsContent, to: smsContent.to || phone };

    return this.manager.raw(message);
  }
}
