/**
 * Notifications Module Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { 
  initMail, 
  mail, 
  sendMail, 
  Mailer, 
  MailBuilder 
} from '../src/notifications/Mail';
import { 
  Notification, 
  notifications, 
  notify, 
  notifyMany, 
  makeNotifiable 
} from '../src/notifications/Notification';

// ============================================
// Test: Mailer Class
// ============================================

describe('Mailer', () => {
  test('should create instance with log transport', () => {
    const mailer = new Mailer({ transport: 'log' });
    expect(mailer).toBeInstanceOf(Mailer);
  });

  test('should throw error for smtp without config', () => {
    expect(() => {
      new Mailer({ transport: 'smtp' });
    }).toThrow('SMTP config requirement missing');
  });

  test('should throw error for sendgrid without config', () => {
    expect(() => {
      new Mailer({ transport: 'sendgrid' });
    }).toThrow('SendGrid config requirement missing');
  });

  test('should throw error for resend without config', () => {
    expect(() => {
      new Mailer({ transport: 'resend' });
    }).toThrow('Resend config requirement missing');
  });

  test('should have send() method', () => {
    const mailer = new Mailer({ transport: 'log' });
    expect(typeof mailer.send).toBe('function');
  });

  test('should have create() method', () => {
    const mailer = new Mailer({ transport: 'log' });
    expect(typeof mailer.create).toBe('function');
  });

  test('create() should return MailBuilder', () => {
    const mailer = new Mailer({ transport: 'log' });
    const builder = mailer.create();
    expect(builder).toBeInstanceOf(MailBuilder);
  });
});

// ============================================
// Test: MailBuilder (Fluent API)
// ============================================

describe('MailBuilder', () => {
  let mailer: Mailer;
  
  beforeEach(() => {
    mailer = new Mailer({ transport: 'log' });
  });

  test('should create instance', () => {
    const builder = new MailBuilder(mailer);
    expect(builder).toBeInstanceOf(MailBuilder);
  });

  test('from() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.from('test@example.com');
    expect(result).toBe(builder);
  });

  test('to() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.to('recipient@example.com');
    expect(result).toBe(builder);
  });

  test('to() should accept array of addresses', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.to(['a@test.com', 'b@test.com']);
    expect(result).toBe(builder);
  });

  test('cc() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.cc('cc@example.com');
    expect(result).toBe(builder);
  });

  test('bcc() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.bcc('bcc@example.com');
    expect(result).toBe(builder);
  });

  test('replyTo() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.replyTo('reply@example.com');
    expect(result).toBe(builder);
  });

  test('subject() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.subject('Test Subject');
    expect(result).toBe(builder);
  });

  test('text() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.text('Plain text content');
    expect(result).toBe(builder);
  });

  test('html() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.html('<p>HTML content</p>');
    expect(result).toBe(builder);
  });

  test('attach() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.attach({
      filename: 'test.txt',
      content: 'Test content'
    });
    expect(result).toBe(builder);
  });

  test('header() should be chainable', () => {
    const builder = new MailBuilder(mailer);
    const result = builder.header('X-Custom', 'value');
    expect(result).toBe(builder);
  });

  test('send() should throw without recipient', async () => {
    const builder = new MailBuilder(mailer)
      .subject('Test')
      .text('Content');
    
    await expect(builder.send()).rejects.toThrow('Email must have at least one recipient');
  });

  test('send() should throw without subject', async () => {
    const builder = new MailBuilder(mailer)
      .to('test@example.com')
      .text('Content');
    
    await expect(builder.send()).rejects.toThrow('Email must have a subject');
  });

  test('send() should succeed with valid message', async () => {
    const builder = new MailBuilder(mailer)
      .from('sender@test.com')
      .to('recipient@test.com')
      .subject('Test Email')
      .text('Test content');
    
    const result = await builder.send();
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
});

// ============================================
// Test: Mail Singleton Functions
// ============================================

describe('Mail Singleton', () => {
  test('initMail() should initialize and return mailer', () => {
    const mailer = initMail({ transport: 'log' });
    expect(mailer).toBeInstanceOf(Mailer);
  });

  test('mail() should return mailer instance', () => {
    const mailer = mail();
    expect(mailer).toBeInstanceOf(Mailer);
  });

  test('sendMail() should send email', async () => {
    const result = await sendMail({
      from: 'sender@test.com',
      to: ['recipient@test.com'],
      subject: 'Test',
      text: 'Test content'
    });
    
    expect(result.success).toBe(true);
  });
});

// ============================================
// Test: Notification Class
// ============================================

describe('Notification', () => {
  class TestNotification extends Notification<{ message: string }> {
    via() {
      return ['mail' as const, 'database' as const];
    }

    toMail() {
      return {
        to: ['test@example.com'],
        subject: 'Test Notification',
        text: this.data.message
      };
    }

    toDatabase() {
      return {
        type: 'test',
        message: this.data.message
      };
    }
  }

  test('should create notification with data', () => {
    const notification = new TestNotification({ message: 'Hello' });
    expect(notification.data.message).toBe('Hello');
  });

  test('via() should return channels', () => {
    const notification = new TestNotification({ message: 'Test' });
    const channels = notification.via({} as any);
    expect(channels).toContain('mail');
    expect(channels).toContain('database');
  });

  test('toMail() should return mail message', () => {
    const notification = new TestNotification({ message: 'Email content' });
    const mailData = notification.toMail({} as any);
    expect(mailData.subject).toBe('Test Notification');
  });

  test('toDatabase() should return database record', () => {
    const notification = new TestNotification({ message: 'DB content' });
    const dbData = notification.toDatabase({} as any);
    expect(dbData.type).toBe('test');
    expect(dbData.message).toBe('DB content');
  });

  test('type() should return class name', () => {
    const notification = new TestNotification({ message: 'Test' });
    const type = notification.type();
    expect(type).toBe('TestNotification');
  });

  test('queue property should default to false', () => {
    const notification = new TestNotification({ message: 'Test' });
    expect(notification.queue).toBe(false);
  });
});

// ============================================
// Test: NotificationSender (Singleton)
// ============================================

describe('NotificationSender', () => {
  test('notifications should be defined', () => {
    expect(notifications).toBeDefined();
  });

  test('notify() should be a function', () => {
    expect(typeof notify).toBe('function');
  });

  test('notifyMany() should be a function', () => {
    expect(typeof notifyMany).toBe('function');
  });
});

// ============================================
// Test: makeNotifiable Mixin
// ============================================

describe('makeNotifiable', () => {
  class BaseUser {}

  const NotifiableUser = makeNotifiable(BaseUser);

  test('should add routeNotificationFor method', () => {
    const user = new NotifiableUser();
    expect(typeof user.routeNotificationFor).toBe('function');
  });

  test('should add notify method', () => {
    const user = new NotifiableUser();
    expect(typeof user.notify).toBe('function');
  });

  test('routeNotificationFor should be callable', () => {
    const user = new NotifiableUser();
    // Without email set, should return undefined
    const route = user.routeNotificationFor('mail');
    expect(route).toBeUndefined();
  });

  test('routeNotificationFor unknown channel should return undefined', () => {
    const user = new NotifiableUser();
    const route = user.routeNotificationFor('database');
    expect(route).toBeUndefined();
  });

  test('should properly set and get email when assigned', () => {
    const user = new NotifiableUser();
    user.email = 'test@example.com';
    expect(user.routeNotificationFor('mail')).toBe('test@example.com');
  });

  test('should properly set and get phone when assigned', () => {
    const user = new NotifiableUser();
    user.phone = '+1234567890';
    expect(user.routeNotificationFor('sms')).toBe('+1234567890');
  });
});
