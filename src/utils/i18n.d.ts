/**
 * CanxJS Internationalization (i18n) - Multi-language support
 */
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
export declare class I18n {
    private translations;
    private currentLocale;
    private config;
    constructor(config: I18nConfig);
    /**
     * Set current locale
     */
    setLocale(locale: string): void;
    /**
     * Get current locale
     */
    getLocale(): string;
    /**
     * Get all available locales
     */
    getLocales(): string[];
    /**
     * Load translations for a locale
     */
    load(locale: string, translations: TranslationObject): Promise<void>;
    /**
     * Load translations from file
     */
    loadFromFile(locale: string): Promise<void>;
    /**
     * Load all configured locales
     */
    loadAll(): Promise<void>;
    /**
     * Translate a key
     */
    t(key: string, params?: Record<string, string | number>, locale?: string): string;
    /**
     * Translate with pluralization
     */
    plural(key: string, count: number, params?: Record<string, string | number>, locale?: string): string;
    /**
     * Check if translation exists
     */
    has(key: string, locale?: string): boolean;
    /**
     * Get all translations for current locale
     */
    all(locale?: string): TranslationObject | undefined;
    /**
     * Add translations dynamically
     */
    add(locale: string, key: string, value: string): void;
    /**
     * Detect locale from request headers
     */
    detectLocale(acceptLanguage: string | null): string;
    private getNestedValue;
    private interpolate;
    private getPluralKey;
}
import type { MiddlewareHandler } from '../types';
export declare function i18nMiddleware(i18n: I18n): MiddlewareHandler;
export declare function initI18n(config: I18nConfig): I18n;
export declare function useI18n(): I18n;
export declare function t(key: string, params?: Record<string, string | number>): string;
export declare function plural(key: string, count: number, params?: Record<string, string | number>): string;
declare const _default: {
    I18n: typeof I18n;
    initI18n: typeof initI18n;
    useI18n: typeof useI18n;
    t: typeof t;
    plural: typeof plural;
    i18nMiddleware: typeof i18nMiddleware;
};
export default _default;
