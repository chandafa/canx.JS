/**
 * CanxJS Environment Helper
 * Utility for accessing environment variables with defaults and type casting
 */
/**
 * Get an environment variable with optional default
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 */
export declare function env<T = string>(key: string, defaultValue?: T): T;
/**
 * Check if running in production
 */
export declare function isProduction(): boolean;
/**
 * Check if running in development
 */
export declare function isDevelopment(): boolean;
/**
 * Check if running in test
 */
export declare function isTest(): boolean;
/**
 * Require an environment variable (throws if not set)
 */
export declare function requireEnv(key: string): string;
export default env;
