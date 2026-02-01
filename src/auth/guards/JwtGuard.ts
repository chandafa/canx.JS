import type { CanxRequest } from '../../types';
import type { AuthUser, GuardDriver } from '../Guard';

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
