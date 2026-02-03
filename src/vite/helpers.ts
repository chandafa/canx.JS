import { viteManager } from './Vite';

/**
 * Generate Vite tags
 */
export function vite(entrypoints: string | string[], buildDirectory?: string): string {
  return viteManager.invoke(entrypoints, buildDirectory);
}

/**
 * Get React Refresh prelude
 */
export function vite_react_refresh(): string {
  return viteManager.reactRefresh();
}

/**
 * Get asset path
 */
export function vite_asset(path: string, buildDirectory?: string): string {
  return viteManager.asset(path, buildDirectory);
}
