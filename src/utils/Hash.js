"use strict";
/**
 * CanxJS Hash - Secure password hashing using Bun's built-in crypto
 * Supports bcrypt and argon2 (via external libs if installed)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hash = exports.hash = void 0;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.needsRehash = needsRehash;
// ============================================
// Hash Class
// ============================================
class Hash {
    driver = 'bcrypt';
    options = {
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
    setDriver(driver) {
        this.driver = driver;
        return this;
    }
    /**
     * Configure hash options
     */
    configure(options) {
        this.options = { ...this.options, ...options };
        return this;
    }
    /**
     * Hash a password using the current driver
     */
    async make(value, options) {
        const opts = { ...this.options, ...options };
        switch (this.driver) {
            case 'bcrypt':
                return this.bcryptHash(value, opts.rounds);
            case 'argon2':
                return this.argon2Hash(value, opts);
            case 'scrypt':
                return this.scryptHash(value, opts);
            default:
                return this.bcryptHash(value, opts.rounds);
        }
    }
    /**
     * Verify a password against a hash
     */
    async check(value, hash) {
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
    needsRehash(hash, options) {
        const opts = { ...this.options, ...options };
        // Extract cost from bcrypt hash
        if (hash.startsWith('$2')) {
            const match = hash.match(/\$2[aby]?\$(\d+)\$/);
            if (match) {
                const currentRounds = parseInt(match[1], 10);
                return currentRounds < opts.rounds;
            }
        }
        return false;
    }
    // ============================================
    // BCrypt Implementation (using Bun's built-in)
    // ============================================
    async bcryptHash(value, rounds) {
        // Bun has built-in bcrypt support via Bun.password
        return await Bun.password.hash(value, {
            algorithm: 'bcrypt',
            cost: rounds,
        });
    }
    async bcryptVerify(value, hash) {
        return await Bun.password.verify(value, hash);
    }
    // ============================================
    // Argon2 Implementation
    // ============================================
    async argon2Hash(value, options) {
        // Bun has built-in argon2 support
        return await Bun.password.hash(value, {
            algorithm: 'argon2id',
            memoryCost: options.memoryCost,
            timeCost: options.timeCost,
        });
    }
    async argon2Verify(value, hash) {
        return await Bun.password.verify(value, hash);
    }
    // ============================================
    // Scrypt Implementation
    // ============================================
    async scryptHash(value, options) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltHex = Buffer.from(salt).toString('hex');
        const hashBuffer = await this.scryptDeriveKey(value, salt, options);
        const hashHex = Buffer.from(hashBuffer).toString('hex');
        return `$scrypt$n=${options.cost}$r=${options.blockSize}$${saltHex}$${hashHex}`;
    }
    async scryptVerify(value, hash) {
        const parts = hash.split('$');
        if (parts.length < 5)
            return false;
        const n = parseInt(parts[2].split('=')[1], 10);
        const r = parseInt(parts[3].split('=')[1], 10);
        const salt = Buffer.from(parts[4], 'hex');
        const expectedHash = parts[5];
        const hashBuffer = await this.scryptDeriveKey(value, salt, { cost: n, blockSize: r });
        const actualHash = Buffer.from(hashBuffer).toString('hex');
        return this.timingSafeEqual(expectedHash, actualHash);
    }
    async scryptDeriveKey(password, salt, options) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        // Convert salt to proper ArrayBuffer for Web Crypto API
        const saltArray = new Uint8Array(salt);
        // Use Web Crypto API for scrypt-like derivation (PBKDF2 as fallback)
        const key = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
        return crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt: saltArray.buffer,
            iterations: options.cost || 16384,
            hash: 'SHA-256',
        }, key, 256);
    }
    // ============================================
    // Utility Methods
    // ============================================
    /**
     * Timing-safe string comparison
     */
    timingSafeEqual(a, b) {
        if (a.length !== b.length)
            return false;
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
    random(length = 32) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        return Buffer.from(bytes).toString('hex').slice(0, length);
    }
    /**
     * Create a SHA-256 hash
     */
    sha256(value) {
        const hasher = new Bun.CryptoHasher('sha256');
        hasher.update(value);
        return hasher.digest('hex');
    }
    /**
     * Create a SHA-512 hash
     */
    sha512(value) {
        const hasher = new Bun.CryptoHasher('sha512');
        hasher.update(value);
        return hasher.digest('hex');
    }
    /**
     * Create an MD5 hash (not for passwords!)
     */
    md5(value) {
        const hasher = new Bun.CryptoHasher('md5');
        hasher.update(value);
        return hasher.digest('hex');
    }
    /**
     * Create an HMAC
     */
    hmac(value, key, algorithm = 'sha256') {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(key);
        const valueData = encoder.encode(value);
        // Use Bun's HMAC
        const hmac = new Bun.CryptoHasher(algorithm, keyData);
        hmac.update(valueData);
        return hmac.digest('hex');
    }
}
exports.Hash = Hash;
// ============================================
// Singleton Instance & Helper Functions
// ============================================
exports.hash = new Hash();
/**
 * Hash a password
 */
async function hashPassword(value, options) {
    return exports.hash.make(value, options);
}
/**
 * Verify a password
 */
async function verifyPassword(value, hashedValue) {
    return exports.hash.check(value, hashedValue);
}
/**
 * Check if password needs rehashing
 */
function needsRehash(hashedValue, options) {
    return exports.hash.needsRehash(hashedValue, options);
}
exports.default = exports.hash;
