/**
 * CanxJS Maintenance Mode
 * 
 * Allows putting the application into maintenance mode for deployments.
 * Similar to Laravel's `php artisan down` / `php artisan up`
 */

import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import type { CanxRequest, CanxResponse } from '../types';

// ============================================
// Types
// ============================================

export interface MaintenancePayload {
  time: number;
  message?: string;
  retry?: number;
  refresh?: number;
  secret?: string;
  status?: number;
  template?: string;
  redirect?: string;
  except?: string[];
}

export interface MaintenanceConfig {
  driver?: 'file' | 'cache';
  storagePath?: string;
}

// ============================================
// Maintenance Manager
// ============================================

export class MaintenanceManager {
  private storagePath: string;
  private fileName = '.maintenance';

  constructor(config: MaintenanceConfig = {}) {
    this.storagePath = config.storagePath || process.cwd();
  }

  /**
   * Get the path to the maintenance file
   */
  private getMaintenanceFilePath(): string {
    return join(this.storagePath, this.fileName);
  }

  /**
   * Check if the application is in maintenance mode
   */
  isDown(): boolean {
    return existsSync(this.getMaintenanceFilePath());
  }

  /**
   * Alias for isDown()
   */
  isDownForMaintenance(): boolean {
    return this.isDown();
  }

  /**
   * Get maintenance mode data
   */
  getData(): MaintenancePayload | null {
    if (!this.isDown()) return null;
    
    try {
      const content = readFileSync(this.getMaintenanceFilePath(), 'utf-8');
      return JSON.parse(content) as MaintenancePayload;
    } catch {
      return null;
    }
  }

  /**
   * Put the application into maintenance mode
   */
  activate(payload: Partial<MaintenancePayload> = {}): void {
    const data: MaintenancePayload = {
      time: Date.now(),
      message: payload.message || 'Service Unavailable',
      retry: payload.retry,
      refresh: payload.refresh,
      secret: payload.secret,
      status: payload.status || 503,
      template: payload.template,
      redirect: payload.redirect,
      except: payload.except || [],
    };

    writeFileSync(this.getMaintenanceFilePath(), JSON.stringify(data, null, 2));
  }

  /**
   * Take the application out of maintenance mode
   */
  deactivate(): void {
    const filePath = this.getMaintenanceFilePath();
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  /**
   * Check if the given URI should bypass maintenance mode
   */
  shouldBypass(uri: string, secret?: string): boolean {
    const data = this.getData();
    if (!data) return true;

    // Check secret bypass
    if (data.secret && secret === data.secret) {
      return true;
    }

    // Check URI exceptions
    if (data.except && data.except.length > 0) {
      for (const pattern of data.except) {
        if (this.matchesPattern(uri, pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Match URI against a pattern (supports wildcards)
   */
  private matchesPattern(uri: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === uri) return true;
    
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\//g, '\\/');
    
    return new RegExp(`^${regexPattern}$`).test(uri);
  }
}

// ============================================
// Global Instance
// ============================================

let maintenanceInstance: MaintenanceManager | null = null;

/**
 * Initialize maintenance manager
 */
export function initMaintenance(config: MaintenanceConfig = {}): MaintenanceManager {
  maintenanceInstance = new MaintenanceManager(config);
  return maintenanceInstance;
}

/**
 * Get the global maintenance manager instance
 */
export function maintenance(): MaintenanceManager {
  if (!maintenanceInstance) {
    maintenanceInstance = new MaintenanceManager();
  }
  return maintenanceInstance;
}

/**
 * Check if app is down for maintenance
 */
export function isDownForMaintenance(): boolean {
  return maintenance().isDown();
}

// ============================================
// Middleware
// ============================================

export interface MaintenanceMiddlewareOptions {
  /**
   * Custom response handler when in maintenance mode
   */
  render?: (req: CanxRequest, data: MaintenancePayload) => Response;
  
  /**
   * URIs that should bypass maintenance mode
   */
  except?: string[];
  
  /**
   * Secret key to bypass maintenance mode via cookie or query param
   */
  secretKey?: string;
}

/**
 * Middleware to check for maintenance mode
 */
export function maintenanceMiddleware(options: MaintenanceMiddlewareOptions = {}) {
  return async (req: CanxRequest, res: CanxResponse, next: () => Promise<Response>) => {
    const manager = maintenance();
    
    if (!manager.isDown()) {
      return next();
    }

    const data = manager.getData();
    if (!data) {
      return next();
    }

    // Get URL path - use req.path directly or construct from raw
    const url = new URL(req.raw.url);
    const path = req.path || url.pathname;

    // Check for secret bypass via query param or cookie
    const secretParam = url.searchParams.get('_maintenance_secret');
    const secretCookie = req.headers.get('cookie')?.match(/maintenance_secret=([^;]+)/)?.[1];
    const secret = secretParam || secretCookie;

    // Check if should bypass
    if (manager.shouldBypass(path, secret)) {
      // If bypassed via query param, set cookie for future requests
      if (secretParam && data.secret && secretParam === data.secret) {
        const response = await next();
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Set-Cookie', `maintenance_secret=${secretParam}; Path=/; HttpOnly; SameSite=Lax`);
        return newResponse;
      }
      return next();
    }

    // Check except patterns from options
    if (options.except) {
      for (const pattern of options.except) {
        if (manager['matchesPattern'](path, pattern)) {
          return next();
        }
      }
    }

    // Handle redirect
    if (data.redirect) {
      return Response.redirect(data.redirect, 302);
    }

    // Custom render function
    if (options.render) {
      return options.render(req, data);
    }

    // Default response
    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
    };

    if (data.retry) {
      headers['Retry-After'] = String(data.retry);
    }

    if (data.refresh) {
      headers['Refresh'] = String(data.refresh);
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maintenance Mode</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      opacity: 0.8;
    }
    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.125rem;
      opacity: 0.8;
      max-width: 400px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔧</div>
    <h1>Under Maintenance</h1>
    <p>${data.message}</p>
  </div>
</body>
</html>
    `.trim();

    return new Response(html, {
      status: data.status || 503,
      headers,
    });
  };
}

// ============================================
// PreCheckMaintenance - For use before app boots
// ============================================

/**
 * Check maintenance mode before app fully boots.
 * Use this in your entry point if you want to avoid loading the entire app during maintenance.
 */
export function preCheckMaintenance(): boolean {
  return existsSync(join(process.cwd(), '.maintenance'));
}
