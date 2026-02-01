/**
 * CanxJS CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */
import type { MiddlewareHandler } from '../types';
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
/**
 * CSRF Protection Middleware
 */
export declare function csrf(config?: CsrfConfig): MiddlewareHandler;
/**
 * Helper to generate CSRF hidden input for forms
 */
export declare function csrfField(token: string): string;
/**
 * Helper to get CSRF meta tag for AJAX
 */
export declare function csrfMeta(token: string): string;
export default csrf;
