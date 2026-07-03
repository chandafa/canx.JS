/**
 * CanxJS Auth Guards - Multiple authentication strategies
 * Laravel-compatible guards with TypeScript improvements
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';
import { SessionGuard } from './guards/SessionGuard';
import { TokenGuard } from './guards/TokenGuard';
import { JwtGuard } from './guards/JwtGuard';

// Re-export guards
export { SessionGuard, TokenGuard, JwtGuard };

// ============================================
// Per-request auth context (prevents cross-request user leaks)
// ============================================

interface AuthContextStore {
  request: CanxRequest | null;
  users: Map<string, unknown>;
}

// Holds the current request's auth state. Established by the auth middleware so
// concurrent requests never share `currentUser` on a singleton guard instance.
const authContext = new AsyncLocalStorage<AuthContextStore>();

/** Run a callback inside a fresh per-request auth context. */
export function runInAuthContext<T>(req: CanxRequest, fn: () => T): T {
  return authContext.run({ request: req, users: new Map() }, fn);
}

// ============================================
// Types
// ============================================

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

// ============================================
// Auth Manager
// ============================================

export class AuthManager {
  private guards: Map<string, GuardDriver> = new Map();
  private defaultGuard: string = 'web';
  private currentRequest: CanxRequest | null = null;

  /**
   * Set the default guard
   */
  setDefaultGuard(name: string): this {
    this.defaultGuard = name;
    return this;
  }

  /**
   * Register a guard
   */
  register(name: string, driver: GuardDriver): this {
    this.guards.set(name, driver);
    return this;
  }

  /**
   * Get a guard by name
   */
  guard(name?: string): GuardDriver {
    const guardName = name || this.defaultGuard;
    const guard = this.guards.get(guardName);
    
    if (!guard) {
      throw new Error(`Guard [${guardName}] is not defined.`);
    }
    
    return guard;
  }

  /**
   * Check if guard exists
   */
  hasGuard(name: string): boolean {
    return this.guards.has(name);
  }

  /**
   * Set current request. Prefers the per-request auth context (so concurrent
   * requests stay isolated); falls back to an instance field otherwise.
   */
  setRequest(req: CanxRequest): this {
    const store = authContext.getStore();
    if (store) store.request = req;
    else this.currentRequest = req;
    return this;
  }

  private getRequest(): CanxRequest | null {
    return authContext.getStore()?.request ?? this.currentRequest;
  }

  /**
   * Authenticate with guard. Result is cached in the per-request context so
   * user()/check() return the right user even under concurrency.
   */
  async authenticate(guardName?: string): Promise<AuthUser | null> {
    const req = this.getRequest();
    if (!req) {
      throw new Error('No request set. Call setRequest() first.');
    }

    const name = guardName || this.defaultGuard;
    const guard = this.guard(name);
    const user = await guard.authenticate(req);

    const store = authContext.getStore();
    if (store) store.users.set(name, user);
    return user;
  }

  /**
   * Get current user (from the per-request context when available).
   */
  user(guardName?: string): AuthUser | null {
    const name = guardName || this.defaultGuard;
    const store = authContext.getStore();
    if (store && store.users.has(name)) {
      return (store.users.get(name) as AuthUser | null) ?? null;
    }
    return this.guard(name).user();
  }

  /**
   * Check if authenticated
   */
  check(guardName?: string): boolean {
    return this.user(guardName) !== null;
  }

  /**
   * Get available guards
   */
  getGuards(): string[] {
    return Array.from(this.guards.keys());
  }
}

// ============================================
// Auth Middleware
// ============================================

/**
 * Create authentication middleware for a guard
 */
export function authMiddleware(guardName?: string): MiddlewareHandler {
  return async (req, res, next) => {
    return runInAuthContext(req, async () => {
      authManager.setRequest(req);
      const user = await authManager.authenticate(guardName);

      if (user) {
        req.user = user;
        req.context?.set('user', user);
        req.context?.set('guard', guardName || authManager['defaultGuard']);
      }

      return next();
    });
  };
}

/**
 * Require authentication middleware
 */
export function requireAuth(guardName?: string): MiddlewareHandler {
  return async (req, res, next) => {
    return runInAuthContext(req, async () => {
      authManager.setRequest(req);
      const user = await authManager.authenticate(guardName);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      req.user = user;
      req.context?.set('user', user);
      return next();
    });
  };
}

/**
 * Guest only middleware (deny authenticated users)
 */
export function guestOnly(guardName?: string): MiddlewareHandler {
  return async (req, res, next) => {
    return runInAuthContext(req, async () => {
      authManager.setRequest(req);
      const user = await authManager.authenticate(guardName);

      if (user) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Already authenticated',
        });
      }

      return next();
    });
  };
}

// ============================================
// Global Auth Manager Instance
// ============================================

export const authManager = new AuthManager();

/**
 * Initialize auth with guards
 */
export function initAuth(config: {
  default?: string;
  guards: Record<string, { driver: 'session' | 'token' | 'jwt'; options?: Record<string, unknown> }>;
}): AuthManager {
  if (config.default) {
    authManager.setDefaultGuard(config.default);
  }

  for (const [name, guardConfig] of Object.entries(config.guards)) {
    let driver: GuardDriver;

    switch (guardConfig.driver) {
      case 'session':
        driver = new SessionGuard(guardConfig.options?.sessionKey as string);
        break;
      case 'token':
        driver = new TokenGuard(
          guardConfig.options?.header as string,
          guardConfig.options?.prefix as string
        );
        break;
      case 'jwt':
        driver = new JwtGuard(
          guardConfig.options?.secret as string || process.env.JWT_SECRET || 'secret',
          guardConfig.options?.header as string,
          guardConfig.options?.prefix as string
        );
        break;
      default:
        throw new Error(`Unknown guard driver: ${guardConfig.driver}`);
    }

    authManager.register(name, driver);
  }

  return authManager;
}

export { AuthManager as Guard };
export default authManager;
