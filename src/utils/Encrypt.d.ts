/**
 * CanxJS Encrypt - Data encryption using AES-256-GCM
 * Laravel-compatible encryption with improved security
 */
export interface EncryptedPayload {
    iv: string;
    value: string;
    mac: string;
    tag?: string;
}
export interface EncryptConfig {
    key: string;
    cipher?: 'aes-256-gcm' | 'aes-256-cbc';
}
declare class Encrypt {
    private key;
    private keyString;
    private cipher;
    /**
     * Initialize the encryptor with a key
     */
    init(config: EncryptConfig): Promise<void>;
    /**
     * Encrypt a value
     */
    encrypt(value: unknown): Promise<string>;
    /**
     * Decrypt a value
     */
    decrypt<T = unknown>(encrypted: string): Promise<T>;
    /**
     * Encrypt a string (returns base64 string directly)
     */
    encryptString(value: string): Promise<string>;
    /**
     * Decrypt a string
     */
    decryptString(encrypted: string): Promise<string>;
    /**
     * Generate a new encryption key
     */
    static generateKey(length?: number): string;
    /**
     * Generate a key from a password using PBKDF2
     */
    static deriveKey(password: string, salt?: string): Promise<string>;
    private decodeKey;
    private calculateMac;
    private timingSafeEqual;
}
export declare const encryptor: Encrypt;
/**
 * Initialize the encryptor
 */
export declare function initEncrypt(config: EncryptConfig): Promise<void>;
/**
 * Encrypt a value
 */
export declare function encrypt(value: unknown): Promise<string>;
/**
 * Decrypt a value
 */
export declare function decrypt<T = unknown>(encrypted: string): Promise<T>;
/**
 * Generate a new encryption key
 */
export declare function generateKey(length?: number): string;
/**
 * Derive a key from password
 */
export declare function deriveKey(password: string, salt?: string): Promise<string>;
export { Encrypt };
export default encryptor;
