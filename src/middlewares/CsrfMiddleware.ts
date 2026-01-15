/**
 * CanxJS CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

import type { MiddlewareHandler, CanxRequest, CanxResponse } from '../types';

export interface CsrfConfig {
  /** Cookie name for CSRF token */
  cookieName?: string;
  /** Header name for CSRF token */
  headerName?: string;
  /** Form field name for CSRF token */
  fieldName?: string;
  /** HTTP methods to protect */
  methods?: string[];
  /** Token expiry in seconds */
  maxAge?: number;
  /** Paths to exclude from CSRF protection */
  ignorePaths?: string[];
}

const DEFAULT_CONFIG: Required<CsrfConfig> = {
  cookieName: 'csrf_token',
  headerName: 'x-csrf-token',
  fieldName: '_csrf',
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  maxAge: 3600,
  ignorePaths: [],
};

/**
 * Generate a random CSRF token
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * CSRF Protection Middleware
 */
export function csrf(config: CsrfConfig = {}): MiddlewareHandler {
  const opts = { ...DEFAULT_CONFIG, ...config };

  return async (req: CanxRequest, res: CanxResponse, next) => {
    // Check if path should be ignored
    if (opts.ignorePaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    // Get or create token
    let token = req.cookie(opts.cookieName);
    if (!token) {
      token = generateToken();
      res.cookie(opts.cookieName, token, {
        httpOnly: true,
        sameSite: 'Strict',
        maxAge: opts.maxAge,
        path: '/',
      });
    }

    // Attach token to request for use in views
    (req as any).csrfToken = token;
    (req as any).getCsrfToken = () => token;

    // Skip validation for safe methods
    if (!opts.methods.includes(req.method)) {
      return next();
    }

    // Get token from header or body
    const headerToken = req.header(opts.headerName);
    let bodyToken: string | undefined;

    try {
      const body = await req.body<Record<string, string>>();
      bodyToken = body?.[opts.fieldName];
    } catch {
      // Body might not be parseable
    }

    const submittedToken = headerToken || bodyToken;

    // Validate token
    if (!submittedToken || submittedToken !== token) {
      return res.status(403).json({
        error: 'CSRF token mismatch',
        message: 'Invalid or missing CSRF token',
      });
    }

    return next();
  };
}

/**
 * Helper to generate CSRF hidden input for forms
 */
export function csrfField(token: string): string {
  return `<input type="hidden" name="_csrf" value="${token}" />`;
}

/**
 * Helper to get CSRF meta tag for AJAX
 */
export function csrfMeta(token: string): string {
  return `<meta name="csrf-token" content="${token}" />`;
}

export default csrf;
