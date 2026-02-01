/**
 * CanxJS Config Manager
 * Centralized configuration management with dot notation access
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

// ============================================
// Types
// ============================================

export interface ConfigValue {
  [key: string]: ConfigValue | string | number | boolean | null | ConfigValue[];
}

// ============================================
// Config Manager
// ============================================

export class ConfigManager {
  private config: ConfigValue = {};
  private cache: Map<string, unknown> = new Map();

  /**
   * Load config from object
   */
  load(config: ConfigValue): void {
    this.config = this.deepMerge(this.config, config);
    this.cache.clear();
  }

  /**
   * Load config from JSON file
   */
  async loadFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      this.load(parsed);
    } catch (error: any) {
      console.warn(`Failed to load config file: ${filePath}`, error.message);
    }
  }

  /**
   * Load config from directory (loads all .json files)
   */
  async loadDirectory(dirPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const name = file.replace('.json', '');
          const content = await fs.readFile(join(dirPath, file), 'utf-8');
          const parsed = JSON.parse(content);
          this.set(name, parsed);
        }
      }
    } catch (error: any) {
      console.warn(`Failed to load config directory: ${dirPath}`, error.message);
    }
  }

  /**
   * Get config value using dot notation
   */
  get<T = unknown>(key: string, defaultValue?: T): T {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const parts = key.split('.');
    let current: any = this.config;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return defaultValue as T;
      }
      current = current[part];
    }

    const value = current !== undefined ? current : defaultValue;
    this.cache.set(key, value);
    return value as T;
  }

  /**
   * Set config value using dot notation
   */
  set(key: string, value: unknown): void {
    const parts = key.split('.');
    let current: any = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    
    // Clear cache for this key and any child keys
    for (const cachedKey of this.cache.keys()) {
      if (cachedKey === key || cachedKey.startsWith(`${key}.`)) {
        this.cache.delete(cachedKey);
      }
    }
  }

  /**
   * Check if config key exists
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Get all config as object
   */
  all(): ConfigValue {
    return { ...this.config };
  }

  /**
   * Get environment-specific value
   */
  env<T>(key: string, defaultValue?: T): T {
    const envValue = process.env[key];
    if (envValue !== undefined) {
      // Try to parse as JSON for complex types
      try {
        return JSON.parse(envValue) as T;
      } catch {
        return envValue as unknown as T;
      }
    }
    return defaultValue as T;
  }

  /**
   * Deep merge helper
   */
  private deepMerge(target: ConfigValue, source: ConfigValue): ConfigValue {
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = result[key];
      
      if (
        typeof sourceVal === 'object' && 
        sourceVal !== null && 
        !Array.isArray(sourceVal) &&
        typeof targetVal === 'object' &&
        targetVal !== null &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as ConfigValue,
          sourceVal as ConfigValue
        );
      } else {
        result[key] = sourceVal;
      }
    }
    
    return result;
  }
}

// ============================================
// Singleton & Helpers
// ============================================

let configInstance: ConfigManager | null = null;

/**
 * Initialize config
 */
export function initConfig(initialConfig?: ConfigValue): ConfigManager {
  configInstance = new ConfigManager();
  if (initialConfig) {
    configInstance.load(initialConfig);
  }
  return configInstance;
}

/**
 * Get config manager instance
 */
export function config(): ConfigManager;
export function config<T>(key: string, defaultValue?: T): T;
export function config<T>(key?: string, defaultValue?: T): ConfigManager | T {
  if (!configInstance) {
    configInstance = new ConfigManager();
  }
  
  if (key === undefined) {
    return configInstance;
  }
  
  return configInstance.get<T>(key, defaultValue);
}

/**
 * Get env variable with fallback
 */
export function env<T = string>(key: string, defaultValue?: T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue as T;
  }
  
  // Type coercion for common types  
  if (defaultValue !== undefined) {
    if (typeof defaultValue === 'number') {
      return parseFloat(value) as unknown as T;
    }
    if (typeof defaultValue === 'boolean') {
      return (value === 'true' || value === '1') as unknown as T;
    }
  }
  
  return value as unknown as T;
}

export default ConfigManager;
