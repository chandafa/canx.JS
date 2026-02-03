/**
 * CanxJS Notifications - Multi-channel notification system
 */

import { mail, sendMail, type MailMessage } from './Mail';
import { events } from '../events/EventEmitter';

// ============================================
// Types
// ============================================

export type NotificationChannel = 'mail' | 'database' | 'broadcast' | 'sms' | 'slack' | 'push';

export interface NotificationData {
  [key: string]: unknown;
}

export interface Notifiable {
  id: string | number;
  email?: string;
  phone?: string;
  routeNotificationFor(channel: NotificationChannel): string | undefined;
}

// ============================================
// Base Notification Class
// ============================================

export abstract class Notification<T extends NotificationData = NotificationData> {
  public data: T;
  public queue: boolean = false;
  public delay?: number;

  constructor(data: T) {
    this.data = data;
  }

  /**
   * Channels to send the notification through
   */
  abstract via(notifiable: Notifiable): NotificationChannel[];

  /**
   * Email representation
   */
  toMail?(notifiable: Notifiable): MailMessage | Promise<MailMessage>;

  /**
   * Database representation
   */
  toDatabase?(notifiable: Notifiable): Record<string, unknown>;

  /**
   * Broadcast representation (for WebSocket/SSE)
   */
  toBroadcast?(notifiable: Notifiable): { channel: string; event: string; data: unknown };

  /**
   * SMS representation
   */
  toSms?(notifiable: Notifiable): { to: string; message: string };

  /**
   * Slack representation
   */
  toSlack?(notifiable: Notifiable): { webhook: string; message: Record<string, unknown> };

  /**
   * Push notification representation
   */
  toPush?(notifiable: Notifiable): { title: string; body: string; data?: Record<string, unknown> };

  /**
   * Notification type identifier
   */
  type(): string {
    return this.constructor.name;
  }
}

// ============================================
// Notification Sender
// ============================================

class NotificationSender {
  private databaseHandler?: (notifiable: Notifiable, data: Record<string, unknown>) => Promise<void>;
  private broadcastHandler?: (event: { channel: string; event: string; data: unknown }) => void;
  private smsHandler?: (to: string, message: string) => Promise<void>;
  private slackHandler?: (webhook: string, message: Record<string, unknown>) => Promise<void>;
  private pushHandler?: (notifiable: Notifiable, notification: { title: string; body: string; data?: Record<string, unknown> }) => Promise<void>;

  /**
   * Send a notification to a notifiable
   */
  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const channels = notification.via(notifiable);

    for (const channel of channels) {
      try {
        await this.sendViaChannel(notifiable, notification, channel);
        events.emit('notification:sent', { notifiable, notification, channel });
      } catch (error) {
        events.emit('notification:failed', { notifiable, notification, channel, error });
        console.error(`[Notification] Failed to send via ${channel}:`, error);
      }
    }
  }

  /**
   * Send to multiple notifiables
   */
  async sendToMany(notifiables: Notifiable[], notification: Notification): Promise<void> {
    for (const notifiable of notifiables) {
      await this.send(notifiable, notification);
    }
  }

  private async sendViaChannel(
    notifiable: Notifiable,
    notification: Notification,
    channel: NotificationChannel
  ): Promise<void> {
    switch (channel) {
      case 'mail':
        if (notification.toMail) {
          const mailData = await notification.toMail(notifiable);
          const recipient = notifiable.routeNotificationFor('mail') || notifiable.email;
          if (recipient) {
            await sendMail({ ...mailData, to: [recipient] });
          }
        }
        break;

      case 'database':
        if (notification.toDatabase && this.databaseHandler) {
          const data = notification.toDatabase(notifiable);
          await this.databaseHandler(notifiable, {
            type: notification.type(),
            data,
            read_at: null,
            created_at: new Date().toISOString(),
          });
        }
        break;

      case 'broadcast':
        if (notification.toBroadcast && this.broadcastHandler) {
          const broadcastData = notification.toBroadcast(notifiable);
          this.broadcastHandler(broadcastData);
        }
        break;

      case 'sms':
        if (notification.toSms && this.smsHandler) {
          const smsData = notification.toSms(notifiable);
          await this.smsHandler(smsData.to, smsData.message);
        }
        break;

      case 'slack':
        if (notification.toSlack && this.slackHandler) {
          const slackData = notification.toSlack(notifiable);
          await this.slackHandler(slackData.webhook, slackData.message);
        }
        break;

      case 'push':
        if (notification.toPush && this.pushHandler) {
          const pushData = notification.toPush(notifiable);
          await this.pushHandler(notifiable, pushData);
        }
        break;
    }
  }

  /**
   * Register database notification handler
   */
  onDatabase(handler: (notifiable: Notifiable, data: Record<string, unknown>) => Promise<void>): void {
    this.databaseHandler = handler;
  }

  /**
   * Register broadcast handler
   */
  onBroadcast(handler: (event: { channel: string; event: string; data: unknown }) => void): void {
    this.broadcastHandler = handler;
  }

  /**
   * Register SMS handler
   */
  onSms(handler: (to: string, message: string) => Promise<void>): void {
    this.smsHandler = handler;
  }

  /**
   * Register Slack handler
   */
  onSlack(handler: (webhook: string, message: Record<string, unknown>) => Promise<void>): void {
    this.slackHandler = handler;
  }

  /**
   * Register push notification handler
   */
  onPush(handler: (notifiable: Notifiable, notification: { title: string; body: string; data?: Record<string, unknown> }) => Promise<void>): void {
    this.pushHandler = handler;
  }
}

// ============================================
// Notifiable Trait Mixin
// ============================================

export function makeNotifiable<T extends { new(...args: any[]): {} }>(Base: T) {
  return class extends Base implements Notifiable {
    // Properties must be provided by the base class
    id!: string | number;
    email?: string;
    phone?: string;

    routeNotificationFor(channel: NotificationChannel): string | undefined {
      switch (channel) {
        case 'mail':
          return this.email;
        case 'sms':
          return this.phone;
        default:
          return undefined;
      }
    }

    async notify(notification: Notification): Promise<void> {
      await notifications.send(this, notification);
    }
  };
}


// ============================================
// Sample Notifications
// ============================================

export class WelcomeNotification extends Notification<{ name: string }> {
  via(): NotificationChannel[] {
    return ['mail', 'database'];
  }

  toMail(notifiable: Notifiable): MailMessage {
    return {
      to: [notifiable.email || ''],
      subject: `Welcome, ${this.data.name}!`,
      html: `
        <h1>Welcome to CanxJS!</h1>
        <p>Hi ${this.data.name},</p>
        <p>Thank you for joining us. We're excited to have you on board!</p>
      `,
    };
  }

  toDatabase(): Record<string, unknown> {
    return {
      title: 'Welcome!',
      message: `Welcome ${this.data.name}! Thank you for joining.`,
    };
  }
}

export class PasswordResetNotification extends Notification<{ token: string; expires: Date }> {
  via(): NotificationChannel[] {
    return ['mail'];
  }

  toMail(notifiable: Notifiable): MailMessage {
    const resetUrl = `https://example.com/reset-password?token=${this.data.token}`;
    
    return {
      to: [notifiable.email || ''],
      subject: 'Reset Your Password',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link expires on ${this.data.expires.toLocaleString()}.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };
  }
}

// ============================================
// Singleton & Exports
// ============================================

export const notifications = new NotificationSender();

export function notify(notifiable: Notifiable, notification: Notification): Promise<void> {
  return notifications.send(notifiable, notification);
}

export function notifyMany(notifiables: Notifiable[], notification: Notification): Promise<void> {
  return notifications.sendToMany(notifiables, notification);
}

export default { notifications, notify, notifyMany, Notification, makeNotifiable };
