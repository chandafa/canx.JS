"use strict";
/**
 * CanxJS Notifications - Multi-channel notification system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifications = exports.PasswordResetNotification = exports.WelcomeNotification = exports.Notification = void 0;
exports.makeNotifiable = makeNotifiable;
exports.notify = notify;
exports.notifyMany = notifyMany;
const Mail_1 = require("./Mail");
const EventEmitter_1 = require("../events/EventEmitter");
// ============================================
// Base Notification Class
// ============================================
class Notification {
    data;
    queue = false;
    delay;
    constructor(data) {
        this.data = data;
    }
    /**
     * Notification type identifier
     */
    type() {
        return this.constructor.name;
    }
}
exports.Notification = Notification;
// ============================================
// Notification Sender
// ============================================
class NotificationSender {
    databaseHandler;
    broadcastHandler;
    smsHandler;
    slackHandler;
    pushHandler;
    /**
     * Send a notification to a notifiable
     */
    async send(notifiable, notification) {
        const channels = notification.via(notifiable);
        for (const channel of channels) {
            try {
                await this.sendViaChannel(notifiable, notification, channel);
                EventEmitter_1.events.emit('notification:sent', { notifiable, notification, channel });
            }
            catch (error) {
                EventEmitter_1.events.emit('notification:failed', { notifiable, notification, channel, error });
                console.error(`[Notification] Failed to send via ${channel}:`, error);
            }
        }
    }
    /**
     * Send to multiple notifiables
     */
    async sendToMany(notifiables, notification) {
        for (const notifiable of notifiables) {
            await this.send(notifiable, notification);
        }
    }
    async sendViaChannel(notifiable, notification, channel) {
        switch (channel) {
            case 'mail':
                if (notification.toMail) {
                    const mailData = await notification.toMail(notifiable);
                    const recipient = notifiable.routeNotificationFor('mail') || notifiable.email;
                    if (recipient) {
                        await (0, Mail_1.sendMail)({ ...mailData, to: [recipient] });
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
    onDatabase(handler) {
        this.databaseHandler = handler;
    }
    /**
     * Register broadcast handler
     */
    onBroadcast(handler) {
        this.broadcastHandler = handler;
    }
    /**
     * Register SMS handler
     */
    onSms(handler) {
        this.smsHandler = handler;
    }
    /**
     * Register Slack handler
     */
    onSlack(handler) {
        this.slackHandler = handler;
    }
    /**
     * Register push notification handler
     */
    onPush(handler) {
        this.pushHandler = handler;
    }
}
// ============================================
// Notifiable Trait Mixin
// ============================================
function makeNotifiable(Base) {
    return class extends Base {
        id;
        email;
        phone;
        routeNotificationFor(channel) {
            switch (channel) {
                case 'mail':
                    return this.email;
                case 'sms':
                    return this.phone;
                default:
                    return undefined;
            }
        }
        async notify(notification) {
            await exports.notifications.send(this, notification);
        }
    };
}
// ============================================
// Sample Notifications
// ============================================
class WelcomeNotification extends Notification {
    via() {
        return ['mail', 'database'];
    }
    toMail(notifiable) {
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
    toDatabase() {
        return {
            title: 'Welcome!',
            message: `Welcome ${this.data.name}! Thank you for joining.`,
        };
    }
}
exports.WelcomeNotification = WelcomeNotification;
class PasswordResetNotification extends Notification {
    via() {
        return ['mail'];
    }
    toMail(notifiable) {
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
exports.PasswordResetNotification = PasswordResetNotification;
// ============================================
// Singleton & Exports
// ============================================
exports.notifications = new NotificationSender();
function notify(notifiable, notification) {
    return exports.notifications.send(notifiable, notification);
}
function notifyMany(notifiables, notification) {
    return exports.notifications.sendToMany(notifiables, notification);
}
exports.default = { notifications: exports.notifications, notify, notifyMany, Notification, makeNotifiable };
