/**
 * CanxJS Auth Guards - Multiple authentication strategies
 * Laravel-compatible guards with TypeScript improvements
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

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
// Guard Drivers
// ============================================

/**
 * Session-based authentication guard
 */
export class SessionGuard implements GuardDriver {
  private currentUser: AuthUser | null = null;
  private sessionKey: string;

  constructor(sessionKey: string = 'user_id') {
    this.sessionKey = sessionKey;
  }

  async authenticate(req: CanxRequest): Promise<AuthUser | null> {
    // Get user from session
    const session = req.context?.get('session') as Record<string, unknown> | undefined;
    if (session && session[this.sessionKey]) {
      this.currentUser = await this.retrieveUser(session[this.sessionKey] as string | number);
      return this.currentUser;
    }
    return null;
  }

  user(): AuthUser | null {
    return this.currentUser;
  }

  check(): boolean {
    return this.currentUser !== null;
  }

  setUser(user: AuthUser | null): void {
    this.currentUser = user;
  }

  private async retrieveUser(id: string | number): Promise<AuthUser | null> {
    // This would be overridden or configured to use a user provider
    return { id };
  }
}

/**
 * Token-based authentication guard (API tokens)
 */
export class TokenGuard implements GuardDriver {
  private currentUser: AuthUser | null = null;
  private tokenHeader: string;
  private tokenPrefix: string;
  private tokenValidator: ((token: string) => Promise<AuthUser | null>) | null = null;

  constructor(tokenHeader: string = 'Authorization', tokenPrefix: string = 'Bearer ') {
    this.tokenHeader = tokenHeader;
    this.tokenPrefix = tokenPrefix;
  }

  setValidator(validator: (token: string) => Promise<AuthUser | null>): this {
    this.tokenValidator = validator;
    return this;
  }

  async authenticate(req: CanxRequest): Promise<AuthUser | null> {
    const header = req.headers.get(this.tokenHeader);
    if (!header) return null;

    let token = header;
    if (this.tokenPrefix && header.startsWith(this.tokenPrefix)) {
      token = header.slice(this.tokenPrefix.length);
    }

    if (this.tokenValidator) {
      this.currentUser = await this.tokenValidator(token);
    }

    return this.currentUser;
  }

  user(): AuthUser | null {
    return this.currentUser;
  }

  check(): boolean {
    return this.currentUser !== null;
  }

  setUser(user: AuthUser | null): void {
    this.currentUser = user;
  }
}

/**
 * JWT-based authentication guard
 */
export class JwtGuard implements GuardDriver {
  private currentUser: AuthUser | null = null;
  private secret: string;
  private header: string;
  private prefix: string;

  constructor(secret: string, header: string = 'Authorization', prefix: string = 'Bearer ') {
    this.secret = secret;
    this.header = header;
    this.prefix = prefix;
  }

  async authenticate(req: CanxRequest): Promise<AuthUser | null> {
    const authHeader = req.headers.get(this.header);
    if (!authHeader) return null;

    let token = authHeader;
    if (this.prefix && authHeader.startsWith(this.prefix)) {
      token = authHeader.slice(this.prefix.length);
    }

    try {
      const payload = await this.verifyToken(token);
      if (payload && typeof payload === 'object') {
        this.currentUser = payload as AuthUser;
        return this.currentUser;
      }
    } catch {
      return null;
    }

    return null;
  }

  user(): AuthUser | null {
    return this.currentUser;
  }

  check(): boolean {
    return this.currentUser !== null;
  }

  setUser(user: AuthUser | null): void {
    this.currentUser = user;
  }

  private async verifyToken(token: string): Promise<unknown> {
    // Simple JWT verification using Bun
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const keyData = encoder.encode(this.secret);
    
    const hmac = new Bun.CryptoHasher('sha256', keyData);
    hmac.update(data);
    const expectedSignature = hmac.digest('base64url');

    if (expectedSignature !== signatureB64) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error('Token expired');
    }

    return payload;
  }
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
   * Set current request
   */
  setRequest(req: CanxRequest): this {
    this.currentRequest = req;
    return this;
  }

  /**
   * Authenticate with guard
   */
  async authenticate(guardName?: string): Promise<AuthUser | null> {
    if (!this.currentRequest) {
      throw new Error('No request set. Call setRequest() first.');
    }
    
    const guard = this.guard(guardName);
    return guard.authenticate(this.currentRequest);
  }

  /**
   * Get current user
   */
  user(guardName?: string): AuthUser | null {
    return this.guard(guardName).user();
  }

  /**
   * Check if authenticated
   */
  check(guardName?: string): boolean {
    return this.guard(guardName).check();
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
    authManager.setRequest(req);
    const user = await authManager.authenticate(guardName);
    
    if (user) {
      req.user = user;
      req.context?.set('user', user);
      req.context?.set('guard', guardName || authManager['defaultGuard']);
    }
    
    return next();
  };
}

/**
 * Require authentication middleware
 */
export function requireAuth(guardName?: string): MiddlewareHandler {
  return async (req, res, next) => {
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
  };
}

/**
 * Guest only middleware (deny authenticated users)
 */
export function guestOnly(guardName?: string): MiddlewareHandler {
  return async (req, res, next) => {
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
