import type { CanxRequest } from '../../types';
import type { AuthUser, GuardDriver } from '../Guard';

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
