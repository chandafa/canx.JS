/**
 * CanxJS Input Sanitization Middleware
 * XSS protection and input cleaning
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler, NextFunction } from '../types';

// ============================================
// Types
// ============================================

export interface SanitizeConfig {
  stripTags?: boolean;
  encodeHtml?: boolean;
  trimStrings?: boolean;
  normalizeWhitespace?: boolean;
  maxStringLength?: number;
  allowedTags?: string[];
  fields?: string[]; // Specific fields to sanitize (empty = all)
  exclude?: string[]; // Fields to exclude from sanitization
}

// ============================================
// Sanitization Functions
// ============================================

/**
 * HTML entity encoding map
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Encode HTML entities to prevent XSS
 */
export function encodeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Strip HTML tags from string
 */
export function stripTags(str: string, allowedTags: string[] = []): string {
  if (allowedTags.length === 0) {
    return str.replace(/<[^>]*>/g, '');
  }
  
  const allowedPattern = allowedTags.map(tag => tag.toLowerCase()).join('|');
  const tagRegex = new RegExp(`<(?!/?(?:${allowedPattern})(?:\\s|>|$))[^>]*>`, 'gi');
  return str.replace(tagRegex, '');
}

/**
 * Normalize whitespace (collapse multiple spaces/newlines)
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Remove null bytes and other dangerous characters
 */
export function removeNullBytes(str: string): string {
  return str.replace(/\0/g, '');
}

/**
 * Sanitize a string value
 */
export function sanitizeString(value: string, config: SanitizeConfig = {}): string {
  let result = value;
  
  // Remove null bytes always
  result = removeNullBytes(result);
  
  // Trim strings
  if (config.trimStrings !== false) {
    result = result.trim();
  }
  
  // Strip HTML tags
  if (config.stripTags) {
    result = stripTags(result, config.allowedTags);
  }
  
  // Encode HTML entities
  if (config.encodeHtml) {
    result = encodeHtml(result);
  }
  
  // Normalize whitespace
  if (config.normalizeWhitespace) {
    result = normalizeWhitespace(result);
  }
  
  // Enforce max length
  if (config.maxStringLength && result.length > config.maxStringLength) {
    result = result.slice(0, config.maxStringLength);
  }
  
  return result;
}

/**
 * Recursively sanitize an object
 */
export function sanitizeObject(
  obj: Record<string, unknown>, 
  config: SanitizeConfig = {},
  path: string = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Check if field should be excluded
    if (config.exclude?.includes(currentPath) || config.exclude?.includes(key)) {
      result[key] = value;
      continue;
    }
    
    // Check if we should only sanitize specific fields
    if (config.fields && config.fields.length > 0) {
      if (!config.fields.includes(currentPath) && !config.fields.includes(key)) {
        result[key] = value;
        continue;
      }
    }
    
    // Sanitize based on type
    if (typeof value === 'string') {
      result[key] = sanitizeString(value, config);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item, i) => {
        if (typeof item === 'string') {
          return sanitizeString(item, config);
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, config, `${currentPath}[${i}]`);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>, config, currentPath);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================
// Middleware
// ============================================

const DEFAULT_CONFIG: SanitizeConfig = {
  stripTags: true,
  encodeHtml: false, // Usually you want to store raw and encode on output
  trimStrings: true,
  normalizeWhitespace: false,
  maxStringLength: 10000,
};

/**
 * Sanitize input middleware
 * Sanitizes req.body, req.query, and req.params
 */
export function sanitize(config: SanitizeConfig = {}): MiddlewareHandler {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      (req as any).body = sanitizeObject(req.body as Record<string, unknown>, mergedConfig);
    }
    
    // Sanitize query
    if (req.query && typeof req.query === 'object') {
      (req as any).query = sanitizeObject(req.query as Record<string, unknown>, mergedConfig);
    }
    
    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      (req as any).params = sanitizeObject(req.params as Record<string, unknown>, mergedConfig);
    }
    
    return next();
  };
}

/**
 * Strict XSS protection (encodes all HTML)
 */
export function xssProtect(): MiddlewareHandler {
  return sanitize({
    stripTags: true,
    encodeHtml: true,
    trimStrings: true,
  });
}

// Export default middleware
export const sanitizeMiddleware = sanitize();
