"use strict";
/**
 * CanxJS Encrypt - Data encryption using AES-256-GCM
 * Laravel-compatible encryption with improved security
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Encrypt = exports.encryptor = void 0;
exports.initEncrypt = initEncrypt;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.generateKey = generateKey;
exports.deriveKey = deriveKey;
// ============================================
// Encrypt Class
// ============================================
class Encrypt {
    key = null;
    keyString = '';
    cipher = 'aes-256-gcm';
    /**
     * Initialize the encryptor with a key
     */
    async init(config) {
        this.keyString = config.key;
        this.cipher = config.cipher || 'aes-256-gcm';
        // Derive the key from string
        const keyBytes = this.decodeKey(config.key);
        this.key = await crypto.subtle.importKey('raw', keyBytes.buffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    /**
     * Encrypt a value
     */
    async encrypt(value) {
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
        const encrypted = await crypto.subtle.encrypt({
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128,
        }, this.key, data);
        // Create payload
        const encryptedArray = new Uint8Array(encrypted);
        const encryptedData = encryptedArray.slice(0, -16); // Data without tag
        const tag = encryptedArray.slice(-16); // Auth tag
        const encryptedPayload = {
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
    async decrypt(encrypted) {
        if (!this.key) {
            throw new Error('Encryptor not initialized. Call init() first.');
        }
        try {
            // Decode the payload
            const payloadJson = Buffer.from(encrypted, 'base64').toString('utf8');
            const payload = JSON.parse(payloadJson);
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
            const decrypted = await crypto.subtle.decrypt({
                name: 'AES-GCM',
                iv: iv,
                tagLength: 128,
            }, this.key, combined);
            const decoder = new TextDecoder();
            const json = decoder.decode(decrypted);
            return JSON.parse(json);
        }
        catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
    /**
     * Encrypt a string (returns base64 string directly)
     */
    async encryptString(value) {
        return this.encrypt(value);
    }
    /**
     * Decrypt a string
     */
    async decryptString(encrypted) {
        return this.decrypt(encrypted);
    }
    /**
     * Generate a new encryption key
     */
    static generateKey(length = 32) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        return Buffer.from(bytes).toString('base64');
    }
    /**
     * Generate a key from a password using PBKDF2
     */
    static async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBuffer = salt
            ? encoder.encode(salt)
            : crypto.getRandomValues(new Uint8Array(16));
        const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
        const derivedBits = await crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 100000,
            hash: 'SHA-256',
        }, keyMaterial, 256);
        return Buffer.from(derivedBits).toString('base64');
    }
    // ============================================
    // Private Methods
    // ============================================
    decodeKey(key) {
        // Try base64 first
        try {
            const decoded = Buffer.from(key, 'base64');
            if (decoded.length === 32)
                return decoded;
        }
        catch { }
        // Try hex
        try {
            const decoded = Buffer.from(key, 'hex');
            if (decoded.length === 32)
                return decoded;
        }
        catch { }
        // Hash the key to get 32 bytes
        const hasher = new Bun.CryptoHasher('sha256');
        hasher.update(key);
        return new Uint8Array(hasher.digest());
    }
    calculateMac(iv, value) {
        const hmac = new Bun.CryptoHasher('sha256', Buffer.from(this.keyString));
        hmac.update(`${iv}${value}`);
        return hmac.digest('hex');
    }
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
}
exports.Encrypt = Encrypt;
// ============================================
// Singleton Instance & Helper Functions
// ============================================
exports.encryptor = new Encrypt();
/**
 * Initialize the encryptor
 */
async function initEncrypt(config) {
    await exports.encryptor.init(config);
}
/**
 * Encrypt a value
 */
async function encrypt(value) {
    return exports.encryptor.encrypt(value);
}
/**
 * Decrypt a value
 */
async function decrypt(encrypted) {
    return exports.encryptor.decrypt(encrypted);
}
/**
 * Generate a new encryption key
 */
function generateKey(length) {
    return Encrypt.generateKey(length);
}
/**
 * Derive a key from password
 */
async function deriveKey(password, salt) {
    return Encrypt.deriveKey(password, salt);
}
exports.default = exports.encryptor;
