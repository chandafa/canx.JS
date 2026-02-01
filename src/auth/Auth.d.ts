/**
 * CanxJS Auth - Built-in Authentication System
 * JWT + Session + OAuth2 support
 */
import type { MiddlewareHandler } from '../types';
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
interface JWTPayload {
    sub: string | number;
    iat: number;
    exp: number;
    [key: string]: unknown;
}
interface JWTConfig {
    secret: string;
    expiresIn?: number;
    algorithm?: 'HS256' | 'HS384' | 'HS512';
}
export declare function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'> & {
    sub: string | number;
}, config: JWTConfig): Promise<string>;
export declare function verifyJWT(token: string, config: JWTConfig): Promise<JWTPayload | null>;
interface AuthConfig {
    secret: string;
    tokenHeader?: string;
    tokenPrefix?: string;
    userProperty?: string;
}
export declare function jwtAuth(config: AuthConfig): MiddlewareHandler;
export declare function optionalAuth(config: AuthConfig): MiddlewareHandler;
export declare function protect(config: AuthConfig): MiddlewareHandler;
export declare function guest(): MiddlewareHandler;
export declare function roles(...allowedRoles: string[]): MiddlewareHandler;
export interface Session {
    id: string;
    userId: string | number;
    data: Record<string, unknown>;
    expiresAt: number;
}
export interface SessionDriver {
    create(userId: string | number, data: Record<string, unknown>, maxAge: number): Promise<Session> | Session;
    get(id: string): Promise<Session | null> | Session | null;
    destroy(id: string): Promise<boolean> | boolean;
    cleanup(): Promise<void> | void;
}
export declare class MemorySessionDriver implements SessionDriver {
    private sessions;
    generateId(): string;
    create(userId: string | number, data?: Record<string, unknown>, maxAge?: number): Session;
    get(id: string): Session | null;
    destroy(id: string): boolean;
    cleanup(): void;
}
export declare class SessionStore {
    private driver;
    constructor(driver?: SessionDriver);
    useDatabase(): void;
    use(driver: SessionDriver): void;
    create(userId: string | number, data?: Record<string, unknown>, maxAge?: number): Promise<Session>;
    get(id: string): Promise<Session | null>;
    destroy(id: string): Promise<boolean>;
    cleanup(): Promise<void>;
}
export declare const sessionStore: SessionStore;
export declare function sessionAuth(cookieName?: string): MiddlewareHandler;
export declare const auth: {
    hash: typeof hashPassword;
    verify: typeof verifyPassword;
    sign: typeof signJWT;
    verifyToken: typeof verifyJWT;
    jwt: typeof jwtAuth;
    optional: typeof optionalAuth;
    protect: typeof protect;
    guest: typeof guest;
    roles: typeof roles;
    session: typeof sessionAuth;
    sessions: SessionStore;
};
export { DatabaseSessionDriver } from './drivers/DatabaseSessionDriver';
export default auth;
