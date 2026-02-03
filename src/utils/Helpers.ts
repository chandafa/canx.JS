/**
 * CanXJS Global Helpers
 * Ergonomic shortcuts for common tasks.
 */
import { view as renderView } from '../mvc/View';
import { env } from './Env';
import { Router } from '../core/Router';
import { container } from '../container/Container';
import { Session } from '../core/Session'; // Import class, not store instance, we'll access via request?
// Accessing Session strictly via request is standard MVC. 
// But "global session()" helper usually returns session data or instance.
// In Async Local Storage world, we can do it. `core/Container.ts` supports request context.

// 1. View Helper
export function view(name: string, data: Record<string, any> = {}) {
    return renderView(name, data);
}

// 2. Env Helper
export { env };

// 3. Config Helper (Simple env wrapper or config file loader)
export function config(key: string, defaultValue?: any): any {
    // Config helper uses environment variables as the primary source.
    // For complex configuration, use the ConfigManager from index exports.
    return env(key, defaultValue);
}

// 4. Route Helper (Requires Router to support naming)
// We need to inject Router or get it from Container.
export function route(name: string, params: Record<string, any> = {}): string {
    const router = container.get('Router') as any; // Cast to any or Router
    if (!router) throw new Error('Router not initialized');
    // Router needs `url()` or `route()` method. 
    // We will assume `router.url(name, params)` exists (Upgrade Item).
    if (typeof router.url === 'function') {
        return router.url(name, params);
    }
    return '#';
}

// 5. Abort Helper
export function abort(code: number, message: string = ''): never {
    throw { status: code, message };
}

// 6. Redirect Helper (Returns Response object?)
// Impossible to return Response from void helper unless inside Controller.
// Usually helpers return the object to be returned.
export function redirect(url: string) {
    return Response.redirect(url, 302);
}

// 7. URL Helper
export function url(path: string): string {
    const baseUrl = env('APP_URL', 'http://localhost:3000');
    return `${baseUrl}/${path.replace(/^\//, '')}`;
}
