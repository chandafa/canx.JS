/**
 * CanxJS Distributed Sessions - Session storage across multiple instances
 * @description Redis-backed session management for horizontal scaling
 */

export interface DistributedSessionConfig {
  /** Session prefix in storage */
  prefix?: string;
  /** Session TTL in seconds */
  ttl?: number;
  /** Cookie name */
  cookieName?: string;
  /** Cookie options */
  cookie?: {
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  };
  /** Generate session ID */
  generateId?: () => string;
}

export interface SessionData {
  [key: string]: unknown;
}

export interface SessionStore {
  get(key: string): Promise<SessionData | null>;
  set(key: string, data: SessionData, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  touch(key: string, ttl: number): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * In-memory session store (for development/single instance)
 */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, { data: SessionData; expiresAt: number }>();

  async get(key: string): Promise<SessionData | null> {
    const session = this.sessions.get(key);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(key);
      return null;
    }
    return session.data;
  }

  async set(key: string, data: SessionData, ttl: number = 3600): Promise<void> {
    this.sessions.set(key, {
      data,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.sessions.delete(key);
  }

  async touch(key: string, ttl: number): Promise<void> {
    const session = this.sessions.get(key);
    if (session) {
      session.expiresAt = Date.now() + ttl * 1000;
    }
  }

  async exists(key: string): Promise<boolean> {
    const session = this.sessions.get(key);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(key);
      return false;
    }
    return true;
  }
}

/**
 * Redis session store (for distributed sessions)
 */
export class RedisSessionStore implements SessionStore {
  private redis: any; // Redis client instance
  private prefix: string;

  constructor(redisClient: any, prefix: string = 'sess:') {
    this.redis = redisClient;
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<SessionData | null> {
    const data = await this.redis.get(this.getKey(key));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set(key: string, data: SessionData, ttl: number = 3600): Promise<void> {
    await this.redis.setex(this.getKey(key), ttl, JSON.stringify(data));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }

  async touch(key: string, ttl: number): Promise<void> {
    await this.redis.expire(this.getKey(key), ttl);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(this.getKey(key));
    return result === 1;
  }
}

/**
 * Distributed Session Manager
 */
export class DistributedSession {
  private config: Required<DistributedSessionConfig>;
  private store: SessionStore;

  constructor(store: SessionStore, config: DistributedSessionConfig = {}) {
    this.store = store;
    this.config = {
      prefix: config.prefix ?? 'sess:',
      ttl: config.ttl ?? 86400, // 24 hours
      cookieName: config.cookieName ?? 'canx_session',
      cookie: {
        path: config.cookie?.path ?? '/',
        domain: config.cookie?.domain,
        secure: config.cookie?.secure ?? process.env.NODE_ENV === 'production',
        httpOnly: config.cookie?.httpOnly ?? true,
        sameSite: config.cookie?.sameSite ?? 'lax',
      },
      generateId: config.generateId ?? (() => crypto.randomUUID()),
    };
  }

  /**
   * Get session by ID
   */
  async get(sessionId: string): Promise<SessionData | null> {
    return this.store.get(sessionId);
  }

  /**
   * Create new session
   */
  async create(data: SessionData = {}): Promise<string> {
    const sessionId = this.config.generateId();
    await this.store.set(sessionId, data, this.config.ttl);
    return sessionId;
  }

  /**
   * Update session data
   */
  async update(sessionId: string, data: SessionData): Promise<void> {
    await this.store.set(sessionId, data, this.config.ttl);
  }

  /**
   * Destroy session
   */
  async destroy(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }

  /**
   * Refresh session TTL
   */
  async refresh(sessionId: string): Promise<void> {
    await this.store.touch(sessionId, this.config.ttl);
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    return this.store.exists(sessionId);
  }

  /**
   * Get cookie name
   */
  getCookieName(): string {
    return this.config.cookieName;
  }

  /**
   * Generate cookie string
   */
  getCookieString(sessionId: string): string {
    const parts = [`${this.config.cookieName}=${sessionId}`];
    
    if (this.config.cookie.path) {
      parts.push(`Path=${this.config.cookie.path}`);
    }
    if (this.config.cookie.domain) {
      parts.push(`Domain=${this.config.cookie.domain}`);
    }
    if (this.config.cookie.secure) {
      parts.push('Secure');
    }
    if (this.config.cookie.httpOnly) {
      parts.push('HttpOnly');
    }
    if (this.config.cookie.sameSite) {
      parts.push(`SameSite=${this.config.cookie.sameSite}`);
    }
    parts.push(`Max-Age=${this.config.ttl}`);
    
    return parts.join('; ');
  }

  /**
   * Get clear cookie string
   */
  getClearCookieString(): string {
    return `${this.config.cookieName}=; Max-Age=0; Path=${this.config.cookie.path ?? '/'}`;
  }
}

/**
 * Session middleware factory
 */
export function distributedSessionMiddleware(sessionManager: DistributedSession) {
  return async (req: any, res: any, next: () => Promise<Response | void>): Promise<Response | void> => {
    const cookieName = sessionManager.getCookieName();
    let sessionId = req.cookie(cookieName);
    let isNew = false;

    if (!sessionId || !(await sessionManager.exists(sessionId))) {
      sessionId = await sessionManager.create();
      isNew = true;
    }

    // Load session data
    const sessionData = await sessionManager.get(sessionId) ?? {};

    // Attach to request
    req.session = {
      id: sessionId,
      data: sessionData,
      isNew,
      
      get: <T = unknown>(key: string): T | undefined => sessionData[key] as T,
      set: (key: string, value: unknown) => { sessionData[key] = value; },
      delete: (key: string) => { delete sessionData[key]; },
      clear: () => { Object.keys(sessionData).forEach(k => delete sessionData[k]); },
      
      save: async () => {
        await sessionManager.update(sessionId, sessionData);
      },
      
      destroy: async () => {
        await sessionManager.destroy(sessionId);
      },
      
      regenerate: async () => {
        await sessionManager.destroy(sessionId);
        sessionId = await sessionManager.create(sessionData);
        req.session.id = sessionId;
        req.session.isNew = true;
      },
    };

    // Call next handler
    const response = await next();

    // Save session and set cookie
    await req.session.save();
    
    if (response && isNew) {
      const cookie = sessionManager.getCookieString(sessionId);
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  };
}

// ============================================
// Exports
// ============================================

let defaultSessionManager: DistributedSession | null = null;

export function initDistributedSessions(
  store: SessionStore,
  config?: DistributedSessionConfig
): DistributedSession {
  defaultSessionManager = new DistributedSession(store, config);
  return defaultSessionManager;
}

export function distributedSession(): DistributedSession {
  if (!defaultSessionManager) {
    defaultSessionManager = new DistributedSession(new MemorySessionStore());
  }
  return defaultSessionManager;
}

export default DistributedSession;
