import { SocialProvider, type OAuthUser } from '../types';

export class GithubProvider extends SocialProvider {
  protected authUrl = 'https://github.com/login/oauth/authorize';
  protected tokenUrl = 'https://github.com/login/oauth/access_token';
  protected userInfoUrl = 'https://api.github.com/user';
  protected defaultScopes = ['user:email'];

  getAuthUrl(state: string): string {
    const scopes = this.config.scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async getToken(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub token exchange failed: ${error}`);
    }

    const data = await response.json() as { access_token: string; refresh_token?: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async getUser(token: string): Promise<OAuthUser> {
    const response = await fetch(this.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) throw new Error('Failed to fetch user info from GitHub');

    const data = await response.json();
    return this.mapUserToOAuthUser(data, token);
  }

  protected mapUserToOAuthUser(data: any, accessToken: string, refreshToken?: string): OAuthUser {
    return {
      id: String(data.id),
      email: String(data.email || ''),
      name: String(data.name || data.login),
      avatar: data.avatar_url,
      provider: 'github',
      accessToken,
      refreshToken,
      raw: data,
    };
  }
}
