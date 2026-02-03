import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface TranslatorConfig {
  locale: string;
  fallbackLocale: string;
  path: string;
}

export class Translator {
  private static instance: Translator;
  private locale: string = 'en';
  private fallbackLocale: string = 'en';
  private path: string = '';
  private loaded: Record<string, Record<string, any>> = {};

  constructor(config?: Partial<TranslatorConfig>) {
    this.locale = config?.locale || 'en';
    this.fallbackLocale = config?.fallbackLocale || 'en';
    this.path = config?.path || join(process.cwd(), 'lang');
  }

  public static getInstance(): Translator {
    if (!Translator.instance) {
      Translator.instance = new Translator();
    }
    return Translator.instance;
  }

  public setLocale(locale: string) {
    this.locale = locale;
  }

  public getLocale(): string {
    return this.locale;
  }

  public setPath(path: string) {
    this.path = path;
  }

  /**
   * Get a translation
   * @param key "messages.welcome"
   * @param replace { name: 'Chan' }
   * @param locale 'id'
   */
  public get(key: string, replace: Record<string, any> = {}, locale?: string): string {
    const targetLocale = locale || this.locale;
    
    // Parse key: "messages.welcome" -> file "messages", key "welcome"
    const parts = key.split('.');
    const file = parts[0];
    const path = parts.slice(1).join('.');

    // Load file if needed
    this.load(file, targetLocale);

    // Get line
    let line = this.getLine(file, path, targetLocale);
    
    // Fallback if missing
    if (!line && targetLocale !== this.fallbackLocale) {
      this.load(file, this.fallbackLocale);
      line = this.getLine(file, path, this.fallbackLocale);
    }

    // Return key if still missing
    if (!line) return key;

    // Replacements
    return this.makeReplacements(line, replace);
  }

  /**
   * Alias for get
   */
  public trans(key: string, replace: Record<string, any> = {}, locale?: string): string {
    return this.get(key, replace, locale);
  }

  private load(file: string, locale: string) {
    const key = `${locale}.${file}`;
    if (this.loaded[key]) return;

    this.loaded[key] = {};

    // Try JSON
    const jsonPath = join(this.path, locale, `${file}.json`);
    const rootJsonPath = join(this.path, `${locale}.json`);
    
    // Check for lang/en/messages.json
    if (existsSync(jsonPath)) {
        try {
            this.loaded[key] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
            return;
        } catch(e) { /* ignore */ }
    }

    // Check for lang/en.json (if file is matching key parts, rarely used in this structure but possible)
    // Actually standard structure is lang/en/messages.php (or json)
    
    // Also try .ts/.js
    // Dynamic import is async, which is hard for synchronous __() helper.
    // For now, we strongly recommend JSON or we need an async init phase.
    // Since this is node/bun, we can require() if it's commonjs, but ESM is tricky.
    // LET'S STICK TO JSON FOR SYNC OPERATIONS FOR NOW as it's safest for a synchronous helper.
    // Or we could read .js file and eval it? No, unsafe. 
    // We will support JSON only for the MVP sync version, or read TS files as text and parse simple objects if desperate, but JSON is standard for i18n.
  }

  private getLine(file: string, path: string, locale: string): string | null {
    const bucket = this.loaded[`${locale}.${file}`];
    if (!bucket) return null;

    if (!path) return null; // "messages" only?

    return path.split('.').reduce((obj, key) => obj?.[key], bucket) as unknown as string || null;
  }

  private makeReplacements(line: string, replace: Record<string, any>): string {
    if (typeof line !== 'string') return line;

    return Object.keys(replace).reduce((result, key) => {
      const value = replace[key];
      return result.replace(new RegExp(`:${key}`, 'g'), String(value));
    }, line);
  }
  
  /**
   * Choice / Pluralization
   * Simple implementation: "Apples|Apple" (not standard, but simple start)
   * Or standard: "{0} There are no apples|{1} There is one apple|[2,*] There are :count apples"
   */
  public choice(key: string, number: number, replace: Record<string, any> = {}, locale?: string): string {
    const line = this.get(key, replace, locale);
    const parts = line.split('|');
    
    // Very basic pluralizer
    if (parts.length === 1) return line;
    
    if (number > 1 && parts.length > 1) return this.makeReplacements(parts[1], { ...replace, count: number });
    return this.makeReplacements(parts[0], { ...replace, count: number });
  }
}

export const translator = Translator.getInstance();
