/**
 * OAuth - Simple OAuth2 Social Login Helper
 * For more advanced social login, use SocialManager from auth/social
 */

interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

interface OAuthConfig {
  providers: Record<string, OAuthProviderConfig>;
}

const PROVIDER_URLS: Record<
  string,
  { auth: string; token: string; userinfo: string }
> = {
  google: {
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userinfo: "https://www.googleapis.com/oauth2/v3/userinfo",
  },
  github: {
    auth: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    userinfo: "https://api.github.com/user",
  },
  facebook: {
    auth: "https://www.facebook.com/v18.0/dialog/oauth",
    token: "https://graph.facebook.com/v18.0/oauth/access_token",
    userinfo: "https://graph.facebook.com/me?fields=id,name,email,picture",
  },
};

const DEFAULT_SCOPES: Record<string, string[]> = {
  google: ["openid", "email", "profile"],
  github: ["read:user", "user:email"],
  facebook: ["email", "public_profile"],
};

export class OAuth {
  private config: OAuthConfig = { providers: {} };
  private stateStore: Map<string, { provider: string; timestamp: number }> =
    new Map();

  /**
   * Configure OAuth providers
   */
  configure(config: OAuthConfig): this {
    this.config = config;
    return this;
  }

  /**
   * Add a provider
   */
  addProvider(name: string, config: OAuthProviderConfig): this {
    this.config.providers[name] = config;
    return this;
  }

  /**
   * Get provider config
   */
  private getProvider(name: string): OAuthProviderConfig {
    const provider = this.config.providers[name];
    if (!provider) {
      throw new Error(`OAuth provider [${name}] is not configured.`);
    }
    return provider;
  }

  /**
   * Generate a random state string
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Store state for validation
   */
  private storeState(state: string, provider: string): void {
    this.stateStore.set(state, { provider, timestamp: Date.now() });

    // Cleanup old states (> 10 minutes)
    const tenMinutesAgo = Date.now() - 600000;
    for (const [key, value] of this.stateStore) {
      if (value.timestamp < tenMinutesAgo) {
        this.stateStore.delete(key);
      }
    }
  }

  /**
   * Validate state
   */
  validateState(state: string, provider: string): boolean {
    const stored = this.stateStore.get(state);
    if (!stored || stored.provider !== provider) {
      return false;
    }
    this.stateStore.delete(state);
    return true;
  }

  /**
   * Get authorization URL for provider
   */
  getAuthUrl(provider: string, customState?: string): string {
    const config = this.getProvider(provider);
    const urls = PROVIDER_URLS[provider];

    if (!urls) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const state = customState || this.generateState();
    this.storeState(state, provider);

    const scopes = config.scopes || DEFAULT_SCOPES[provider] || [];

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state,
    });

    return `${urls.auth}?${params.toString()}`;
  }

  /**
   * Exchange code for tokens
   */
  async getToken(
    provider: string,
    code: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType: string;
  }> {
    const config = this.getProvider(provider);
    const urls = PROVIDER_URLS[provider];

    if (!urls) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const response = await fetch(urls.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type || "Bearer",
    };
  }

  /**
   * Get user info from provider
   */
  async getUser(
    provider: string,
    accessToken: string,
  ): Promise<{
    id: string;
    email?: string;
    name?: string;
    avatar?: string;
    raw: any;
  }> {
    const urls = PROVIDER_URLS[provider];

    if (!urls) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const response = await fetch(urls.userinfo, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch user info: ${error}`);
    }

    const data = await response.json();

    // Normalize user data based on provider
    switch (provider) {
      case "google":
        return {
          id: data.sub,
          email: data.email,
          name: data.name,
          avatar: data.picture,
          raw: data,
        };
      case "github":
        return {
          id: String(data.id),
          email: data.email,
          name: data.name || data.login,
          avatar: data.avatar_url,
          raw: data,
        };
      case "facebook":
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          avatar: data.picture?.data?.url,
          raw: data,
        };
      default:
        return {
          id: data.id || data.sub,
          email: data.email,
          name: data.name,
          raw: data,
        };
    }
  }
}

// Singleton instance
export const oauth = new OAuth();
