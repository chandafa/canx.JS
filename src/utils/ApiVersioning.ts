/**
 * CanxJS API Versioning
 * URL and Header-based API versioning middleware
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler, NextFunction } from '../types';

// ============================================
// Types
// ============================================

export interface VersioningConfig {
  type: 'url' | 'header' | 'query' | 'accept';
  default?: string;
  header?: string; // For header-based versioning
  query?: string; // For query-based versioning
  prefix?: string; // For URL-based versioning (e.g., 'v')
  versions?: string[]; // Allowed versions
}

export interface VersionedRoute {
  version: string;
  handler: MiddlewareHandler;
}

// ============================================
// Version Extraction
// ============================================

/**
 * Extract version from URL path (e.g., /v1/users -> 1)
 */
function extractFromUrl(req: CanxRequest, prefix: string = 'v'): string | null {
  const path = (req as any).path || (req as any).url || '';
  const regex = new RegExp(`/${prefix}(\\d+(?:\\.\\d+)?)/`);
  const match = path.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract version from header
 */
function extractFromHeader(req: CanxRequest, headerName: string): string | null {
  const headers = req.headers;
  let header: string | null = null;
  
  if (typeof headers?.get === 'function') {
    header = headers.get(headerName.toLowerCase());
  } else if (headers) {
    header = (headers as any)[headerName.toLowerCase()];
  }
  
  if (!header) return null;
  return String(header).replace(/^v/i, '');
}

/**
 * Extract version from query string
 */
function extractFromQuery(req: CanxRequest, paramName: string): string | null {
  const version = req.query?.[paramName];
  if (!version) return null;
  return String(version).replace(/^v/i, '');
}

/**
 * Extract version from Accept header (e.g., application/vnd.api.v1+json)
 */
function extractFromAccept(req: CanxRequest): string | null {
  const headers = req.headers;
  let accept: string | null = null;
  
  if (typeof headers?.get === 'function') {
    accept = headers.get('accept');
  } else if (headers) {
    accept = (headers as any).accept;
  }
  
  if (!accept) return null;
  const match = String(accept).match(/vnd\.[^.]+\.v?(\d+(?:\.\d+)?)/i);
  return match ? match[1] : null;
}

// ============================================
// Versioning Middleware
// ============================================

const DEFAULT_CONFIG: VersioningConfig = {
  type: 'url',
  default: '1',
  prefix: 'v',
  header: 'x-api-version',
  query: 'version',
};

/**
 * API Versioning middleware
 * Extracts version from request and adds to req.version
 */
export function versioning(config: Partial<VersioningConfig> = {}): MiddlewareHandler {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    let version: string | null = null;
    
    switch (mergedConfig.type) {
      case 'url':
        version = extractFromUrl(req, mergedConfig.prefix);
        break;
      case 'header':
        version = extractFromHeader(req, mergedConfig.header!);
        break;
      case 'query':
        version = extractFromQuery(req, mergedConfig.query!);
        break;
      case 'accept':
        version = extractFromAccept(req);
        break;
    }
    
    // Fallback to default
    version = version || mergedConfig.default || '1';
    
    // Validate version if versions list provided
    if (mergedConfig.versions && !mergedConfig.versions.includes(version)) {
      return res.status(400).json({
        error: 'Invalid API version',
        message: `Supported versions: ${mergedConfig.versions.join(', ')}`,
        requested: version,
      });
    }
    
    // Attach version to request
    (req as any).version = version;
    (req as any).apiVersion = version;
    
    return next();
  };
}

// ============================================
// Versioned Route Handler
// ============================================

/**
 * Create versioned route handlers
 * Routes requests to appropriate handler based on version
 */
export function versionedHandler(
  handlers: Record<string, MiddlewareHandler>,
  defaultVersion?: string
): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    const version = (req as any).version || (req as any).apiVersion || defaultVersion || '1';
    
    // Try exact match
    if (handlers[version]) {
      return handlers[version](req, res, next);
    }
    
    // Try major version match (e.g., "1.2" -> "1")
    const majorVersion = version.split('.')[0];
    if (handlers[majorVersion]) {
      return handlers[majorVersion](req, res, next);
    }
    
    // Fallback to default
    if (handlers.default) {
      return handlers.default(req, res, next);
    }
    
    return res.status(404).json({
      error: 'Version not supported',
      message: `No handler found for version ${version}`,
      available: Object.keys(handlers).filter(k => k !== 'default'),
    });
  };
}

// ============================================
// Version Decorators (for Controllers) - Using Map storage
// ============================================

const versionMetadataStore = new Map<string, string>();

/**
 * Decorator to mark controller or method version
 */
export function Version(version: string) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    const key = propertyKey 
      ? `${target.constructor?.name || target.name}::${propertyKey}`
      : target.name;
    versionMetadataStore.set(key, version);
    return descriptor || target;
  };
}

/**
 * Get version from decorator metadata
 */
export function getVersion(target: any, propertyKey?: string): string | undefined {
  const key = propertyKey 
    ? `${target.constructor?.name || target.name}::${propertyKey}`
    : target.name;
  return versionMetadataStore.get(key);
}

// ============================================
// URL Version Rewriter
// ============================================

/**
 * Middleware to strip version prefix from URL for routing
 * Useful when you want /v1/users to be handled by /users route
 */
export function stripVersionPrefix(prefix: string = 'v'): MiddlewareHandler {
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    const url = (req as any).path || (req as any).url || '';
    const regex = new RegExp(`^/${prefix}\\d+(?:\\.\\d+)?`);
    
    // Store original URL
    (req as any).originalUrl = url;
    
    // Strip version prefix
    (req as any).url = url.replace(regex, '');
    if (!(req as any).url.startsWith('/')) {
      (req as any).url = '/' + (req as any).url;
    }
    
    return next();
  };
}

// ============================================
// Presets
// ============================================

export const urlVersioning = (versions?: string[]) => versioning({ type: 'url', versions });
export const headerVersioning = (versions?: string[]) => versioning({ type: 'header', versions });
export const queryVersioning = (versions?: string[]) => versioning({ type: 'query', versions });

export default versioning;
