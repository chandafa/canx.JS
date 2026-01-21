/**
 * CanxJS OAuth2 Provider
 * Social login integration for Google, GitHub, Facebook, Discord
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../types';

// ============================================
// Types
// ============================================

export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

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

export interface OAuthConfig {
  providers: Record<string, Partial<OAuthProvider>>;
  defaultScopes?: Record<string, string[]>;
}

// ============================================
// Built-in Provider Configurations
// ============================================

const PROVIDER_CONFIGS: Record<string, Omit<OAuthProvider, 'clientId' | 'clientSecret' | 'redirectUri' | 'scopes'>> = {
  google: {
    name: 'google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  github: {
    name: 'github',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
  },
  facebook: {
    name: 'facebook',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture',
  },
  discord: {
    name: 'discord',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
  },
};

const DEFAULT_SCOPES: Record<string, string[]> = {
  google: ['openid', 'email', 'profile'],
  github: ['user:email'],
  facebook: ['email', 'public_profile'],
  discord: ['identify', 'email'],
};

// ============================================
// OAuth Manager
// ============================================

export class OAuth {
  private providers: Map<string, OAuthProvider> = new Map();
  private stateStore: Map<string, { provider: string; timestamp: number }> = new Map();

  /**
   * Configure OAuth providers
   */
  configure(config: OAuthConfig) {
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const baseConfig = PROVIDER_CONFIGS[name];
      if (!baseConfig && !providerConfig.authUrl) {
        throw new Error(`Unknown OAuth provider: ${name}. Provide full config with authUrl, tokenUrl, userInfoUrl.`);
      }

      const scopes = providerConfig.scopes || config.defaultScopes?.[name] || DEFAULT_SCOPES[name] || [];

      this.providers.set(name, {
        name,
        clientId: providerConfig.clientId || '',
        clientSecret: providerConfig.clientSecret || '',
        redirectUri: providerConfig.redirectUri || '',
        scopes,
        authUrl: providerConfig.authUrl || baseConfig?.authUrl || '',
        tokenUrl: providerConfig.tokenUrl || baseConfig?.tokenUrl || '',
        userInfoUrl: providerConfig.userInfoUrl || baseConfig?.userInfoUrl || '',
      });
    }
  }

  /**
   * Generate a secure state token
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get authorization URL for a provider
   */
  getAuthUrl(providerName: string, additionalParams?: Record<string, string>): string {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`OAuth provider not configured: ${providerName}`);

    const state = this.generateState();
    this.stateStore.set(state, { provider: providerName, timestamp: Date.now() });

    // Clean old states (> 10 minutes)
    const tenMinutesAgo = Date.now() - 600000;
    for (const [key, value] of this.stateStore) {
      if (value.timestamp < tenMinutesAgo) this.stateStore.delete(key);
    }

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state,
      ...additionalParams,
    });

    return `${provider.authUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(providerName: string, code: string, state: string): Promise<OAuthUser> {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`OAuth provider not configured: ${providerName}`);

    // Validate state
    const storedState = this.stateStore.get(state);
    if (!storedState || storedState.provider !== providerName) {
      throw new Error('Invalid OAuth state');
    }
    this.stateStore.delete(state);

    // Exchange code for tokens
    const tokenResponse = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: provider.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json() as { access_token: string; refresh_token?: string };

    // Get user info
    const userResponse = await fetch(provider.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userData = await userResponse.json() as Record<string, unknown>;

    // Normalize user data based on provider
    return this.normalizeUser(providerName, userData, tokens.access_token, tokens.refresh_token);
  }

  /**
   * Normalize user data from different providers
   */
  private normalizeUser(
    provider: string, 
    data: Record<string, unknown>, 
    accessToken: string, 
    refreshToken?: string
  ): OAuthUser {
    switch (provider) {
      case 'google':
        return {
          id: String(data.id),
          email: String(data.email),
          name: String(data.name),
          avatar: data.picture as string | undefined,
          provider,
          accessToken,
          refreshToken,
          raw: data,
        };
      case 'github':
        return {
          id: String(data.id),
          email: String(data.email || ''),
          name: String(data.name || data.login),
          avatar: data.avatar_url as string | undefined,
          provider,
          accessToken,
          refreshToken,
          raw: data,
        };
      case 'facebook':
        const picture = data.picture as { data?: { url?: string } } | undefined;
        return {
          id: String(data.id),
          email: String(data.email || ''),
          name: String(data.name),
          avatar: picture?.data?.url,
          provider,
          accessToken,
          refreshToken,
          raw: data,
        };
      case 'discord':
        return {
          id: String(data.id),
          email: String(data.email || ''),
          name: String(data.username),
          avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : undefined,
          provider,
          accessToken,
          refreshToken,
          raw: data,
        };
      default:
        return {
          id: String(data.id || data.sub || ''),
          email: String(data.email || ''),
          name: String(data.name || data.username || ''),
          avatar: (data.avatar || data.picture || data.avatar_url) as string | undefined,
          provider,
          accessToken,
          refreshToken,
          raw: data,
        };
    }
  }

  /**
   * Redirect middleware for OAuth flow
   */
  redirect(providerName: string): MiddlewareHandler {
    return async (req, res) => {
      const url = this.getAuthUrl(providerName);
      return res.redirect(url);
    };
  }

  /**
   * Callback middleware for OAuth flow
   */
  callback(providerName: string, onSuccess: (user: OAuthUser, req: CanxRequest, res: CanxResponse) => void | Promise<void>): MiddlewareHandler {
    return async (req, res, next) => {
      try {
        const code = req.query?.code as string;
        const state = req.query?.state as string;

        if (!code || !state) {
          return res.status(400).json({ error: 'Missing code or state parameter' });
        }

        const user = await this.handleCallback(providerName, code, state);
        return await onSuccess(user, req, res);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }
    };
  }
}

// Singleton instance
export const oauth = new OAuth();

// Helper to configure
export function initOAuth(config: OAuthConfig) {
  oauth.configure(config);
}
