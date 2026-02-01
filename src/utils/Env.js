"use strict";
/**
 * CanxJS Environment Helper
 * Utility for accessing environment variables with defaults and type casting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = env;
exports.isProduction = isProduction;
exports.isDevelopment = isDevelopment;
exports.isTest = isTest;
exports.requireEnv = requireEnv;
/**
 * Get an environment variable with optional default
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 */
function env(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        return undefined;
    }
    // Handle boolean conversion
    if (typeof defaultValue === 'boolean') {
        return (value === 'true' || value === '1');
    }
    // Handle number conversion
    if (typeof defaultValue === 'number') {
        const num = Number(value);
        return (isNaN(num) ? defaultValue : num);
    }
    return value;
}
/**
 * Check if running in production
 */
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
/**
 * Check if running in development
 */
function isDevelopment() {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}
/**
 * Check if running in test
 */
function isTest() {
    return process.env.NODE_ENV === 'test';
}
/**
 * Require an environment variable (throws if not set)
 */
function requireEnv(key) {
    const value = process.env[key];
    if (value === undefined) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}
exports.default = env;
