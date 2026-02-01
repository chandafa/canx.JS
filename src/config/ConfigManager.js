"use strict";
/**
 * CanxJS Config Manager
 * Centralized configuration management with dot notation access
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
exports.initConfig = initConfig;
exports.config = config;
exports.env = env;
const promises_1 = require("fs/promises");
const path_1 = require("path");
// ============================================
// Config Manager
// ============================================
class ConfigManager {
    config = {};
    cache = new Map();
    /**
     * Load config from object
     */
    load(config) {
        this.config = this.deepMerge(this.config, config);
        this.cache.clear();
    }
    /**
     * Load config from JSON file
     */
    async loadFile(filePath) {
        try {
            const content = await (0, promises_1.readFile)(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            this.load(parsed);
        }
        catch (error) {
            console.warn(`Failed to load config file: ${filePath}`, error.message);
        }
    }
    /**
     * Load config from directory (loads all .json files)
     */
    async loadDirectory(dirPath) {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const files = await fs.readdir(dirPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const name = file.replace('.json', '');
                    const content = await fs.readFile((0, path_1.join)(dirPath, file), 'utf-8');
                    const parsed = JSON.parse(content);
                    this.set(name, parsed);
                }
            }
        }
        catch (error) {
            console.warn(`Failed to load config directory: ${dirPath}`, error.message);
        }
    }
    /**
     * Get config value using dot notation
     */
    get(key, defaultValue) {
        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const parts = key.split('.');
        let current = this.config;
        for (const part of parts) {
            if (current === undefined || current === null) {
                return defaultValue;
            }
            current = current[part];
        }
        const value = current !== undefined ? current : defaultValue;
        this.cache.set(key, value);
        return value;
    }
    /**
     * Set config value using dot notation
     */
    set(key, value) {
        const parts = key.split('.');
        let current = this.config;
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
    has(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Get all config as object
     */
    all() {
        return { ...this.config };
    }
    /**
     * Get environment-specific value
     */
    env(key, defaultValue) {
        const envValue = process.env[key];
        if (envValue !== undefined) {
            // Try to parse as JSON for complex types
            try {
                return JSON.parse(envValue);
            }
            catch {
                return envValue;
            }
        }
        return defaultValue;
    }
    /**
     * Deep merge helper
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            const sourceVal = source[key];
            const targetVal = result[key];
            if (typeof sourceVal === 'object' &&
                sourceVal !== null &&
                !Array.isArray(sourceVal) &&
                typeof targetVal === 'object' &&
                targetVal !== null &&
                !Array.isArray(targetVal)) {
                result[key] = this.deepMerge(targetVal, sourceVal);
            }
            else {
                result[key] = sourceVal;
            }
        }
        return result;
    }
}
exports.ConfigManager = ConfigManager;
// ============================================
// Singleton & Helpers
// ============================================
let configInstance = null;
/**
 * Initialize config
 */
function initConfig(initialConfig) {
    configInstance = new ConfigManager();
    if (initialConfig) {
        configInstance.load(initialConfig);
    }
    return configInstance;
}
function config(key, defaultValue) {
    if (!configInstance) {
        configInstance = new ConfigManager();
    }
    if (key === undefined) {
        return configInstance;
    }
    return configInstance.get(key, defaultValue);
}
/**
 * Get env variable with fallback
 */
function env(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        return defaultValue;
    }
    // Type coercion for common types  
    if (defaultValue !== undefined) {
        if (typeof defaultValue === 'number') {
            return parseFloat(value);
        }
        if (typeof defaultValue === 'boolean') {
            return (value === 'true' || value === '1');
        }
    }
    return value;
}
exports.default = ConfigManager;
