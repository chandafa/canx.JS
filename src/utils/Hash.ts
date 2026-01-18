/**
 * CanxJS Hash - Secure password hashing using Bun's built-in crypto
 * Supports bcrypt and argon2 (via external libs if installed)
 */

// ============================================
// Types
// ============================================

export type HashDriver = 'bcrypt' | 'argon2' | 'scrypt';

export interface HashOptions {
  rounds?: number;        // bcrypt rounds (default: 12)
  memoryCost?: number;    // argon2 memory cost (default: 65536)
  timeCost?: number;      // argon2 time cost (default: 3)
  parallelism?: number;   // argon2 parallelism (default: 4)
  cost?: number;          // scrypt cost (default: 16384)
  blockSize?: number;     // scrypt block size (default: 8)
}

// ============================================
// Hash Class
// ============================================

class Hash {
  private driver: HashDriver = 'bcrypt';
  private options: HashOptions = {
    rounds: 12,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    cost: 16384,
    blockSize: 8,
  };

  /**
   * Set the default hash driver
   */
  setDriver(driver: HashDriver): this {
    this.driver = driver;
    return this;
  }

  /**
   * Configure hash options
   */
  configure(options: Partial<HashOptions>): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Hash a password using the current driver
   */
  async make(value: string, options?: HashOptions): Promise<string> {
    const opts = { ...this.options, ...options };
    
    switch (this.driver) {
      case 'bcrypt':
        return this.bcryptHash(value, opts.rounds!);
      case 'argon2':
        return this.argon2Hash(value, opts);
      case 'scrypt':
        return this.scryptHash(value, opts);
      default:
        return this.bcryptHash(value, opts.rounds!);
    }
  }

  /**
   * Verify a password against a hash
   */
  async check(value: string, hash: string): Promise<boolean> {
    // Detect hash type from prefix
    if (hash.startsWith('$2') || hash.startsWith('$bcrypt')) {
      return this.bcryptVerify(value, hash);
    }
    if (hash.startsWith('$argon2')) {
      return this.argon2Verify(value, hash);
    }
    if (hash.startsWith('$scrypt')) {
      return this.scryptVerify(value, hash);
    }
    
    // Default to bcrypt
    return this.bcryptVerify(value, hash);
  }

  /**
   * Check if a hash needs rehashing (e.g., cost changed)
   */
  needsRehash(hash: string, options?: HashOptions): boolean {
    const opts = { ...this.options, ...options };
    
    // Extract cost from bcrypt hash
    if (hash.startsWith('$2')) {
      const match = hash.match(/\$2[aby]?\$(\d+)\$/);
      if (match) {
        const currentRounds = parseInt(match[1], 10);
        return currentRounds < opts.rounds!;
      }
    }
    
    return false;
  }

  // ============================================
  // BCrypt Implementation (using Bun's built-in)
  // ============================================

  private async bcryptHash(value: string, rounds: number): Promise<string> {
    // Bun has built-in bcrypt support via Bun.password
    return await Bun.password.hash(value, {
      algorithm: 'bcrypt',
      cost: rounds,
    });
  }

  private async bcryptVerify(value: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(value, hash);
  }

  // ============================================
  // Argon2 Implementation
  // ============================================

  private async argon2Hash(value: string, options: HashOptions): Promise<string> {
    // Bun has built-in argon2 support
    return await Bun.password.hash(value, {
      algorithm: 'argon2id',
      memoryCost: options.memoryCost,
      timeCost: options.timeCost,
    });
  }

  private async argon2Verify(value: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(value, hash);
  }

  // ============================================
  // Scrypt Implementation
  // ============================================

  private async scryptHash(value: string, options: HashOptions): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Buffer.from(salt).toString('hex');
    
    const hashBuffer = await this.scryptDeriveKey(value, salt, options);
    const hashHex = Buffer.from(hashBuffer).toString('hex');
    
    return `$scrypt$n=${options.cost}$r=${options.blockSize}$${saltHex}$${hashHex}`;
  }

  private async scryptVerify(value: string, hash: string): Promise<boolean> {
    const parts = hash.split('$');
    if (parts.length < 5) return false;
    
    const n = parseInt(parts[2].split('=')[1], 10);
    const r = parseInt(parts[3].split('=')[1], 10);
    const salt = Buffer.from(parts[4], 'hex');
    const expectedHash = parts[5];
    
    const hashBuffer = await this.scryptDeriveKey(value, salt, { cost: n, blockSize: r });
    const actualHash = Buffer.from(hashBuffer).toString('hex');
    
    return this.timingSafeEqual(expectedHash, actualHash);
  }

  private async scryptDeriveKey(
    password: string, 
    salt: Uint8Array | Buffer, 
    options: HashOptions
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Convert salt to proper ArrayBuffer for Web Crypto API
    const saltArray = new Uint8Array(salt);
    
    // Use Web Crypto API for scrypt-like derivation (PBKDF2 as fallback)
    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    return crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltArray.buffer as ArrayBuffer,
        iterations: options.cost || 16384,
        hash: 'SHA-256',
      },
      key,
      256
    );
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Timing-safe string comparison
   */
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

  /**
   * Generate a random string
   */
  random(length: number = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Buffer.from(bytes).toString('hex').slice(0, length);
  }

  /**
   * Create a SHA-256 hash
   */
  sha256(value: string): string {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(value);
    return hasher.digest('hex');
  }

  /**
   * Create a SHA-512 hash
   */
  sha512(value: string): string {
    const hasher = new Bun.CryptoHasher('sha512');
    hasher.update(value);
    return hasher.digest('hex');
  }

  /**
   * Create an MD5 hash (not for passwords!)
   */
  md5(value: string): string {
    const hasher = new Bun.CryptoHasher('md5');
    hasher.update(value);
    return hasher.digest('hex');
  }

  /**
   * Create an HMAC
   */
  hmac(value: string, key: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const valueData = encoder.encode(value);
    
    // Use Bun's HMAC
    const hmac = new Bun.CryptoHasher(algorithm, keyData);
    hmac.update(valueData);
    return hmac.digest('hex');
  }
}

// ============================================
// Singleton Instance & Helper Functions
// ============================================

export const hash = new Hash();

/**
 * Hash a password
 */
export async function hashPassword(value: string, options?: HashOptions): Promise<string> {
  return hash.make(value, options);
}

/**
 * Verify a password
 */
export async function verifyPassword(value: string, hashedValue: string): Promise<boolean> {
  return hash.check(value, hashedValue);
}

/**
 * Check if password needs rehashing
 */
export function needsRehash(hashedValue: string, options?: HashOptions): boolean {
  return hash.needsRehash(hashedValue, options);
}

export { Hash };
export default hash;
