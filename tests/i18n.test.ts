import { describe, expect, test, beforeEach } from 'bun:test';
import { I18n, initI18n, useI18n, t, plural } from '../src/utils/i18n';

describe('I18n', () => {
  describe('I18n Class', () => {
    let i18n: I18n;

    beforeEach(() => {
      i18n = new I18n({
        defaultLocale: 'en',
        locales: ['en', 'id'],
      });
    });

    test('should initialize with default locale', () => {
      expect(i18n.getLocale()).toBe('en');
    });

    test('should get available locales', () => {
      expect(i18n.getLocales()).toEqual(['en', 'id']);
    });

    test('should set locale', () => {
      i18n.setLocale('id');
      expect(i18n.getLocale()).toBe('id');
    });

    test('should load translations', async () => {
      await i18n.load('en', {
        welcome: 'Welcome',
        greeting: 'Hello, {name}!',
      });
      
      expect(i18n.t('welcome')).toBe('Welcome');
    });

    test('should translate with interpolation', async () => {
      await i18n.load('en', {
        greeting: 'Hello, {name}!',
      });
      
      expect(i18n.t('greeting', { name: 'John' })).toBe('Hello, John!');
    });

    test('should return key if translation not found', () => {
      expect(i18n.t('unknown.key')).toBe('unknown.key');
    });

    test('should check if translation exists', async () => {
      await i18n.load('en', { exists: 'I exist' });
      
      expect(i18n.has('exists')).toBe(true);
      expect(i18n.has('notexists')).toBe(false);
    });

    test('should support nested translations', async () => {
      await i18n.load('en', {
        messages: {
          welcome: 'Welcome to our app',
        },
      });
      
      expect(i18n.t('messages.welcome')).toBe('Welcome to our app');
    });

    test('should add translations dynamically', () => {
      i18n.add('en', 'dynamic', 'Dynamic value');
      expect(i18n.t('dynamic')).toBe('Dynamic value');
    });
  });

  describe('Pluralization', () => {
    let i18n: I18n;

    beforeEach(async () => {
      i18n = new I18n({
        defaultLocale: 'en',
        locales: ['en'],
      });
      
      await i18n.load('en', {
        items: {
          one: '{count} item',
          other: '{count} items',
        },
      });
    });

    test('should pluralize correctly for one', () => {
      expect(i18n.plural('items', 1, { count: 1 })).toBe('1 item');
    });

    test('should pluralize correctly for many', () => {
      expect(i18n.plural('items', 5, { count: 5 })).toBe('5 items');
    });
  });

  describe('Locale Detection', () => {
    let i18n: I18n;

    beforeEach(() => {
      i18n = new I18n({
        defaultLocale: 'en',
        locales: ['en', 'id', 'fr'],
        autoDetect: true,
      });
    });

    test('should detect locale from Accept-Language header', () => {
      expect(i18n.detectLocale('en-US,en;q=0.9')).toBe('en');
      expect(i18n.detectLocale('id-ID,id;q=0.9')).toBe('id');
    });

    test('should fallback to default locale if not supported', () => {
      expect(i18n.detectLocale('ja-JP,ja;q=0.9')).toBe('en');
    });

    test('should handle null Accept-Language', () => {
      expect(i18n.detectLocale(null)).toBe('en');
    });
  });

  describe('Singleton Functions', () => {
    test('initI18n should create singleton', () => {
      const instance = initI18n({
        defaultLocale: 'en',
        locales: ['en'],
      });
      
      expect(instance).toBeInstanceOf(I18n);
    });

    test('useI18n should return singleton', () => {
      initI18n({ defaultLocale: 'en', locales: ['en'] });
      const instance = useI18n();
      expect(instance).toBeInstanceOf(I18n);
    });
  });
});
