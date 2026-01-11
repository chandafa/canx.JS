import type { MiddlewareHandler } from '../types';

export interface SecurityConfig {
  xssProtection?: boolean;
  contentTypeOptions?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN';
  hsts?: boolean | { maxAge: number; includeSubDomains: boolean };
  contentSecurityPolicy?: string;
  referrerPolicy?: string;
}

export function security(config: SecurityConfig = {}): MiddlewareHandler {
  return async (req, res, next) => {
    // X-XSS-Protection
    if (config.xssProtection !== false) {
      res.header('X-XSS-Protection', '1; mode=block');
    }

    // X-Content-Type-Options
    if (config.contentTypeOptions !== false) {
      res.header('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (config.frameOptions) {
      res.header('X-Frame-Options', config.frameOptions);
    } else if (config.frameOptions !== undefined) {
      // Allow if explicit string (e.g. ALLOW-FROM) - though deprecated
      res.header('X-Frame-Options', config.frameOptions);
    } else {
        // Default deny if not specified? Or standard default?
        // Modern default is usually SAMEORIGIN or DENY. Let's do SAMEORIGIN.
         res.header('X-Frame-Options', 'SAMEORIGIN');
    }

    // Strict-Transport-Security
    if (config.hsts) {
      const maxAge = typeof config.hsts === 'object' ? config.hsts.maxAge : 31536000;
      const includeSubDomains = typeof config.hsts === 'object' && config.hsts.includeSubDomains ? '; includeSubDomains' : '';
      res.header('Strict-Transport-Security', `max-age=${maxAge}${includeSubDomains}`);
    }

    // Content-Security-Policy
    if (config.contentSecurityPolicy) {
      res.header('Content-Security-Policy', config.contentSecurityPolicy);
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      res.header('Referrer-Policy', config.referrerPolicy);
    }

    return next();
  };
}
