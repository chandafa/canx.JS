/**
 * S3 Storage Driver Tests
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import S3Driver from '../src/storage/drivers/S3Driver';
import type { S3DriverConfig } from '../src/storage/drivers/types';

// ============================================
// Test: S3Driver Class
// ============================================

describe('S3Driver', () => {
  const testConfig: S3DriverConfig = {
    region: 'us-east-1',
    bucket: 'test-bucket',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key'
  };

  let driver: S3Driver;

  beforeEach(() => {
    driver = new S3Driver(testConfig);
  });

  test('should create instance', () => {
    expect(driver).toBeInstanceOf(S3Driver);
  });

  test('should have put() method', () => {
    expect(typeof driver.put).toBe('function');
  });

  test('should have get() method', () => {
    expect(typeof driver.get).toBe('function');
  });

  test('should have delete() method', () => {
    expect(typeof driver.delete).toBe('function');
  });

  test('should have exists() method', () => {
    expect(typeof driver.exists).toBe('function');
  });

  test('should have copy() method', () => {
    expect(typeof driver.copy).toBe('function');
  });

  test('should have move() method', () => {
    expect(typeof driver.move).toBe('function');
  });

  test('should have url() method', () => {
    expect(typeof driver.url).toBe('function');
  });

  test('should have temporaryUrl() method', () => {
    expect(typeof driver.temporaryUrl).toBe('function');
  });

  test('should have metadata() method', () => {
    expect(typeof driver.metadata).toBe('function');
  });

  test('should have files() method', () => {
    expect(typeof driver.files).toBe('function');
  });

  test('should have allFiles() method', () => {
    expect(typeof driver.allFiles).toBe('function');
  });

  test('should have makeDirectory() method', () => {
    expect(typeof driver.makeDirectory).toBe('function');
  });

  test('should have deleteDirectory() method', () => {
    expect(typeof driver.deleteDirectory).toBe('function');
  });

  test('should have append() method', () => {
    expect(typeof driver.append).toBe('function');
  });

  test('should have prepend() method', () => {
    expect(typeof driver.prepend).toBe('function');
  });
});

// ============================================
// Test: URL Generation
// ============================================

describe('S3Driver URL', () => {
  test('url() should return correct S3 URL', () => {
    const driver = new S3Driver({
      region: 'us-west-2',
      bucket: 'my-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret'
    });

    const url = driver.url('path/to/file.jpg');
    expect(url).toContain('my-bucket');
    expect(url).toContain('path/to/file.jpg');
  });

  test('url() should include bucket name', () => {
    const driver = new S3Driver({
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret'
    });

    const url = driver.url('test.txt');
    expect(url).toContain('test-bucket');
  });
});

// ============================================
// Test: makeDirectory (S3 behavior)
// ============================================

describe('S3Driver makeDirectory', () => {
  test('makeDirectory() should return true (S3 does not need explicit directories)', async () => {
    const driver = new S3Driver({
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret'
    });

    // S3 doesn't require explicit directory creation
    const result = await driver.makeDirectory('some/path');
    expect(result).toBe(true);
  });
});

// ============================================
// Test: Configuration
// ============================================

describe('S3Driver Configuration', () => {
  test('should use default AWS endpoint pattern', () => {
    const driver = new S3Driver({
      region: 'eu-central-1',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret'
    });

    const url = driver.url('file.txt');
    expect(url).toContain('.amazonaws.com');
    expect(url).toContain('test-bucket');
    expect(url).toContain('file.txt');
  });

  test('should include region in URL', () => {
    const driver = new S3Driver({
      region: 'ap-southeast-1',
      bucket: 'asia-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret'
    });

    const url = driver.url('data.json');
    expect(url).toContain('ap-southeast-1');
  });

  test('should properly format with different bucket names', () => {
    const driver = new S3Driver({
      region: 'us-east-1',
      bucket: 'my-special-bucket-2024',
      accessKeyId: 'key',
      secretAccessKey: 'secret'
    });

    const url = driver.url('reports/annual.pdf');
    expect(url).toContain('my-special-bucket-2024');
    expect(url).toContain('reports/annual.pdf');
  });
});


// ============================================
// Test: Path Handling
// ============================================

describe('S3Driver Path Handling', () => {
  let driver: S3Driver;

  beforeEach(() => {
    driver = new S3Driver({
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret'
    });
  });

  test('should handle path with leading slash', () => {
    const url = driver.url('/path/to/file.txt');
    expect(url).toContain('path/to/file.txt');
  });

  test('should handle path without leading slash', () => {
    const url = driver.url('path/to/file.txt');
    expect(url).toContain('path/to/file.txt');
  });

  test('should handle nested paths', () => {
    const url = driver.url('deeply/nested/path/to/file.txt');
    expect(url).toContain('deeply/nested/path/to/file.txt');
  });

  test('should handle single file in root', () => {
    const url = driver.url('file.txt');
    expect(url).toContain('file.txt');
  });
});
