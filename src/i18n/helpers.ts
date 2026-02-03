import { translator } from './Translator';
import { getRequestInstance } from '../container/Scope';

/**
 * Translate a key
 */
export function __(key: string, replace: Record<string, any> = {}, locale?: string): string {
  // Try to get locale from context if not provided
  if (!locale) {
      try {
          const ctxLocale = getRequestInstance<string>('locale');
          if (ctxLocale) {
              locale = ctxLocale;
          }
      } catch (e) { /* ignore */ }
  }
  
  return translator.get(key, replace, locale);
}

/**
 * Translate alias
 */
export function trans(key: string, replace: Record<string, any> = {}, locale?: string): string {
  return __(key, replace, locale);
}

/**
 * Choice alias
 */
export function trans_choice(key: string, number: number, replace: Record<string, any> = {}, locale?: string): string {
   const line = __(key, replace, locale);
   // ... simplistic choice logic same as translator
   return translator.choice(key, number, replace, locale);
}
