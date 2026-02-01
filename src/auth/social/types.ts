/**
 * CanxJS Social Auth - Types & Interfaces
 */

export interface OAuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  raw: Record<string, unknown>;
}

export interface SocialProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  [key: string]: unknown;
}

export abstract class SocialProvider {
  protected config: SocialProviderConfig;

  constructor(config: SocialProviderConfig) {
    this.config = config;
  }

  /**
   * Get the authorization URL to redirect the user to.
   */
  abstract getAuthUrl(state: string): string;

  /**
   * Exchange the authorization code for an access token.
   */
  abstract getToken(code: string): Promise<{ accessToken: string; refreshToken?: string; [key: string]: unknown }>;

  /**
   * Get the authentication user by token.
   */
  abstract getUser(token: string): Promise<OAuthUser>;

  /**
   * Normalize user data.
   */
  protected abstract mapUserToOAuthUser(data: unknown, token: string, refreshToken?: string): OAuthUser;
}
