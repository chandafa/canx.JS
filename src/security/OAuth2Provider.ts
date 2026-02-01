/**
 * CanxJS OAuth2 Provider - Base implementation for OAuth2 Server
 * @description Foundation for building an OAuth2 Authorization Server
 */

export interface OAuth2Client {
  id: string;
  secret: string;
  redirectUris: string[];
  grants: string[];
  confidential: boolean; // true = requires secret
}

export interface OAuth2Token {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  clientId: string;
  userId?: string;
  scope?: string;
}

export interface OAuth2AuthorizationCode {
  code: string;
  expiresAt: Date;
  redirectUri: string;
  clientId: string;
  userId?: string;
  scope?: string;
}

export interface OAuth2Storage {
  // Clients
  getClient(clientId: string): Promise<OAuth2Client | null>;
  
  // Tokens
  saveToken(token: OAuth2Token): Promise<void>;
  getAccessToken(accessToken: string): Promise<OAuth2Token | null>;
  getRefreshToken(refreshToken: string): Promise<OAuth2Token | null>;
  revokeToken(token: OAuth2Token): Promise<void>;

  // Authorization Codes
  saveAuthorizationCode(code: OAuth2AuthorizationCode): Promise<void>;
  getAuthorizationCode(code: string): Promise<OAuth2AuthorizationCode | null>;
  revokeAuthorizationCode(code: OAuth2AuthorizationCode): Promise<void>;
  
  // User (Owner)
  validateUser(username: string, password: string): Promise<string | null>; // Returns User ID
}

/**
 * In-Memory Storage (for dev)
 */
export class MemoryOAuth2Storage implements OAuth2Storage {
  private clients = new Map<string, OAuth2Client>();
  private tokens = new Map<string, OAuth2Token>();
  private codes = new Map<string, OAuth2AuthorizationCode>();

  // Clients
  async getClient(clientId: string): Promise<OAuth2Client | null> {
    return this.clients.get(clientId) ?? null;
  }

  addClient(client: OAuth2Client) {
    this.clients.set(client.id, client);
  }

  // Tokens
  async saveToken(token: OAuth2Token): Promise<void> {
    this.tokens.set(token.accessToken, token);
    if (token.refreshToken) {
      this.tokens.set(token.refreshToken, token); 
    }
  }

  async getAccessToken(accessToken: string): Promise<OAuth2Token | null> {
    const token = this.tokens.get(accessToken);
    if (!token) return null;
    if (token.accessTokenExpiresAt < new Date()) {
      return null;
    }
    return token;
  }

  async getRefreshToken(refreshToken: string): Promise<OAuth2Token | null> {
    const token = this.tokens.get(refreshToken);
    if (!token) return null;
    if (token.refreshTokenExpiresAt && token.refreshTokenExpiresAt < new Date()) {
      return null;
    }
    return token;
  }

  async revokeToken(token: OAuth2Token): Promise<void> {
    this.tokens.delete(token.accessToken);
    if (token.refreshToken) {
      this.tokens.delete(token.refreshToken);
    }
  }

  // Codes
  async saveAuthorizationCode(code: OAuth2AuthorizationCode): Promise<void> {
    this.codes.set(code.code, code);
  }

  async getAuthorizationCode(code: string): Promise<OAuth2AuthorizationCode | null> {
    const authCode = this.codes.get(code);
    if (!authCode) return null;
    if (authCode.expiresAt < new Date()) {
      return null;
    }
    return authCode;
  }

  async revokeAuthorizationCode(code: OAuth2AuthorizationCode): Promise<void> {
    this.codes.delete(code.code);
  }

  // User
  async validateUser(username: string): Promise<string | null> {
    // Mock user validation
    if (username === 'admin') return '1';
    return null;
  }
}

/**
 * OAuth2 Server
 */
export class OAuth2Server {
  constructor(private storage: OAuth2Storage) {}

  /**
   * Authorize a client (Validate client & redirect URI)
   */
  async authorize(clientId: string, redirectUri: string, scope?: string): Promise<boolean> {
    const client = await this.storage.getClient(clientId);
    if (!client) return false;
    
    if (!client.redirectUris.includes(redirectUri)) {
      return false;
    }
    return true;
  }

  /**
   * Issue Authorization Code
   */
  async issueAuthorizationCode(clientId: string, redirectUri: string, userId: string, scope?: string): Promise<string> {
    const codeString = crypto.randomUUID();
    const code: OAuth2AuthorizationCode = {
      code: codeString,
      clientId,
      redirectUri,
      userId,
      scope,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
    };
    
    await this.storage.saveAuthorizationCode(code);
    return codeString;
  }

  /**
   * Exchange code for token
   */
  async exchangeCode(codeString: string, clientId: string, clientSecret?: string): Promise<OAuth2Token> {
    const code = await this.storage.getAuthorizationCode(codeString);
    if (!code) throw new Error('Invalid code');
    
    if (code.clientId !== clientId) throw new Error('Client mismatch');

    // Check client secret if confidential
    const client = await this.storage.getClient(clientId);
    if (client?.confidential) {
      if (client.secret !== clientSecret) throw new Error('Invalid client secret');
    }

    // Revoke code (single use)
    await this.storage.revokeAuthorizationCode(code);

    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();

    const token: OAuth2Token = {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      refreshToken,
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days
      clientId,
      userId: code.userId,
      scope: code.scope,
    };

    await this.storage.saveToken(token);
    return token;
  }
}

export default OAuth2Server;
