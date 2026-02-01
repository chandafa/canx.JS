import type { CanxRequest } from '../../types';
import type { AuthUser, GuardDriver } from '../Guard';

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
