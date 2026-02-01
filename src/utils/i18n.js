"use strict";
/**
 * CanxJS Internationalization (i18n) - Multi-language support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18n = void 0;
exports.i18nMiddleware = i18nMiddleware;
exports.initI18n = initI18n;
exports.useI18n = useI18n;
exports.t = t;
exports.plural = plural;
// ============================================
// I18n Class
// ============================================
class I18n {
    translations = new Map();
    currentLocale;
    config;
    constructor(config) {
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
    setLocale(locale) {
        if (this.config.locales.includes(locale)) {
            this.currentLocale = locale;
        }
        else {
            console.warn(`[i18n] Locale "${locale}" is not in available locales. Using fallback.`);
            this.currentLocale = this.config.fallbackLocale || this.config.defaultLocale;
        }
    }
    /**
     * Get current locale
     */
    getLocale() {
        return this.currentLocale;
    }
    /**
     * Get all available locales
     */
    getLocales() {
        return this.config.locales;
    }
    /**
     * Load translations for a locale
     */
    async load(locale, translations) {
        this.translations.set(locale, translations);
    }
    /**
     * Load translations from file
     */
    async loadFromFile(locale) {
        try {
            const path = `${this.config.directory}/${locale}.json`;
            const file = Bun.file(path);
            const content = await file.text();
            const translations = JSON.parse(content);
            this.translations.set(locale, translations);
            console.log(`[i18n] Loaded translations for: ${locale}`);
        }
        catch (error) {
            console.error(`[i18n] Failed to load translations for ${locale}:`, error);
        }
    }
    /**
     * Load all configured locales
     */
    async loadAll() {
        for (const locale of this.config.locales) {
            await this.loadFromFile(locale);
        }
    }
    /**
     * Translate a key
     */
    t(key, params, locale) {
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
    plural(key, count, params, locale) {
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
    has(key, locale) {
        const targetLocale = locale || this.currentLocale;
        const translations = this.translations.get(targetLocale);
        return this.getNestedValue(translations, key) !== undefined;
    }
    /**
     * Get all translations for current locale
     */
    all(locale) {
        return this.translations.get(locale || this.currentLocale);
    }
    /**
     * Add translations dynamically
     */
    add(locale, key, value) {
        let translations = this.translations.get(locale);
        if (!translations) {
            translations = {};
            this.translations.set(locale, translations);
        }
        // Support nested keys
        const keys = key.split('.');
        let current = translations;
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
    detectLocale(acceptLanguage) {
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
    getNestedValue(obj, key) {
        if (!obj)
            return undefined;
        const keys = key.split('.');
        let current = obj;
        for (const k of keys) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[k];
        }
        return current;
    }
    interpolate(str, params) {
        return str.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? String(params[key]) : match;
        });
    }
    getPluralKey(count, locale) {
        // Simplified plural rules (English-like)
        // For full CLDR support, would need more complex rules
        if (count === 0)
            return 'zero';
        if (count === 1)
            return 'one';
        if (count === 2)
            return 'two';
        if (count >= 3 && count <= 10)
            return 'few';
        if (count >= 11 && count <= 99)
            return 'many';
        return 'other';
    }
}
exports.I18n = I18n;
function i18nMiddleware(i18n) {
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
let i18nInstance = null;
function initI18n(config) {
    i18nInstance = new I18n(config);
    return i18nInstance;
}
function useI18n() {
    if (!i18nInstance) {
        throw new Error('[i18n] Not initialized. Call initI18n() first.');
    }
    return i18nInstance;
}
function t(key, params) {
    return useI18n().t(key, params);
}
function plural(key, count, params) {
    return useI18n().plural(key, count, params);
}
exports.default = { I18n, initI18n, useI18n, t, plural, i18nMiddleware };
