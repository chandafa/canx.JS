import { Translator, translator } from './Translator';
import type { CanxRequest, CanxResponse, NextFunction } from '../types';
import { setRequestInstance } from '../container/Scope';

export interface LocalizationConfig {
   default: string;
   fallback: string;
   supported: string[];
}

export function localizationMiddleware(config: Partial<LocalizationConfig> = {}) {
  const supported = config.supported || ['en'];
  const defaultLocale = config.default || 'en';

  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    // 1. Check Query
    let locale = req.query.lang as string;

    // 2. Check Header
    if (!locale && req.headers.get('accept-language')) {
        const accept = req.headers.get('accept-language');
        // Simple parse: "en-US,en;q=0.9" -> "en"
        if (accept) {
             const parts = accept.split(',')[0].split(';')[0].trim(); // en-US
             // Check exact or base
             if (supported.includes(parts)) locale = parts;
             else if (supported.includes(parts.split('-')[0])) locale = parts.split('-')[0];
        }
    }
    
    // 3. Check X-Localization header
    if (!locale && req.headers.get('x-localization')) {
        locale = req.headers.get('x-localization')!;
    }

    // 4. Fallback
    if (!locale || !supported.includes(locale)) {
        locale = defaultLocale;
    }

    // Set to request
    req.locale = locale;
    
    // Set to scope context for global helpers
    setRequestInstance('locale', locale);
    
    req.t = (key: string, replace?: any) => translator.get(key, replace, locale);
    req.getLocale = () => locale;

    return next();
  };
}
