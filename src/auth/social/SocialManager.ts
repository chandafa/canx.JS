import type { CanxRequest, CanxResponse, MiddlewareHandler } from '../../types';
import type { SocialProvider, OAuthUser, SocialProviderConfig } from './types';
import { GoogleProvider } from './providers/GoogleProvider';
import { GithubProvider } from './providers/GithubProvider';

export class SocialManager {
  private providers: Map<string, SocialProvider> = new Map();
  private stateStore: Map<string, { provider: string; timestamp: number }> = new Map();

  constructor() {
    //
  }

  /**
   * Register a provider
   */
  register(name: string, provider: SocialProvider): this {
    this.providers.set(name, provider);
    return this;
  }

  /**
   * Get a provider
   */
  driver(name: string): SocialProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Social provider [${name}] is not configured.`);
    }
    return provider;
  }

  /**
   * Configure providers from config object
   */
  configure(config: Record<string, SocialProviderConfig>) {
    for (const [name, providerConfig] of Object.entries(config)) {
      switch (name) {
        case 'google':
          this.register(name, new GoogleProvider(providerConfig));
          break;
        case 'github':
          this.register(name, new GithubProvider(providerConfig));
          break;
        // Extend here for more built-ins or use register() manually
      }
    }
  }

  /**
   * Generate state
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Redirect to provider
   */
  redirect(providerName: string): MiddlewareHandler {
    return async (req, res) => {
      const provider = this.driver(providerName);
      const state = this.generateState();
      
      this.stateStore.set(state, { provider: providerName, timestamp: Date.now() });
      
      // Cleanup old states
      const tenMinutesAgo = Date.now() - 600000;
        for (const [key, value] of this.stateStore) {
        if (value.timestamp < tenMinutesAgo) this.stateStore.delete(key);
      }

      return res.redirect(provider.getAuthUrl(state));
    };
  }

  /**
   * Handle callback
   */
  callback(providerName: string, onSuccess: (user: OAuthUser, req: CanxRequest, res: CanxResponse) => void | Promise<void>): MiddlewareHandler {
    return async (req, res) => {
      try {
        const code = req.query?.code as string;
        const state = req.query?.state as string;

        if (!code || !state) {
            return res.status(400).json({ error: 'Missing code or state' });
        }

        const storedState = this.stateStore.get(state);
        if (!storedState || storedState.provider !== providerName) {
             return res.status(400).json({ error: 'Invalid state' });
        }
        this.stateStore.delete(state);

        const provider = this.driver(providerName);
        const tokens = await provider.getToken(code);
        
        // We need to pass tokens to getUser usually, or refactor getUser to take token.
        // My interface says getUser(token).
        
        // Improve: merge token data into user object? 
        // My mapUserToOAuthUser does that.
        
        const user = await ((provider as any).mapUserToOAuthUser 
            ? (provider as any).getUser(tokens.accessToken) // This usually fetches internal then calls map
            : provider.getUser(tokens.accessToken));

        // Inject refresh token if available from getToken step but not getUser step
        if (tokens.refreshToken && !user.refreshToken) {
            user.refreshToken = tokens.refreshToken;
        }

        return await onSuccess(user, req, res);

      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }
    };
  }
}

export const social = new SocialManager();
export const socialManager = social;
