import type { MiddlewareHandler } from '../types';
export interface SecurityConfig {
    xssProtection?: boolean;
    contentTypeOptions?: boolean;
    frameOptions?: 'DENY' | 'SAMEORIGIN';
    hsts?: boolean | {
        maxAge: number;
        includeSubDomains: boolean;
    };
    contentSecurityPolicy?: string;
    referrerPolicy?: string;
}
export declare function security(config?: SecurityConfig): MiddlewareHandler;
