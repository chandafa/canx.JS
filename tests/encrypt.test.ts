import { describe, expect, test, beforeAll } from 'bun:test';
import { 
  encryptor,
  initEncrypt, 
  encrypt, 
  decrypt, 
  generateKey, 
  deriveKey,
  Encrypt 
} from '../src/utils/Encrypt';

describe('Encrypt', () => {
  const testKey = generateKey();

  beforeAll(async () => {
    await initEncrypt({ key: testKey });
  });

  describe('Key Generation', () => {
    test('generateKey() should create base64 encoded key', () => {
      const key = generateKey();
      expect(key).toBeDefined();
      expect(key.length).toBeGreaterThan(0);
      // Base64 decode should give 32 bytes
      const decoded = Buffer.from(key, 'base64');
      expect(decoded.length).toBe(32);
    });

    test('generateKey() should create unique keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });

    test('deriveKey() should derive key from password', async () => {
      const key = await deriveKey('mypassword', 'salt123');
      expect(key).toBeDefined();
      expect(key.length).toBeGreaterThan(0);
    });

    test('deriveKey() should produce consistent results with same salt', async () => {
      const key1 = await deriveKey('password', 'fixedsalt');
      const key2 = await deriveKey('password', 'fixedsalt');
      expect(key1).toBe(key2);
    });

    test('deriveKey() should produce different results with different salts', async () => {
      const key1 = await deriveKey('password', 'salt1');
      const key2 = await deriveKey('password', 'salt2');
      expect(key1).not.toBe(key2);
    });
  });

  describe('Encryption/Decryption', () => {
    test('should encrypt and decrypt string', async () => {
      const original = 'Hello, World!';
      const encrypted = await encrypt(original);
      const decrypted = await decrypt<string>(encrypted);
      
      expect(encrypted).not.toBe(original);
      expect(decrypted).toBe(original);
    });

    test('should encrypt and decrypt object', async () => {
      const original = { name: 'John', age: 30 };
      const encrypted = await encrypt(original);
      const decrypted = await decrypt<typeof original>(encrypted);
      
      expect(decrypted).toEqual(original);
    });

    test('should encrypt and decrypt array', async () => {
      const original = [1, 2, 3, 'four', { five: 5 }];
      const encrypted = await encrypt(original);
      const decrypted = await decrypt<typeof original>(encrypted);
      
      expect(decrypted).toEqual(original);
    });

    test('should encrypt and decrypt null', async () => {
      const encrypted = await encrypt(null);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBeNull();
    });

    test('should encrypt and decrypt boolean', async () => {
      const encrypted = await encrypt(true);
      const decrypted = await decrypt<boolean>(encrypted);
      expect(decrypted).toBe(true);
    });

    test('should produce different ciphertext for same plaintext', async () => {
      const original = 'same message';
      const encrypted1 = await encrypt(original);
      const encrypted2 = await encrypt(original);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same value
      expect(await decrypt(encrypted1)).toBe(original);
      expect(await decrypt(encrypted2)).toBe(original);
    });
  });

  describe('Error Handling', () => {
    test('should fail to decrypt with wrong key', async () => {
      const encrypted = await encrypt('secret data');
      
      // Create new encryptor with different key
      const otherEncryptor = new Encrypt();
      await otherEncryptor.init({ key: generateKey() });
      
      await expect(otherEncryptor.decrypt(encrypted)).rejects.toThrow();
    });

    test('should fail to decrypt tampered data', async () => {
      const encrypted = await encrypt('original data');
      // Tamper with encrypted data
      const tampered = encrypted.slice(0, -2) + 'XX';
      
      await expect(decrypt(tampered)).rejects.toThrow();
    });
  });

  describe('Encrypt Instance', () => {
    test('encryptString() should work', async () => {
      const encrypted = await encryptor.encryptString('hello');
      const decrypted = await encryptor.decryptString(encrypted);
      expect(decrypted).toBe('hello');
    });
  });
});
