/**
 * CanxJS Notifications - Multi-channel notification system
 */
import { type MailMessage } from './Mail';
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
export declare abstract class Notification<T extends NotificationData = NotificationData> {
    data: T;
    queue: boolean;
    delay?: number;
    constructor(data: T);
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
    toBroadcast?(notifiable: Notifiable): {
        channel: string;
        event: string;
        data: unknown;
    };
    /**
     * SMS representation
     */
    toSms?(notifiable: Notifiable): {
        to: string;
        message: string;
    };
    /**
     * Slack representation
     */
    toSlack?(notifiable: Notifiable): {
        webhook: string;
        message: Record<string, unknown>;
    };
    /**
     * Push notification representation
     */
    toPush?(notifiable: Notifiable): {
        title: string;
        body: string;
        data?: Record<string, unknown>;
    };
    /**
     * Notification type identifier
     */
    type(): string;
}
declare class NotificationSender {
    private databaseHandler?;
    private broadcastHandler?;
    private smsHandler?;
    private slackHandler?;
    private pushHandler?;
    /**
     * Send a notification to a notifiable
     */
    send(notifiable: Notifiable, notification: Notification): Promise<void>;
    /**
     * Send to multiple notifiables
     */
    sendToMany(notifiables: Notifiable[], notification: Notification): Promise<void>;
    private sendViaChannel;
    /**
     * Register database notification handler
     */
    onDatabase(handler: (notifiable: Notifiable, data: Record<string, unknown>) => Promise<void>): void;
    /**
     * Register broadcast handler
     */
    onBroadcast(handler: (event: {
        channel: string;
        event: string;
        data: unknown;
    }) => void): void;
    /**
     * Register SMS handler
     */
    onSms(handler: (to: string, message: string) => Promise<void>): void;
    /**
     * Register Slack handler
     */
    onSlack(handler: (webhook: string, message: Record<string, unknown>) => Promise<void>): void;
    /**
     * Register push notification handler
     */
    onPush(handler: (notifiable: Notifiable, notification: {
        title: string;
        body: string;
        data?: Record<string, unknown>;
    }) => Promise<void>): void;
}
export declare function makeNotifiable<T extends {
    new (...args: any[]): {};
}>(Base: T): {
    new (...args: any[]): {
        id: string | number;
        email?: string;
        phone?: string;
        routeNotificationFor(channel: NotificationChannel): string | undefined;
        notify(notification: Notification): Promise<void>;
    };
} & T;
export declare class WelcomeNotification extends Notification<{
    name: string;
}> {
    via(): NotificationChannel[];
    toMail(notifiable: Notifiable): MailMessage;
    toDatabase(): Record<string, unknown>;
}
export declare class PasswordResetNotification extends Notification<{
    token: string;
    expires: Date;
}> {
    via(): NotificationChannel[];
    toMail(notifiable: Notifiable): MailMessage;
}
export declare const notifications: NotificationSender;
export declare function notify(notifiable: Notifiable, notification: Notification): Promise<void>;
export declare function notifyMany(notifiables: Notifiable[], notification: Notification): Promise<void>;
declare const _default: {
    notifications: NotificationSender;
    notify: typeof notify;
    notifyMany: typeof notifyMany;
    Notification: typeof Notification;
    makeNotifiable: typeof makeNotifiable;
};
export default _default;
