/**
 * CanxJS Encrypt - Data encryption using AES-256-GCM
 * Laravel-compatible encryption with improved security
 */

// ============================================
// Types
// ============================================

export interface EncryptedPayload {
  iv: string;       // Initialization vector (base64)
  value: string;    // Encrypted value (base64)
  mac: string;      // Message authentication code
  tag?: string;     // GCM auth tag (for AES-GCM)
}

export interface EncryptConfig {
  key: string;              // Encryption key (base64 or hex)
  cipher?: 'aes-256-gcm' | 'aes-256-cbc';
}

// ============================================
// Encrypt Class
// ============================================

class Encrypt {
  private key: CryptoKey | null = null;
  private keyString: string = '';
  private cipher: 'aes-256-gcm' | 'aes-256-cbc' = 'aes-256-gcm';

  /**
   * Initialize the encryptor with a key
   */
  async init(config: EncryptConfig): Promise<void> {
    this.keyString = config.key;
    this.cipher = config.cipher || 'aes-256-gcm';
    
    // Derive the key from string
    const keyBytes = this.decodeKey(config.key);
    
    this.key = await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a value
   */
  async encrypt(value: unknown): Promise<string> {
    if (!this.key) {
      throw new Error('Encryptor not initialized. Call init() first.');
    }

    const payload = JSON.stringify(value);
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    
    // Generate random IV (12 bytes for GCM, 16 for CBC)
    const ivLength = this.cipher === 'aes-256-gcm' ? 12 : 16;
    const iv = crypto.getRandomValues(new Uint8Array(ivLength));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      this.key,
      data
    );

    // Create payload
    const encryptedArray = new Uint8Array(encrypted);
    const encryptedData = encryptedArray.slice(0, -16); // Data without tag
    const tag = encryptedArray.slice(-16); // Auth tag
    
    const encryptedPayload: EncryptedPayload = {
      iv: Buffer.from(iv).toString('base64'),
      value: Buffer.from(encryptedData).toString('base64'),
      mac: this.calculateMac(Buffer.from(iv).toString('base64'), Buffer.from(encryptedData).toString('base64')),
      tag: Buffer.from(tag).toString('base64'),
    };

    // Return base64 encoded JSON
    return Buffer.from(JSON.stringify(encryptedPayload)).toString('base64');
  }

  /**
   * Decrypt a value
   */
  async decrypt<T = unknown>(encrypted: string): Promise<T> {
    if (!this.key) {
      throw new Error('Encryptor not initialized. Call init() first.');
    }

    try {
      // Decode the payload
      const payloadJson = Buffer.from(encrypted, 'base64').toString('utf8');
      const payload: EncryptedPayload = JSON.parse(payloadJson);
      
      // Verify MAC
      const expectedMac = this.calculateMac(payload.iv, payload.value);
      if (!this.timingSafeEqual(payload.mac, expectedMac)) {
        throw new Error('MAC verification failed. Data may have been tampered with.');
      }

      // Decode components
      const iv = Buffer.from(payload.iv, 'base64');
      const encryptedData = Buffer.from(payload.value, 'base64');
      const tag = payload.tag ? Buffer.from(payload.tag, 'base64') : new Uint8Array(16);
      
      // Combine encrypted data and tag for decryption
      const combined = new Uint8Array(encryptedData.length + tag.length);
      combined.set(encryptedData);
      combined.set(tag, encryptedData.length);

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128,
        },
        this.key,
        combined
      );

      const decoder = new TextDecoder();
      const json = decoder.decode(decrypted);
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Encrypt a string (returns base64 string directly)
   */
  async encryptString(value: string): Promise<string> {
    return this.encrypt(value);
  }

  /**
   * Decrypt a string
   */
  async decryptString(encrypted: string): Promise<string> {
    return this.decrypt<string>(encrypted);
  }

  /**
   * Generate a new encryption key
   */
  static generateKey(length: number = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Buffer.from(bytes).toString('base64');
  }

  /**
   * Generate a key from a password using PBKDF2
   */
  static async deriveKey(password: string, salt?: string): Promise<string> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = salt 
      ? encoder.encode(salt) 
      : crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return Buffer.from(derivedBits).toString('base64');
  }

  // ============================================
  // Private Methods
  // ============================================

  private decodeKey(key: string): Uint8Array {
    // Try base64 first
    try {
      const decoded = Buffer.from(key, 'base64');
      if (decoded.length === 32) return decoded;
    } catch {}
    
    // Try hex
    try {
      const decoded = Buffer.from(key, 'hex');
      if (decoded.length === 32) return decoded;
    } catch {}
    
    // Hash the key to get 32 bytes
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(key);
    return new Uint8Array(hasher.digest());
  }

  private calculateMac(iv: string, value: string): string {
    const hmac = new Bun.CryptoHasher('sha256', Buffer.from(this.keyString));
    hmac.update(`${iv}${value}`);
    return hmac.digest('hex');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    
    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
      result |= bufA[i] ^ bufB[i];
    }
    
    return result === 0;
  }
}

// ============================================
// Singleton Instance & Helper Functions
// ============================================

export const encryptor = new Encrypt();

/**
 * Initialize the encryptor
 */
export async function initEncrypt(config: EncryptConfig): Promise<void> {
  await encryptor.init(config);
}

/**
 * Encrypt a value
 */
export async function encrypt(value: unknown): Promise<string> {
  return encryptor.encrypt(value);
}

/**
 * Decrypt a value
 */
export async function decrypt<T = unknown>(encrypted: string): Promise<T> {
  return encryptor.decrypt<T>(encrypted);
}

/**
 * Generate a new encryption key
 */
export function generateKey(length?: number): string {
  return Encrypt.generateKey(length);
}

/**
 * Derive a key from password
 */
export async function deriveKey(password: string, salt?: string): Promise<string> {
  return Encrypt.deriveKey(password, salt);
}

export { Encrypt };
export default encryptor;
