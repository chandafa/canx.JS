/**
 * CanxJS Environment Helper
 * Utility for accessing environment variables with defaults and type casting
 */

/**
 * Get an environment variable with optional default
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 */
export function env<T = string>(key: string, defaultValue?: T): T {
  const value = process.env[key];
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return undefined as unknown as T;
  }
  
  // Handle boolean conversion
  if (typeof defaultValue === 'boolean') {
    return (value === 'true' || value === '1') as unknown as T;
  }
  
  // Handle number conversion
  if (typeof defaultValue === 'number') {
    const num = Number(value);
    return (isNaN(num) ? defaultValue : num) as unknown as T;
  }
  
  return value as unknown as T;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Require an environment variable (throws if not set)
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export default env;
