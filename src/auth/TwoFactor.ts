/**
 * CanxJS Two-Factor Authentication (2FA)
 * TOTP-based 2FA using RFC 6238
 */

// ============================================
// Types
// ============================================

export interface TwoFactorSecret {
  secret: string;
  otpAuthUrl: string;
  qrCodeDataUrl?: string;
}

export interface TwoFactorConfig {
  issuer: string;
  digits?: number;
  period?: number;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
}

// ============================================
// TOTP Implementation (RFC 6238)
// ============================================

const DEFAULT_CONFIG: Required<TwoFactorConfig> = {
  issuer: 'CanxJS',
  digits: 6,
  period: 30,
  algorithm: 'SHA1',
};

/**
 * Generate a random base32-encoded secret
 */
export function generateSecret(length: number = 20): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => alphabet[b % 32]).join('');
}

/**
 * Base32 decode
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = encoded.toUpperCase().replace(/=+$/, '');
  
  let bits = '';
  for (const char of cleanInput) {
    const val = alphabet.indexOf(char);
    if (val === -1) throw new Error('Invalid base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return bytes;
}

/**
 * Generate HMAC
 */
async function hmac(algorithm: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

/**
 * Generate TOTP code
 */
export async function generateTOTP(
  secret: string, 
  config: Partial<TwoFactorConfig> = {}
): Promise<string> {
  const { digits, period, algorithm } = { ...DEFAULT_CONFIG, ...config };
  
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / period);
  
  // Convert time to 8-byte buffer (big-endian)
  const timeBuffer = new Uint8Array(8);
  let temp = time;
  for (let i = 7; i >= 0; i--) {
    timeBuffer[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  
  const hashAlgorithm = algorithm === 'SHA256' ? 'SHA-256' : algorithm === 'SHA512' ? 'SHA-512' : 'SHA-1';
  const hash = await hmac(hashAlgorithm, key, timeBuffer);
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
  
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verify TOTP code (with time window tolerance)
 */
export async function verifyTOTP(
  code: string, 
  secret: string, 
  config: Partial<TwoFactorConfig> = {},
  tolerance: number = 1
): Promise<boolean> {
  const { period } = { ...DEFAULT_CONFIG, ...config };
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Check current and adjacent time windows
  for (let i = -tolerance; i <= tolerance; i++) {
    const windowTime = currentTime + (i * period);
    const expectedCode = await generateTOTPAtTime(secret, windowTime, config);
    if (code === expectedCode) return true;
  }
  
  return false;
}

/**
 * Generate TOTP at specific timestamp
 */
async function generateTOTPAtTime(
  secret: string, 
  timestamp: number,
  config: Partial<TwoFactorConfig> = {}
): Promise<string> {
  const { digits, period, algorithm } = { ...DEFAULT_CONFIG, ...config };
  
  const key = base32Decode(secret);
  const time = Math.floor(timestamp / period);
  
  const timeBuffer = new Uint8Array(8);
  let temp = time;
  for (let i = 7; i >= 0; i--) {
    timeBuffer[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  
  const hashAlgorithm = algorithm === 'SHA256' ? 'SHA-256' : algorithm === 'SHA512' ? 'SHA-512' : 'SHA-1';
  const hash = await hmac(hashAlgorithm, key, timeBuffer);
  
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
  
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Generate setup data for 2FA (secret + OTP Auth URL)
 */
export function generateTwoFactorSetup(
  accountName: string,
  config: Partial<TwoFactorConfig> = {}
): TwoFactorSecret {
  const { issuer, digits, period, algorithm } = { ...DEFAULT_CONFIG, ...config };
  const secret = generateSecret();
  
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: algorithm || 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  
  const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params.toString()}`;
  
  return {
    secret,
    otpAuthUrl,
  };
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    codes.push(code.toUpperCase());
  }
  return codes;
}

/**
 * TwoFactor class for managing 2FA for users
 */
export class TwoFactor {
  private config: Required<TwoFactorConfig>;

  constructor(config: Partial<TwoFactorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate setup for a user
   */
  setup(accountName: string): TwoFactorSecret {
    return generateTwoFactorSetup(accountName, this.config);
  }

  /**
   * Verify a TOTP code
   */
  async verify(code: string, secret: string): Promise<boolean> {
    return verifyTOTP(code, secret, this.config);
  }

  /**
   * Generate current TOTP (for testing)
   */
  async generate(secret: string): Promise<string> {
    return generateTOTP(secret, this.config);
  }

  /**
   * Generate backup codes
   */
  backupCodes(count: number = 10): string[] {
    return generateBackupCodes(count);
  }
}

// Singleton with default config
export const twoFactor = new TwoFactor();
