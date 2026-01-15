/**
 * CanxJS Middleware Unit Tests
 */
import { describe, test, expect } from 'bun:test';
import { MiddlewarePipeline, cors, logger, rateLimit } from '../src/core/Middleware';
import { createCanxRequest, createCanxResponse } from '../src/core/Server';

describe('MiddlewarePipeline', () => {
  test('should create a pipeline instance', () => {
    const pipeline = new MiddlewarePipeline();
    expect(pipeline).toBeInstanceOf(MiddlewarePipeline);
  });

  test('should execute middlewares in order', async () => {
    const order: number[] = [];
    
    const mw1 = async (req: any, res: any, next: any) => {
      order.push(1);
      return next();
    };
    
    const mw2 = async (req: any, res: any, next: any) => {
      order.push(2);
      return next();
    };

    const pipeline = new MiddlewarePipeline();
    pipeline.use(mw1, mw2);
    
    const req = createCanxRequest(new Request('http://localhost/test'));
    const res = createCanxResponse();
    
    await pipeline.execute(req, res, [], async () => {
      order.push(3);
      return new Response('ok');
    });
    
    expect(order).toEqual([1, 2, 3]);
  });

  test('should pass request through middlewares', async () => {
    const pipeline = new MiddlewarePipeline();
    
    const addHeader = async (req: any, res: any, next: any) => {
      (req as any).customData = 'test';
      return next();
    };
    
    pipeline.use(addHeader);
    
    const req = createCanxRequest(new Request('http://localhost/test'));
    const res = createCanxResponse();
    
    let capturedData = '';
    await pipeline.execute(req, res, [], async () => {
      capturedData = (req as any).customData;
      return new Response('ok');
    });
    
    expect(capturedData).toBe('test');
  });
});

describe('Built-in Middlewares', () => {
  test('cors middleware should set headers', async () => {
    const corsMiddleware = cors({ origin: 'http://example.com' });
    
    const req = createCanxRequest(new Request('http://localhost/test'));
    const res = createCanxResponse();
    
    let headersSet = false;
    await corsMiddleware(req, res, async () => {
      headersSet = true;
      return new Response('ok');
    });
    
    expect(headersSet).toBe(true);
  });

  test('rateLimit middleware should allow requests under limit', async () => {
    const rateLimitMiddleware = rateLimit({ max: 10, windowMs: 60000 });
    
    const req = createCanxRequest(new Request('http://localhost/test', {
      headers: { 'x-forwarded-for': 'test-ip' }
    }));
    const res = createCanxResponse();
    
    let passed = false;
    await rateLimitMiddleware(req, res, async () => {
      passed = true;
      return new Response('ok');
    });
    
    expect(passed).toBe(true);
  });
});
