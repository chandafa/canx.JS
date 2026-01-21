/**
 * CanxJS Helmet Middleware
 * Security headers for web applications
 */

import type { CanxRequest, CanxResponse, MiddlewareHandler, NextFunction } from '../types';

// ============================================
// Types
// ============================================

export interface HelmetConfig {
  // Content Security Policy
  contentSecurityPolicy?: boolean | ContentSecurityPolicyConfig;
  // X-DNS-Prefetch-Control
  dnsPrefetchControl?: boolean | { allow: boolean };
  // X-Frame-Options
  frameguard?: boolean | { action: 'DENY' | 'SAMEORIGIN' };
  // Hide X-Powered-By
  hidePoweredBy?: boolean;
  // Strict-Transport-Security
  hsts?: boolean | HstsConfig;
  // X-Download-Options (IE8)
  ieNoOpen?: boolean;
  // X-Content-Type-Options
  noSniff?: boolean;
  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies?: boolean | { policy: string };
  // Referrer-Policy
  referrerPolicy?: boolean | { policy: string | string[] };
  // X-XSS-Protection
  xssFilter?: boolean;
  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy?: boolean | { policy: string };
  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy?: boolean | { policy: string };
  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy?: boolean | { policy: string };
  // Origin-Agent-Cluster
  originAgentCluster?: boolean;
}

export interface ContentSecurityPolicyConfig {
  directives?: Record<string, string[] | string | boolean>;
  reportOnly?: boolean;
}

export interface HstsConfig {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: HelmetConfig = {
  contentSecurityPolicy: false, // Disabled by default (complex to configure)
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'SAMEORIGIN' },
  hidePoweredBy: true,
  hsts: { maxAge: 15552000, includeSubDomains: true },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { policy: 'none' },
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: false, // Deprecated, but can still enable
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  originAgentCluster: true,
};

// ============================================
// Header Generators
// ============================================

function generateCSP(config: ContentSecurityPolicyConfig): string {
  if (!config.directives) return '';
  
  const directives: string[] = [];
  for (const [key, value] of Object.entries(config.directives)) {
    if (value === false) continue;
    const directiveName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (Array.isArray(value)) {
      directives.push(`${directiveName} ${value.join(' ')}`);
    } else if (typeof value === 'string') {
      directives.push(`${directiveName} ${value}`);
    } else if (value === true) {
      directives.push(directiveName);
    }
  }
  
  return directives.join('; ');
}

function generateHSTS(config: HstsConfig): string {
  const parts = [`max-age=${config.maxAge || 15552000}`];
  if (config.includeSubDomains) parts.push('includeSubDomains');
  if (config.preload) parts.push('preload');
  return parts.join('; ');
}

// ============================================
// Helmet Middleware
// ============================================

export function helmet(config: HelmetConfig = {}): MiddlewareHandler {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  return async (req: CanxRequest, res: CanxResponse, next: NextFunction) => {
    // Content-Security-Policy
    if (mergedConfig.contentSecurityPolicy) {
      const cspConfig = typeof mergedConfig.contentSecurityPolicy === 'object' 
        ? mergedConfig.contentSecurityPolicy 
        : { directives: { defaultSrc: ["'self'"] } };
      const csp = generateCSP(cspConfig);
      if (csp) {
        const headerName = cspConfig.reportOnly 
          ? 'Content-Security-Policy-Report-Only' 
          : 'Content-Security-Policy';
        res.header(headerName, csp);
      }
    }
    
    // X-DNS-Prefetch-Control
    if (mergedConfig.dnsPrefetchControl !== false) {
      const allow = typeof mergedConfig.dnsPrefetchControl === 'object' 
        ? mergedConfig.dnsPrefetchControl.allow 
        : false;
      res.header('X-DNS-Prefetch-Control', allow ? 'on' : 'off');
    }
    
    // X-Frame-Options
    if (mergedConfig.frameguard !== false) {
      const action = typeof mergedConfig.frameguard === 'object' 
        ? mergedConfig.frameguard.action 
        : 'SAMEORIGIN';
      res.header('X-Frame-Options', action);
    }
    
    // Hide X-Powered-By
    if (mergedConfig.hidePoweredBy) {
      res.header('X-Powered-By', ''); // Will be removed or set to empty
    }
    
    // Strict-Transport-Security
    if (mergedConfig.hsts !== false) {
      const hstsConfig = typeof mergedConfig.hsts === 'object' 
        ? mergedConfig.hsts 
        : { maxAge: 15552000, includeSubDomains: true };
      res.header('Strict-Transport-Security', generateHSTS(hstsConfig));
    }
    
    // X-Download-Options
    if (mergedConfig.ieNoOpen !== false) {
      res.header('X-Download-Options', 'noopen');
    }
    
    // X-Content-Type-Options
    if (mergedConfig.noSniff !== false) {
      res.header('X-Content-Type-Options', 'nosniff');
    }
    
    // X-Permitted-Cross-Domain-Policies
    if (mergedConfig.permittedCrossDomainPolicies !== false) {
      const policy = typeof mergedConfig.permittedCrossDomainPolicies === 'object' 
        ? mergedConfig.permittedCrossDomainPolicies.policy 
        : 'none';
      res.header('X-Permitted-Cross-Domain-Policies', policy);
    }
    
    // Referrer-Policy
    if (mergedConfig.referrerPolicy !== false) {
      const policy = typeof mergedConfig.referrerPolicy === 'object' 
        ? (Array.isArray(mergedConfig.referrerPolicy.policy) 
            ? mergedConfig.referrerPolicy.policy.join(', ') 
            : mergedConfig.referrerPolicy.policy)
        : 'no-referrer';
      res.header('Referrer-Policy', policy);
    }
    
    // X-XSS-Protection (deprecated but still used)
    if (mergedConfig.xssFilter) {
      res.header('X-XSS-Protection', '1; mode=block');
    }
    
    // Cross-Origin-Embedder-Policy
    if (mergedConfig.crossOriginEmbedderPolicy) {
      const policy = typeof mergedConfig.crossOriginEmbedderPolicy === 'object' 
        ? mergedConfig.crossOriginEmbedderPolicy.policy 
        : 'require-corp';
      res.header('Cross-Origin-Embedder-Policy', policy);
    }
    
    // Cross-Origin-Opener-Policy
    if (mergedConfig.crossOriginOpenerPolicy !== false) {
      const policy = typeof mergedConfig.crossOriginOpenerPolicy === 'object' 
        ? mergedConfig.crossOriginOpenerPolicy.policy 
        : 'same-origin';
      res.header('Cross-Origin-Opener-Policy', policy);
    }
    
    // Cross-Origin-Resource-Policy
    if (mergedConfig.crossOriginResourcePolicy !== false) {
      const policy = typeof mergedConfig.crossOriginResourcePolicy === 'object' 
        ? mergedConfig.crossOriginResourcePolicy.policy 
        : 'same-origin';
      res.header('Cross-Origin-Resource-Policy', policy);
    }
    
    // Origin-Agent-Cluster
    if (mergedConfig.originAgentCluster !== false) {
      res.header('Origin-Agent-Cluster', '?1');
    }
    
    return next();
  };
}

// Presets
export const helmetSecure = () => helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: true,
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
});

export const helmetAPI = () => helmet({
  contentSecurityPolicy: false,
  frameguard: { action: 'DENY' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
});

export default helmet;
