/**
 * CanxJS Hash - Secure password hashing using Bun's built-in crypto
 * Supports bcrypt and argon2 (via external libs if installed)
 */
export type HashDriver = 'bcrypt' | 'argon2' | 'scrypt';
export interface HashOptions {
    rounds?: number;
    memoryCost?: number;
    timeCost?: number;
    parallelism?: number;
    cost?: number;
    blockSize?: number;
}
declare class Hash {
    private driver;
    private options;
    /**
     * Set the default hash driver
     */
    setDriver(driver: HashDriver): this;
    /**
     * Configure hash options
     */
    configure(options: Partial<HashOptions>): this;
    /**
     * Hash a password using the current driver
     */
    make(value: string, options?: HashOptions): Promise<string>;
    /**
     * Verify a password against a hash
     */
    check(value: string, hash: string): Promise<boolean>;
    /**
     * Check if a hash needs rehashing (e.g., cost changed)
     */
    needsRehash(hash: string, options?: HashOptions): boolean;
    private bcryptHash;
    private bcryptVerify;
    private argon2Hash;
    private argon2Verify;
    private scryptHash;
    private scryptVerify;
    private scryptDeriveKey;
    /**
     * Timing-safe string comparison
     */
    private timingSafeEqual;
    /**
     * Generate a random string
     */
    random(length?: number): string;
    /**
     * Create a SHA-256 hash
     */
    sha256(value: string): string;
    /**
     * Create a SHA-512 hash
     */
    sha512(value: string): string;
    /**
     * Create an MD5 hash (not for passwords!)
     */
    md5(value: string): string;
    /**
     * Create an HMAC
     */
    hmac(value: string, key: string, algorithm?: 'sha256' | 'sha512'): string;
}
export declare const hash: Hash;
/**
 * Hash a password
 */
export declare function hashPassword(value: string, options?: HashOptions): Promise<string>;
/**
 * Verify a password
 */
export declare function verifyPassword(value: string, hashedValue: string): Promise<boolean>;
/**
 * Check if password needs rehashing
 */
export declare function needsRehash(hashedValue: string, options?: HashOptions): boolean;
export { Hash };
export default hash;
