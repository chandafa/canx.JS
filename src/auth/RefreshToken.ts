/**
 * CanxJS Refresh Token Manager
 * Secure refresh token flow for JWT authentication
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';
import { signJWT, verifyJWT } from './Auth';

// JWTConfig type (inline to avoid import issues)
interface JWTConfig {
  secret: string;
  expiresIn?: number;
}

// ============================================
// Types
// ============================================

export interface RefreshTokenConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry?: number; // seconds (default: 15 minutes)
  refreshTokenExpiry?: number; // seconds (default: 7 days)
  tokenFamily?: boolean; // Enable refresh token rotation
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: 'Bearer';
}

export interface RefreshTokenPayload {
  sub: string | number;
  family?: string;
  version?: number;
  iat: number;
  exp: number;
}

// ============================================
// Refresh Token Store Interface
// ============================================

export interface RefreshTokenStore {
  save(token: string, userId: string | number, family?: string, expiresAt?: Date): Promise<void>;
  find(token: string): Promise<{ userId: string | number; family?: string; version?: number } | null>;
  revoke(token: string): Promise<void>;
  revokeFamily(family: string): Promise<void>;
  revokeAllForUser(userId: string | number): Promise<void>;
  cleanup(): Promise<void>;
}

// ============================================
// In-Memory Store (for development)
// ============================================

export class MemoryRefreshTokenStore implements RefreshTokenStore {
  private tokens: Map<string, { userId: string | number; family?: string; version?: number; expiresAt: Date }> = new Map();

  async save(token: string, userId: string | number, family?: string, expiresAt?: Date): Promise<void> {
    this.tokens.set(token, {
      userId,
      family,
      version: 1,
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  async find(token: string) {
    const stored = this.tokens.get(token);
    if (!stored) return null;
    if (stored.expiresAt < new Date()) {
      this.tokens.delete(token);
      return null;
    }
    return { userId: stored.userId, family: stored.family, version: stored.version };
  }

  async revoke(token: string): Promise<void> {
    this.tokens.delete(token);
  }

  async revokeFamily(family: string): Promise<void> {
    for (const [token, data] of this.tokens) {
      if (data.family === family) this.tokens.delete(token);
    }
  }

  async revokeAllForUser(userId: string | number): Promise<void> {
    for (const [token, data] of this.tokens) {
      if (data.userId === userId) this.tokens.delete(token);
    }
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    for (const [token, data] of this.tokens) {
      if (data.expiresAt < now) this.tokens.delete(token);
    }
  }
}

// ============================================
// Refresh Token Manager
// ============================================

export class RefreshTokenManager {
  private config: Required<RefreshTokenConfig>;
  private store: RefreshTokenStore;

  constructor(config: RefreshTokenConfig, store?: RefreshTokenStore) {
    this.config = {
      accessTokenExpiry: config.accessTokenExpiry || 900, // 15 minutes
      refreshTokenExpiry: config.refreshTokenExpiry || 604800, // 7 days
      tokenFamily: config.tokenFamily ?? true,
      ...config,
    };
    this.store = store || new MemoryRefreshTokenStore();
  }

  /**
   * Generate a token family ID
   */
  private generateFamily(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate access + refresh token pair
   */
  async generateTokenPair(userId: string | number, additionalPayload?: Record<string, unknown>): Promise<TokenPair> {
    const family = this.config.tokenFamily ? this.generateFamily() : undefined;

    // Access Token
    const accessToken = await signJWT(
      { sub: userId, ...additionalPayload },
      { secret: this.config.accessTokenSecret, expiresIn: this.config.accessTokenExpiry }
    );

    // Refresh Token
    const refreshPayload: any = { sub: userId };
    if (family) refreshPayload.family = family;

    const refreshToken = await signJWT(
      refreshPayload,
      { secret: this.config.refreshTokenSecret, expiresIn: this.config.refreshTokenExpiry }
    );

    // Store refresh token
    const expiresAt = new Date(Date.now() + this.config.refreshTokenExpiry * 1000);
    await this.store.save(refreshToken, userId, family, expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenExpiry,
      refreshExpiresIn: this.config.refreshTokenExpiry,
      tokenType: 'Bearer',
    };
  }

  /**
   * Refresh token pair (rotate refresh token)
   */
  async refreshTokens(oldRefreshToken: string, additionalPayload?: Record<string, unknown>): Promise<TokenPair | null> {
    // Verify the refresh token
    const payload = await verifyJWT(oldRefreshToken, { secret: this.config.refreshTokenSecret });
    if (!payload) return null;

    // Check if token exists in store
    const stored = await this.store.find(oldRefreshToken);
    if (!stored) {
      // Token was already used or revoked - potential token theft!
      // Revoke entire family if token families are enabled
      if (this.config.tokenFamily && (payload as any).family) {
        await this.store.revokeFamily((payload as any).family);
      }
      return null;
    }

    // Revoke old refresh token
    await this.store.revoke(oldRefreshToken);

    // Generate new pair with same family
    const family = (payload as any).family || (this.config.tokenFamily ? this.generateFamily() : undefined);

    const accessToken = await signJWT(
      { sub: payload.sub, ...additionalPayload },
      { secret: this.config.accessTokenSecret, expiresIn: this.config.accessTokenExpiry }
    );

    const refreshPayload: any = { sub: payload.sub };
    if (family) refreshPayload.family = family;

    const refreshToken = await signJWT(
      refreshPayload,
      { secret: this.config.refreshTokenSecret, expiresIn: this.config.refreshTokenExpiry }
    );

    const expiresAt = new Date(Date.now() + this.config.refreshTokenExpiry * 1000);
    await this.store.save(refreshToken, payload.sub, family, expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenExpiry,
      refreshExpiresIn: this.config.refreshTokenExpiry,
      tokenType: 'Bearer',
    };
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeToken(token: string): Promise<void> {
    await this.store.revoke(token);
  }

  /**
   * Revoke all tokens for a user (logout everywhere)
   */
  async revokeAllForUser(userId: string | number): Promise<void> {
    await this.store.revokeAllForUser(userId);
  }

  /**
   * Middleware to handle refresh token endpoint
   */
  refreshMiddleware(): MiddlewareHandler {
    return async (req, res) => {
      let body: Record<string, unknown> | undefined;
      try {
        body = await req.json() as Record<string, unknown>;
      } catch {
        body = undefined;
      }
      
      const refreshToken = body?.refresh_token || body?.refreshToken;
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const tokens = await this.refreshTokens(refreshToken as string);
      if (!tokens) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      return res.json(tokens);
    };
  }
}

// Factory function
export function createRefreshTokenManager(config: RefreshTokenConfig, store?: RefreshTokenStore): RefreshTokenManager {
  return new RefreshTokenManager(config, store);
}
