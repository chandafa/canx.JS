import { SocialProvider, type OAuthUser } from '../types';

export class GoogleProvider extends SocialProvider {
  protected authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  protected tokenUrl = 'https://oauth2.googleapis.com/token';
  protected userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
  protected defaultScopes = ['openid', 'email', 'profile'];

  getAuthUrl(state: string): string {
    const scopes = this.config.scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
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
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google token exchange failed: ${error}`);
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
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error('Failed to fetch user info from Google');

    const data = await response.json();
    // Assuming we don't have refresh token here unless passed, but this method signature is simple. 
    // Usually getUser is called after getToken. 
    // We will handle this in mapUserToOAuthUser.
    return this.mapUserToOAuthUser(data, token);
  }

  protected mapUserToOAuthUser(data: any, accessToken: string, refreshToken?: string): OAuthUser {
    return {
      id: String(data.id),
      email: String(data.email),
      name: String(data.name),
      avatar: data.picture,
      provider: 'google',
      accessToken,
      refreshToken,
      raw: data,
    };
  }
}
