import { describe, expect, test } from 'bun:test';
import { 
  hash, 
  hashPassword, 
  verifyPassword, 
  needsRehash,
  Hash 
} from '../src/utils/Hash';

describe('Hash', () => {
  describe('Password Hashing (bcrypt)', () => {
    test('should hash a password', async () => {
      const password = 'secret123';
      const hashed = await hashPassword(password);
      
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(0);
    });

    test('should verify correct password', async () => {
      const password = 'mypassword';
      const hashed = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hashed);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'mypassword';
      const hashed = await hashPassword(password);
      
      const isValid = await verifyPassword('wrongpassword', hashed);
      expect(isValid).toBe(false);
    });

    test('should generate different hashes for same password', async () => {
      const password = 'samepassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      
      // But both should verify
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('Hash Instance Methods', () => {
    test('make() should create hash', async () => {
      const hashed = await hash.make('password');
      expect(hashed).toBeDefined();
      expect(hashed.length).toBeGreaterThan(0);
    });

    test('check() should verify hash', async () => {
      const hashed = await hash.make('testpassword');
      expect(await hash.check('testpassword', hashed)).toBe(true);
      expect(await hash.check('wrong', hashed)).toBe(false);
    });
  });

  describe('SHA Hashing', () => {
    test('sha256() should create consistent hash', () => {
      const result1 = hash.sha256('hello');
      const result2 = hash.sha256('hello');
      
      expect(result1).toBe(result2);
      expect(result1.length).toBe(64); // 256 bits = 64 hex chars
    });

    test('sha512() should create consistent hash', () => {
      const result = hash.sha512('hello');
      expect(result.length).toBe(128); // 512 bits = 128 hex chars
    });

    test('md5() should create consistent hash', () => {
      const result = hash.md5('hello');
      expect(result.length).toBe(32); // 128 bits = 32 hex chars
    });
  });

  describe('HMAC', () => {
    test('hmac() should create consistent hash with key', () => {
      const result1 = hash.hmac('message', 'secret', 'sha256');
      const result2 = hash.hmac('message', 'secret', 'sha256');
      
      expect(result1).toBe(result2);
    });

    test('hmac() should produce different results with different keys', () => {
      const result1 = hash.hmac('message', 'key1', 'sha256');
      const result2 = hash.hmac('message', 'key2', 'sha256');
      
      expect(result1).not.toBe(result2);
    });
  });

  describe('Utility Methods', () => {
    test('random() should generate random string', () => {
      const rand1 = hash.random(16);
      const rand2 = hash.random(16);
      
      expect(rand1).not.toBe(rand2);
      expect(rand1.length).toBeGreaterThan(0);
    });

    test('timingSafeEqual() should compare strings safely', () => {
      expect(hash.timingSafeEqual('abc', 'abc')).toBe(true);
      expect(hash.timingSafeEqual('abc', 'def')).toBe(false);
      expect(hash.timingSafeEqual('abc', 'abcd')).toBe(false);
    });
  });

  describe('needsRehash', () => {
    test('should detect bcrypt hash', async () => {
      const hashed = await hashPassword('test');
      // needsRehash checks if current settings differ
      const result = needsRehash(hashed);
      expect(typeof result).toBe('boolean');
    });
  });
});
