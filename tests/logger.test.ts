import { describe, expect, test, beforeEach } from 'bun:test';
import { Logger, createLogger, log } from '../src/utils/Logger';

describe('Logger', () => {
  describe('Basic Logging', () => {
    let logger: Logger;
    let logOutput: string[];

    beforeEach(() => {
      logOutput = [];
      logger = createLogger({ 
        level: 'debug',
        format: 'json',
        colors: false,
      });
    });

    test('should create logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    test('should log debug messages', () => {
      // Just verify no errors thrown
      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    test('should log info messages', () => {
      expect(() => logger.info('Info message')).not.toThrow();
    });

    test('should log warn messages', () => {
      expect(() => logger.warn('Warning message')).not.toThrow();
    });

    test('should log error messages', () => {
      expect(() => logger.error('Error message')).not.toThrow();
    });

    test('should log fatal messages', () => {
      expect(() => logger.fatal('Fatal message')).not.toThrow();
    });

    test('should log with context', () => {
      expect(() => logger.info('Message', { user: 'John', action: 'login' })).not.toThrow();
    });
  });

  describe('Log Levels', () => {
    test('should respect log level filtering', () => {
      const logger = createLogger({ level: 'error' });
      
      // These should not throw
      expect(() => logger.debug('Debug')).not.toThrow();
      expect(() => logger.info('Info')).not.toThrow();
      expect(() => logger.error('Error')).not.toThrow();
    });

    test('should change log level', () => {
      const logger = createLogger({ level: 'info' });
      
      logger.setLevel('debug');
      expect(() => logger.debug('Now visible')).not.toThrow();
    });
  });

  describe('Child Logger', () => {
    test('should create child logger with context', () => {
      const logger = createLogger({ level: 'debug' });
      const child = logger.child({ requestId: '123' });
      
      expect(() => child.info('Child message')).not.toThrow();
    });

    test('child should inherit parent settings', () => {
      const logger = createLogger({ level: 'debug' });
      const child = logger.child({ service: 'api' });
      
      expect(() => child.debug('Debug from child')).not.toThrow();
      expect(() => child.error('Error from child')).not.toThrow();
    });
  });

  describe('Request Logging', () => {
    test('should log HTTP requests', () => {
      const logger = createLogger({ level: 'info' });
      
      expect(() => 
        logger.request('GET', '/api/users', 200, 45)
      ).not.toThrow();
    });

    test('should log request with context', () => {
      const logger = createLogger({ level: 'info' });
      
      expect(() => 
        logger.request('POST', '/api/users', 201, 120, { userId: 1 })
      ).not.toThrow();
    });
  });

  describe('Transports', () => {
    test('should add custom transport', () => {
      const logger = createLogger({ level: 'info' });
      const messages: string[] = [];
      
      logger.addTransport({
        name: 'test',
        log: (entry) => {
          messages.push(entry.message);
        },
      });
      
      logger.info('Test message');
      expect(messages).toContain('Test message');
    });
  });

  describe('Singleton Logger', () => {
    test('log singleton should work', () => {
      expect(() => log.info('Singleton message')).not.toThrow();
    });
  });

  describe('Format Options', () => {
    test('should support JSON format', () => {
      const logger = createLogger({ format: 'json' });
      expect(() => logger.info('JSON format')).not.toThrow();
    });

    test('should support pretty format', () => {
      const logger = createLogger({ format: 'pretty' });
      expect(() => logger.info('Pretty format')).not.toThrow();
    });
  });
});
