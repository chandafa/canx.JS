/**
 * Phase 2: Security & Authorization Verification Tests
 */

import { expect, test, describe, beforeAll } from "bun:test";

// Import Phase 2 modules
import { 
  generateSecret, 
  generateTOTP, 
  verifyTOTP, 
  generateTwoFactorSetup,
  generateBackupCodes,
  TwoFactor
} from '../src/auth/TwoFactor';

import { 
  OAuth, 
  oauth 
} from '../src/auth/OAuth';

import { 
  RefreshTokenManager, 
  MemoryRefreshTokenStore 
} from '../src/auth/RefreshToken';

import { 
  EmailVerification, 
  PasswordReset 
} from '../src/auth/EmailVerification';

import { 
  sanitizeString, 
  sanitizeObject, 
  encodeHtml, 
  stripTags 
} from '../src/middlewares/SanitizeMiddleware';

// ============================================
// Two-Factor Authentication Tests
// ============================================

describe('Two-Factor Authentication (2FA)', () => {
  
  test('generateSecret creates valid base32 secret', () => {
    const secret = generateSecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBe(20);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  test('generateTwoFactorSetup returns secret and OTP URL', () => {
    const setup = generateTwoFactorSetup('test@example.com', { issuer: 'CanxJS' });
    expect(setup.secret).toBeDefined();
    expect(setup.otpAuthUrl).toContain('otpauth://totp/');
    expect(setup.otpAuthUrl).toContain('CanxJS');
    expect(setup.otpAuthUrl).toContain('test%40example.com');
  });

  test('generateTOTP creates 6-digit code', async () => {
    const secret = generateSecret();
    const code = await generateTOTP(secret);
    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  test('verifyTOTP validates correct code', async () => {
    const secret = generateSecret();
    const code = await generateTOTP(secret);
    const isValid = await verifyTOTP(code, secret);
    expect(isValid).toBe(true);
  });

  test('verifyTOTP rejects invalid code', async () => {
    const secret = generateSecret();
    const isValid = await verifyTOTP('000000', secret);
    expect(isValid).toBe(false);
  });

  test('generateBackupCodes creates 10 codes by default', () => {
    const codes = generateBackupCodes();
    expect(codes.length).toBe(10);
    codes.forEach(code => {
      expect(code.length).toBe(8);
      expect(/^[A-F0-9]+$/.test(code)).toBe(true);
    });
  });

  test('TwoFactor class works correctly', async () => {
    const twoFactor = new TwoFactor({ issuer: 'TestApp' });
    const setup = twoFactor.setup('user@test.com');
    expect(setup.secret).toBeDefined();
    
    const code = await twoFactor.generate(setup.secret);
    const isValid = await twoFactor.verify(code, setup.secret);
    expect(isValid).toBe(true);
  });
});

// ============================================
// OAuth Tests
// ============================================

describe('OAuth2 Social Login', () => {
  
  test('OAuth can be configured with providers', () => {
    const oauthInstance = new OAuth();
    oauthInstance.configure({
      providers: {
        google: {
          clientId: 'test-client-id',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost:3000/auth/google/callback',
        },
      },
    });
    
    const authUrl = oauthInstance.getAuthUrl('google');
    expect(authUrl).toContain('accounts.google.com');
    expect(authUrl).toContain('client_id=test-client-id');
    expect(authUrl).toContain('redirect_uri=');
    expect(authUrl).toContain('state=');
  });

  test('OAuth throws for unconfigured provider', () => {
    const oauthInstance = new OAuth();
    expect(() => oauthInstance.getAuthUrl('unknown')).toThrow();
  });
});

// ============================================
// Refresh Token Tests
// ============================================

describe('Refresh Token Flow', () => {
  
  test('MemoryRefreshTokenStore works correctly', async () => {
    const store = new MemoryRefreshTokenStore();
    
    await store.save('token123', 'user1', 'family1');
    const found = await store.find('token123');
    expect(found).not.toBeNull();
    expect(found?.userId).toBe('user1');
    expect(found?.family).toBe('family1');
    
    await store.revoke('token123');
    const afterRevoke = await store.find('token123');
    expect(afterRevoke).toBeNull();
  });

  test('RefreshTokenManager generates token pairs', async () => {
    const manager = new RefreshTokenManager({
      accessTokenSecret: 'access-secret-123',
      refreshTokenSecret: 'refresh-secret-456',
      accessTokenExpiry: 900,
      refreshTokenExpiry: 604800,
    });
    
    const tokens = await manager.generateTokenPair('user123');
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresIn).toBe(900);
    expect(tokens.refreshExpiresIn).toBe(604800);
    expect(tokens.tokenType).toBe('Bearer');
  });

  test('RefreshTokenManager refreshes tokens and returns new pair', async () => {
    const manager = new RefreshTokenManager({
      accessTokenSecret: 'access-secret-123',
      refreshTokenSecret: 'refresh-secret-456',
    });
    
    const original = await manager.generateTokenPair('user123');
    const refreshed = await manager.refreshTokens(original.refreshToken);
    
    // Verify refresh returns a valid token pair
    expect(refreshed).not.toBeNull();
    expect(refreshed?.accessToken).toBeDefined();
    expect(refreshed?.refreshToken).toBeDefined();
    expect(refreshed?.tokenType).toBe('Bearer');
    expect(refreshed?.expiresIn).toBe(900);
  });

  test('RefreshTokenManager revoke works correctly', async () => {
    const manager = new RefreshTokenManager({
      accessTokenSecret: 'access-secret-123',
      refreshTokenSecret: 'refresh-secret-456',
    });
    
    const tokens = await manager.generateTokenPair('user123');
    
    // Revoke the token explicitly
    await manager.revokeToken(tokens.refreshToken);
    
    // Now refresh should fail
    const result = await manager.refreshTokens(tokens.refreshToken);
    expect(result).toBeNull();
  });
});

// ============================================
// Email Verification Tests
// ============================================

describe('Email Verification', () => {
  
  test('EmailVerification generates signed URL', async () => {
    const emailVerify = new EmailVerification({
      secret: 'test-secret-key',
      baseUrl: 'http://localhost:3000',
      expiresIn: 86400,
    });
    
    const url = await emailVerify.generateUrl('user123', 'test@example.com');
    expect(url).toContain('http://localhost:3000/auth/verify-email');
    expect(url).toContain('id=user123');
    expect(url).toContain('email=test%40example.com');
    expect(url).toContain('signature=');
  });

  test('EmailVerification validates correct signature', async () => {
    const emailVerify = new EmailVerification({
      secret: 'test-secret-key',
      baseUrl: 'http://localhost:3000',
      expiresIn: 3600,
    });
    
    const url = await emailVerify.generateUrl('user123', 'test@example.com');
    const params = new URL(url).searchParams;
    
    const result = await emailVerify.verify({
      id: params.get('id')!,
      email: params.get('email')!,
      expires: params.get('expires')!,
      signature: params.get('signature')!,
    });
    
    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user123');
    expect(result.email).toBe('test@example.com');
  });

  test('EmailVerification rejects tampered signature', async () => {
    const emailVerify = new EmailVerification({
      secret: 'test-secret-key',
      baseUrl: 'http://localhost:3000',
    });
    
    const result = await emailVerify.verify({
      id: 'user123',
      email: 'test@example.com',
      expires: String(Math.floor(Date.now() / 1000) + 3600),
      signature: 'invalid-signature',
    });
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });
});

// ============================================
// Input Sanitization Tests
// ============================================

describe('Input Sanitization', () => {
  
  test('encodeHtml encodes special characters', () => {
    const input = '<script>alert("xss")</script>';
    const encoded = encodeHtml(input);
    expect(encoded).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
  });

  test('stripTags removes HTML tags', () => {
    const input = '<p>Hello <b>World</b>!</p>';
    const stripped = stripTags(input);
    expect(stripped).toBe('Hello World!');
  });

  test('stripTags allows specified tags', () => {
    const input = '<p>Hello <b>World</b>!</p>';
    const stripped = stripTags(input, ['b']);
    expect(stripped).toBe('Hello <b>World</b>!');
  });

  test('sanitizeString trims whitespace', () => {
    const result = sanitizeString('  hello world  ');
    expect(result).toBe('hello world');
  });

  test('sanitizeString strips tags when configured', () => {
    const result = sanitizeString('<b>hello</b>', { stripTags: true });
    expect(result).toBe('hello');
  });

  test('sanitizeString enforces max length', () => {
    const result = sanitizeString('hello world', { maxStringLength: 5 });
    expect(result).toBe('hello');
  });

  test('sanitizeObject recursively sanitizes', () => {
    const input = {
      name: '  <b>John</b>  ',
      nested: {
        value: '  <script>alert(1)</script>  ',
      },
    };
    
    const result = sanitizeObject(input, { stripTags: true, trimStrings: true });
    expect(result.name).toBe('John');
    expect((result.nested as any).value).toBe('alert(1)');
  });

  test('sanitizeObject respects exclude list', () => {
    const input = {
      safe: '<b>keep</b>',
      html: '<b>strip</b>',
    };
    
    const result = sanitizeObject(input, { stripTags: true, exclude: ['safe'] });
    expect(result.safe).toBe('<b>keep</b>');
    expect(result.html).toBe('strip');
  });
});

// ============================================
// Summary
// ============================================

describe('Phase 2 Summary', () => {
  test('All Phase 2 modules are importable', () => {
    // This test passes if all imports above succeeded
    expect(true).toBe(true);
  });
});
