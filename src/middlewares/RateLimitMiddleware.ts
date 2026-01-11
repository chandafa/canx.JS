import type { MiddlewareHandler, CanxRequest, CanxResponse } from '../types';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string | object;
  statusCode?: number;
  keyGenerator?: (req: CanxRequest) => string;
}

// Simple in-memory store. In production for multiple instances, Redis is recommended.
// This is exposed so it can be swapped if needed.
class MemoryStore {
  hits = new Map<string, { count: number; resetTime: number }>();

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    let record = this.hits.get(key);

    if (!record || record.resetTime <= now) {
      record = { count: 1, resetTime: now + windowMs };
    } else {
      record.count++;
    }

    this.hits.set(key, record);
    return record;
  }
}

export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const store = new MemoryStore();
  const {
    windowMs = 60000,
    max = 100,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    keyGenerator = (req: CanxRequest) => req.header('x-forwarded-for') || req.header('cf-connecting-ip') || 'unknown-ip'
  } = config;

  return async (req, res, next) => {
    const key = keyGenerator(req);
    const { count, resetTime } = store.increment(key, windowMs);

    const remaining = Math.max(0, max - count);
    const resetDate = new Date(resetTime);

    // Standard Rate Limit Headers
    res.header('X-RateLimit-Limit', String(max));
    res.header('X-RateLimit-Remaining', String(remaining));
    res.header('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    if (count > max) {
      if (typeof message === 'object') {
        return res.status(statusCode).json(message);
      }
      return res.status(statusCode).text(String(message));
    }

    return next();
  };
}
