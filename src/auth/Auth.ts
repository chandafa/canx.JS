/**
 * CanxJS Auth - Built-in Authentication System
 * JWT + Session + OAuth2 support
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

// ============================================
// Password Hashing
// ============================================

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536,
    timeCost: 3,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

// ============================================
// JWT Utilities
// ============================================

interface JWTPayload {
  sub: string | number;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

interface JWTConfig {
  secret: string;
  expiresIn?: number; // seconds, default 24 hours
  algorithm?: 'HS256' | 'HS384' | 'HS512';
}

const encoder = new TextEncoder();

async function createHmacKey(secret: string, algorithm: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign', 'verify']
  );
}

function base64UrlEncode(data: Uint8Array | string): string {
  const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'> & { sub: string | number }, config: JWTConfig): Promise<string> {
  const alg = config.algorithm || 'HS256';
  const hashAlg = alg === 'HS256' ? 'SHA-256' : alg === 'HS384' ? 'SHA-384' : 'SHA-512';
  
  const header = { alg, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + (config.expiresIn || 86400), // 24 hours default
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await createHmacKey(config.secret, hashAlg);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature).reduce((s, b) => s + String.fromCharCode(b), ''));

  return `${data}.${signatureB64}`;
}

export async function verifyJWT(token: string, config: JWTConfig): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64));
    const alg = header.alg || 'HS256';
    const hashAlg = alg === 'HS256' ? 'SHA-256' : alg === 'HS384' ? 'SHA-384' : 'SHA-512';

    // Verify signature
    const key = await createHmacKey(config.secret, hashAlg);
    const data = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    if (!valid) return null;

    // Decode and check expiration
    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================
// Auth Middleware
// ============================================

interface AuthConfig {
  secret: string;
  tokenHeader?: string;
  tokenPrefix?: string;
  userProperty?: string;
}

export function jwtAuth(config: AuthConfig): MiddlewareHandler {
  return async (req, res, next) => {
    const header = req.header(config.tokenHeader || 'authorization');
    if (!header) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const prefix = config.tokenPrefix || 'Bearer ';
    if (!header.startsWith(prefix)) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const token = header.slice(prefix.length);
    const payload = await verifyJWT(token, { secret: config.secret });

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user to request context
    req.context.set(config.userProperty || 'user', payload);
    return next();
  };
}

export function optionalAuth(config: AuthConfig): MiddlewareHandler {
  return async (req, res, next) => {
    const header = req.header(config.tokenHeader || 'authorization');
    if (header) {
      const prefix = config.tokenPrefix || 'Bearer ';
      if (header.startsWith(prefix)) {
        const token = header.slice(prefix.length);
        const payload = await verifyJWT(token, { secret: config.secret });
        if (payload) {
          req.context.set(config.userProperty || 'user', payload);
        }
      }
    }
    return next();
  };
}

// ============================================
// Auth Guard Helpers
// ============================================

export function protect(config: AuthConfig): MiddlewareHandler {
  return jwtAuth(config);
}

export function guest(): MiddlewareHandler {
  return async (req, res, next) => {
    if (req.context.has('user')) {
      return res.status(403).json({ error: 'Already authenticated' });
    }
    return next();
  };
}

export function roles(...allowedRoles: string[]): MiddlewareHandler {
  return async (req, res, next) => {
    const user = req.context.get('user') as any;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const userRole = user.role || user.roles;
    const hasRole = Array.isArray(userRole)
      ? userRole.some(r => allowedRoles.includes(r))
      : allowedRoles.includes(userRole);

    if (!hasRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

// ============================================
// Session-based Auth
// ============================================

interface Session {
  id: string;
  userId: string | number;
  data: Record<string, unknown>;
  expiresAt: number;
}

class SessionStore {
  private sessions: Map<string, Session> = new Map();

  generateId(): string {
    return `sess_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  create(userId: string | number, data: Record<string, unknown> = {}, maxAge = 86400000): Session {
    const session: Session = {
      id: this.generateId(),
      userId,
      data,
      expiresAt: Date.now() + maxAge,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  destroy(id: string): boolean {
    return this.sessions.delete(id);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) this.sessions.delete(id);
    }
  }
}

export const sessionStore = new SessionStore();

export function sessionAuth(cookieName = 'canx_session'): MiddlewareHandler {
  return async (req, res, next) => {
    const sessionId = req.cookie(cookieName);
    if (sessionId) {
      const session = sessionStore.get(sessionId);
      if (session) {
        req.context.set('session', session);
        req.context.set('user', { sub: session.userId, ...session.data });
      }
    }
    return next();
  };
}

// ============================================
// Auth Module Export
// ============================================

export const auth = {
  // Password
  hash: hashPassword,
  verify: verifyPassword,
  
  // JWT
  sign: signJWT,
  verifyToken: verifyJWT,
  
  // Middleware
  jwt: jwtAuth,
  optional: optionalAuth,
  protect,
  guest,
  roles,
  session: sessionAuth,
  
  // Session store
  sessions: sessionStore,
};

export default auth;
