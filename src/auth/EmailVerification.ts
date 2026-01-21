/**
 * CanxJS Email Verification
 * Signed URL generation and verification for email confirmation
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

// ============================================
// Types
// ============================================

export interface EmailVerificationConfig {
  secret: string;
  expiresIn?: number; // seconds (default: 24 hours)
  baseUrl: string;
  verifyPath?: string;
}

export interface VerificationPayload {
  id: string | number;
  email: string;
  expires: number;
  signature: string;
}

// ============================================
// Signed URL Generator
// ============================================

export class EmailVerification {
  private config: Required<EmailVerificationConfig>;

  constructor(config: EmailVerificationConfig) {
    this.config = {
      expiresIn: config.expiresIn || 86400, // 24 hours
      verifyPath: config.verifyPath || '/auth/verify-email',
      ...config,
    };
  }

  /**
   * Generate HMAC signature
   */
  private async sign(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.config.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Generate verification URL
   */
  async generateUrl(userId: string | number, email: string): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + this.config.expiresIn;
    const dataToSign = `${userId}|${email}|${expires}`;
    const signature = await this.sign(dataToSign);

    const params = new URLSearchParams({
      id: String(userId),
      email,
      expires: String(expires),
      signature,
    });

    return `${this.config.baseUrl}${this.config.verifyPath}?${params.toString()}`;
  }

  /**
   * Verify signed URL parameters
   */
  async verify(params: {
    id: string;
    email: string;
    expires: string;
    signature: string;
  }): Promise<{ valid: boolean; userId?: string | number; email?: string; error?: string }> {
    const { id, email, expires, signature } = params;

    // Check expiration
    const expiresNum = parseInt(expires, 10);
    if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Verification link has expired' };
    }

    // Verify signature
    const dataToSign = `${id}|${email}|${expires}`;
    const expectedSignature = await this.sign(dataToSign);

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true, userId: id, email };
  }

  /**
   * Middleware to handle verification endpoint
   */
  verifyMiddleware(
    onSuccess: (userId: string | number, email: string, req: CanxRequest, res: CanxResponse) => void | Promise<void>,
    onError?: (error: string, req: CanxRequest, res: CanxResponse) => void | Promise<void>
  ): MiddlewareHandler {
    return async (req, res) => {
      const { id, email, expires, signature } = req.query as Record<string, string>;

      if (!id || !email || !expires || !signature) {
        if (onError) {
          return onError('Missing required parameters', req, res);
        }
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const result = await this.verify({ id, email, expires, signature });

      if (!result.valid) {
        if (onError) {
          return onError(result.error!, req, res);
        }
        return res.status(400).json({ error: result.error });
      }

      return onSuccess(result.userId!, result.email!, req, res);
    };
  }
}

// ============================================
// Password Reset (Similar pattern)
// ============================================

export class PasswordReset {
  private config: Required<EmailVerificationConfig>;

  constructor(config: EmailVerificationConfig) {
    this.config = {
      expiresIn: config.expiresIn || 3600, // 1 hour
      verifyPath: config.verifyPath || '/auth/reset-password',
      ...config,
    };
  }

  private async sign(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.config.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Generate password reset URL
   */
  async generateUrl(userId: string | number, email: string): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + this.config.expiresIn;
    const token = await this.generateToken();
    const dataToSign = `${userId}|${email}|${token}|${expires}`;
    const signature = await this.sign(dataToSign);

    const params = new URLSearchParams({
      id: String(userId),
      email,
      token,
      expires: String(expires),
      signature,
    });

    return `${this.config.baseUrl}${this.config.verifyPath}?${params.toString()}`;
  }

  private async generateToken(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify reset token
   */
  async verify(params: {
    id: string;
    email: string;
    token: string;
    expires: string;
    signature: string;
  }): Promise<{ valid: boolean; userId?: string | number; email?: string; error?: string }> {
    const { id, email, token, expires, signature } = params;

    const expiresNum = parseInt(expires, 10);
    if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Reset link has expired' };
    }

    const dataToSign = `${id}|${email}|${token}|${expires}`;
    const expectedSignature = await this.sign(dataToSign);

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true, userId: id, email };
  }
}

// Factory functions
export function createEmailVerification(config: EmailVerificationConfig): EmailVerification {
  return new EmailVerification(config);
}

export function createPasswordReset(config: EmailVerificationConfig): PasswordReset {
  return new PasswordReset(config);
}
