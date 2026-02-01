/**
 * CanxJS Config Manager
 * Centralized configuration management with dot notation access
 */
export interface ConfigValue {
    [key: string]: ConfigValue | string | number | boolean | null | ConfigValue[];
}
export declare class ConfigManager {
    private config;
    private cache;
    /**
     * Load config from object
     */
    load(config: ConfigValue): void;
    /**
     * Load config from JSON file
     */
    loadFile(filePath: string): Promise<void>;
    /**
     * Load config from directory (loads all .json files)
     */
    loadDirectory(dirPath: string): Promise<void>;
    /**
     * Get config value using dot notation
     */
    get<T = unknown>(key: string, defaultValue?: T): T;
    /**
     * Set config value using dot notation
     */
    set(key: string, value: unknown): void;
    /**
     * Check if config key exists
     */
    has(key: string): boolean;
    /**
     * Get all config as object
     */
    all(): ConfigValue;
    /**
     * Get environment-specific value
     */
    env<T>(key: string, defaultValue?: T): T;
    /**
     * Deep merge helper
     */
    private deepMerge;
}
/**
 * Initialize config
 */
export declare function initConfig(initialConfig?: ConfigValue): ConfigManager;
/**
 * Get config manager instance
 */
export declare function config(): ConfigManager;
export declare function config<T>(key: string, defaultValue?: T): T;
/**
 * Get env variable with fallback
 */
export declare function env<T = string>(key: string, defaultValue?: T): T;
export default ConfigManager;
