/**
 * CanxJS Internationalization (i18n) - Multi-language support
 */

// ============================================
// Types
// ============================================

export type TranslationValue = string | TranslationObject;
export interface TranslationObject {
  [key: string]: TranslationValue;
}

export interface I18nConfig {
  defaultLocale: string;
  fallbackLocale?: string;
  locales: string[];
  directory?: string;
  autoDetect?: boolean;
}

export interface Pluralization {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

// ============================================
// I18n Class
// ============================================

export class I18n {
  private translations: Map<string, TranslationObject> = new Map();
  private currentLocale: string;
  private config: I18nConfig;

  constructor(config: I18nConfig) {
    this.config = {
      fallbackLocale: config.defaultLocale,
      directory: './locales',
      autoDetect: true,
      ...config,
    };
    this.currentLocale = config.defaultLocale;
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (this.config.locales.includes(locale)) {
      this.currentLocale = locale;
    } else {
      console.warn(`[i18n] Locale "${locale}" is not in available locales. Using fallback.`);
      this.currentLocale = this.config.fallbackLocale || this.config.defaultLocale;
    }
  }

  /**
   * Get current locale
   */
  getLocale(): string {
    return this.currentLocale;
  }

  /**
   * Get all available locales
   */
  getLocales(): string[] {
    return this.config.locales;
  }

  /**
   * Load translations for a locale
   */
  async load(locale: string, translations: TranslationObject): Promise<void> {
    this.translations.set(locale, translations);
  }

  /**
   * Load translations from file
   */
  async loadFromFile(locale: string): Promise<void> {
    try {
      const path = `${this.config.directory}/${locale}.json`;
      const file = Bun.file(path);
      const content = await file.text();
      const translations = JSON.parse(content);
      this.translations.set(locale, translations);
      console.log(`[i18n] Loaded translations for: ${locale}`);
    } catch (error) {
      console.error(`[i18n] Failed to load translations for ${locale}:`, error);
    }
  }

  /**
   * Load all configured locales
   */
  async loadAll(): Promise<void> {
    for (const locale of this.config.locales) {
      await this.loadFromFile(locale);
    }
  }

  /**
   * Translate a key
   */
  t(key: string, params?: Record<string, string | number>, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    const translations = this.translations.get(targetLocale);

    let value = this.getNestedValue(translations, key);

    // Fallback to default locale
    if (value === undefined && this.config.fallbackLocale && targetLocale !== this.config.fallbackLocale) {
      const fallbackTranslations = this.translations.get(this.config.fallbackLocale);
      value = this.getNestedValue(fallbackTranslations, key);
    }

    // Return key if translation not found
    if (value === undefined) {
      console.warn(`[i18n] Missing translation: ${key} (${targetLocale})`);
      return key;
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters
    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  /**
   * Translate with pluralization
   */
  plural(key: string, count: number, params?: Record<string, string | number>, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    const translations = this.translations.get(targetLocale);
    const pluralKey = this.getPluralKey(count, targetLocale);

    // Try specific plural form
    let value = this.getNestedValue(translations, `${key}.${pluralKey}`);

    // Fallback to 'other'
    if (value === undefined) {
      value = this.getNestedValue(translations, `${key}.other`);
    }

    // Fallback to base key
    if (value === undefined) {
      value = this.getNestedValue(translations, key);
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Add count to params
    const allParams = { ...params, count };
    return this.interpolate(value, allParams);
  }

  /**
   * Check if translation exists
   */
  has(key: string, locale?: string): boolean {
    const targetLocale = locale || this.currentLocale;
    const translations = this.translations.get(targetLocale);
    return this.getNestedValue(translations, key) !== undefined;
  }

  /**
   * Get all translations for current locale
   */
  all(locale?: string): TranslationObject | undefined {
    return this.translations.get(locale || this.currentLocale);
  }

  /**
   * Add translations dynamically
   */
  add(locale: string, key: string, value: string): void {
    let translations = this.translations.get(locale);
    if (!translations) {
      translations = {};
      this.translations.set(locale, translations);
    }

    // Support nested keys
    const keys = key.split('.');
    let current: any = translations;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Detect locale from request headers
   */
  detectLocale(acceptLanguage: string | null): string {
    if (!acceptLanguage) {
      return this.config.defaultLocale;
    }

    // Parse Accept-Language header
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [locale, q] = lang.trim().split(';q=');
        return {
          locale: locale.split('-')[0], // Get base language
          quality: q ? parseFloat(q) : 1,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first matching locale
    for (const { locale } of languages) {
      if (this.config.locales.includes(locale)) {
        return locale;
      }
    }

    return this.config.defaultLocale;
  }

  // ============================================
  // Private Helpers
  // ============================================

  private getNestedValue(obj: TranslationObject | undefined, key: string): TranslationValue | undefined {
    if (!obj) return undefined;

    const keys = key.split('.');
    let current: any = obj;

    for (const k of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[k];
    }

    return current;
  }

  private interpolate(str: string, params: Record<string, string | number>): string {
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  private getPluralKey(count: number, locale: string): string {
    // Simplified plural rules (English-like)
    // For full CLDR support, would need more complex rules
    if (count === 0) return 'zero';
    if (count === 1) return 'one';
    if (count === 2) return 'two';
    if (count >= 3 && count <= 10) return 'few';
    if (count >= 11 && count <= 99) return 'many';
    return 'other';
  }
}

// ============================================
// i18n Middleware
// ============================================

import type { MiddlewareHandler } from '../types';

export function i18nMiddleware(i18n: I18n): MiddlewareHandler {
  return async (req, res, next) => {
    // Try to get locale from query param
    const queryLocale = req.query.lang || req.query.locale;
    if (typeof queryLocale === 'string' && i18n.getLocales().includes(queryLocale)) {
      i18n.setLocale(queryLocale);
      req.context.set('locale', queryLocale);
      return next();
    }

    // Try to get locale from cookie
    const cookieLocale = req.cookie('locale');
    if (cookieLocale && i18n.getLocales().includes(cookieLocale)) {
      i18n.setLocale(cookieLocale);
      req.context.set('locale', cookieLocale);
      return next();
    }

    // Auto-detect from Accept-Language header
    const detected = i18n.detectLocale(req.header('accept-language'));
    i18n.setLocale(detected);
    req.context.set('locale', detected);

    return next();
  };
}

// ============================================
// Singleton & Exports
// ============================================

let i18nInstance: I18n | null = null;

export function initI18n(config: I18nConfig): I18n {
  i18nInstance = new I18n(config);
  return i18nInstance;
}

export function useI18n(): I18n {
  if (!i18nInstance) {
    throw new Error('[i18n] Not initialized. Call initI18n() first.');
  }
  return i18nInstance;
}

export function t(key: string, params?: Record<string, string | number>): string {
  return useI18n().t(key, params);
}

export function plural(key: string, count: number, params?: Record<string, string | number>): string {
  return useI18n().plural(key, count, params);
}

export default { I18n, initI18n, useI18n, t, plural, i18nMiddleware };
