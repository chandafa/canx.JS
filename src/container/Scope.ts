/**
 * CanxJS Provider Scopes
 * NestJS-compatible injection scopes for dependency injection
 */

// ============================================
// Scope Enum
// ============================================

/**
 * Provider scope determines the lifetime of provider instances
 */
export enum Scope {
  /**
   * Default scope - Singleton instance shared across the entire application
   * Instance is created once and cached for all subsequent resolves
   */
  DEFAULT = 'DEFAULT',
  
  /**
   * Request scope - New instance for each request
   * Instance is created once per HTTP request and shared within that request
   */
  REQUEST = 'REQUEST',
  
  /**
   * Transient scope - New instance for every injection
   * Instance is created every time the dependency is resolved
   */
  TRANSIENT = 'TRANSIENT',
}

// ============================================
// Injectable Options
// ============================================

export interface InjectableOptions {
  /**
   * Scope of the provider
   * @default Scope.DEFAULT
   */
  scope?: Scope;
}

// ============================================
// Request Context
// ============================================

/**
 * Async local storage for request context
 * Used to track request-scoped instances
 */
const requestContextStore = new Map<string, Map<string | symbol, any>>();
let currentRequestId: string | null = null;

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Set current request context
 */
export function setRequestContext(requestId: string): void {
  currentRequestId = requestId;
  if (!requestContextStore.has(requestId)) {
    requestContextStore.set(requestId, new Map());
  }
}

/**
 * Get current request ID
 */
export function getRequestId(): string | null {
  return currentRequestId;
}

/**
 * Get request-scoped instance storage
 */
export function getRequestStorage(): Map<string | symbol, any> | null {
  if (!currentRequestId) return null;
  return requestContextStore.get(currentRequestId) || null;
}

/**
 * Clear request context (call at end of request)
 */
export function clearRequestContext(requestId: string): void {
  requestContextStore.delete(requestId);
  if (currentRequestId === requestId) {
    currentRequestId = null;
  }
}

/**
 * Store instance in request context
 */
export function setRequestInstance<T>(token: string | symbol, instance: T): void {
  const storage = getRequestStorage();
  if (storage) {
    storage.set(token, instance);
  }
}

/**
 * Get instance from request context
 */
export function getRequestInstance<T>(token: string | symbol): T | undefined {
  const storage = getRequestStorage();
  if (storage) {
    return storage.get(token) as T | undefined;
  }
  return undefined;
}

/**
 * Check if instance exists in request context
 */
export function hasRequestInstance(token: string | symbol): boolean {
  const storage = getRequestStorage();
  if (storage) {
    return storage.has(token);
  }
  return false;
}

// ============================================
// Scope Metadata Storage
// ============================================

const scopeMetadataStore = new WeakMap<object, Scope>();

/**
 * Set scope for a class
 */
export function setScopeMetadata(target: object, scope: Scope): void {
  scopeMetadataStore.set(target, scope);
}

/**
 * Get scope for a class
 */
export function getScopeMetadata(target: object): Scope {
  return scopeMetadataStore.get(target) || Scope.DEFAULT;
}

// ============================================
// Request Context Middleware
// ============================================

import type { CanxRequest, CanxResponse, NextFunction, MiddlewareHandler } from '../types';

/**
 * Middleware to establish request context for scoped providers
 */
export function requestScopeMiddleware(): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    const requestId = generateRequestId();
    
    // Attach request ID to request object
    (req as any).requestId = requestId;
    
    // Set up request context
    setRequestContext(requestId);
    
    try {
      // Continue with request handling
      const result = await next();
      return result;
    } finally {
      // Clean up request context
      clearRequestContext(requestId);
    }
  };
}

// ============================================
// AsyncLocalStorage Alternative (for Bun)
// ============================================

/**
 * Run a function within a request context
 */
export async function runInRequestContext<T>(
  fn: () => T | Promise<T>
): Promise<T> {
  const requestId = generateRequestId();
  setRequestContext(requestId);
  
  try {
    return await fn();
  } finally {
    clearRequestContext(requestId);
  }
}

/**
 * Run a function within a specific request context
 */
export async function runWithRequestId<T>(
  requestId: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const previousRequestId = currentRequestId;
  setRequestContext(requestId);
  
  try {
    return await fn();
  } finally {
    if (previousRequestId) {
      currentRequestId = previousRequestId;
    } else {
      clearRequestContext(requestId);
    }
  }
}

// ============================================
// Exports
// ============================================

export {
  requestContextStore,
};
