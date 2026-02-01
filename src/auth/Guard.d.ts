/**
 * CanxJS Auth Guards - Multiple authentication strategies
 * Laravel-compatible guards with TypeScript improvements
 */
import type { CanxRequest, MiddlewareHandler } from '../types';
export interface AuthUser {
    id: string | number;
    [key: string]: unknown;
}
export interface GuardDriver {
    /**
     * Attempt to authenticate request
     */
    authenticate(req: CanxRequest): Promise<AuthUser | null>;
    /**
     * Get current user
     */
    user(): AuthUser | null;
    /**
     * Check if user is authenticated
     */
    check(): boolean;
    /**
     * Set authenticated user
     */
    setUser(user: AuthUser | null): void;
}
export interface GuardConfig {
    driver: string;
    provider?: string;
    [key: string]: unknown;
}
/**
 * Session-based authentication guard
 */
export declare class SessionGuard implements GuardDriver {
    private currentUser;
    private sessionKey;
    constructor(sessionKey?: string);
    authenticate(req: CanxRequest): Promise<AuthUser | null>;
    user(): AuthUser | null;
    check(): boolean;
    setUser(user: AuthUser | null): void;
    private retrieveUser;
}
/**
 * Token-based authentication guard (API tokens)
 */
export declare class TokenGuard implements GuardDriver {
    private currentUser;
    private tokenHeader;
    private tokenPrefix;
    private tokenValidator;
    constructor(tokenHeader?: string, tokenPrefix?: string);
    setValidator(validator: (token: string) => Promise<AuthUser | null>): this;
    authenticate(req: CanxRequest): Promise<AuthUser | null>;
    user(): AuthUser | null;
    check(): boolean;
    setUser(user: AuthUser | null): void;
}
/**
 * JWT-based authentication guard
 */
export declare class JwtGuard implements GuardDriver {
    private currentUser;
    private secret;
    private header;
    private prefix;
    constructor(secret: string, header?: string, prefix?: string);
    authenticate(req: CanxRequest): Promise<AuthUser | null>;
    user(): AuthUser | null;
    check(): boolean;
    setUser(user: AuthUser | null): void;
    private verifyToken;
}
export declare class AuthManager {
    private guards;
    private defaultGuard;
    private currentRequest;
    /**
     * Set the default guard
     */
    setDefaultGuard(name: string): this;
    /**
     * Register a guard
     */
    register(name: string, driver: GuardDriver): this;
    /**
     * Get a guard by name
     */
    guard(name?: string): GuardDriver;
    /**
     * Check if guard exists
     */
    hasGuard(name: string): boolean;
    /**
     * Set current request
     */
    setRequest(req: CanxRequest): this;
    /**
     * Authenticate with guard
     */
    authenticate(guardName?: string): Promise<AuthUser | null>;
    /**
     * Get current user
     */
    user(guardName?: string): AuthUser | null;
    /**
     * Check if authenticated
     */
    check(guardName?: string): boolean;
    /**
     * Get available guards
     */
    getGuards(): string[];
}
/**
 * Create authentication middleware for a guard
 */
export declare function authMiddleware(guardName?: string): MiddlewareHandler;
/**
 * Require authentication middleware
 */
export declare function requireAuth(guardName?: string): MiddlewareHandler;
/**
 * Guest only middleware (deny authenticated users)
 */
export declare function guestOnly(guardName?: string): MiddlewareHandler;
export declare const authManager: AuthManager;
/**
 * Initialize auth with guards
 */
export declare function initAuth(config: {
    default?: string;
    guards: Record<string, {
        driver: 'session' | 'token' | 'jwt';
        options?: Record<string, unknown>;
    }>;
}): AuthManager;
export { AuthManager as Guard };
export default authManager;
