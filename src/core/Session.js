"use strict";
/**
 * CanxJS Session Manager
 * Handles session state via drivers (File / Cookie / Redis)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = exports.FileDriver = exports.MemoryDriver = void 0;
const Str_1 = require("../utils/Str");
class MemoryDriver {
    store = new Map();
    async read(id) {
        const session = this.store.get(id);
        if (!session)
            return {};
        return session.data;
    }
    async write(id, data) {
        this.store.set(id, { data, lastAccess: Date.now() });
    }
    async destroy(id) {
        this.store.delete(id);
    }
    async gc(lifetime) {
        const now = Date.now();
        for (const [id, session] of this.store.entries()) {
            if (now - session.lastAccess > lifetime * 60 * 1000) {
                this.store.delete(id);
            }
        }
    }
}
exports.MemoryDriver = MemoryDriver;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class FileDriver {
    path;
    constructor(path) {
        this.path = path;
        if (!(0, node_fs_1.existsSync)(this.path)) {
            (0, node_fs_1.mkdirSync)(this.path, { recursive: true });
        }
    }
    async read(id) {
        const file = (0, node_path_1.join)(this.path, id);
        if ((0, node_fs_1.existsSync)(file)) {
            try {
                const content = (0, node_fs_1.readFileSync)(file, 'utf-8');
                const data = JSON.parse(content);
                // Check expiry if stored in file? 
                // Usually we rely on GC or lastAccess time stored in file.
                // For simplified file driver, we return data.
                return data;
            }
            catch (e) {
                return {};
            }
        }
        return {};
    }
    async write(id, data) {
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(this.path, id), JSON.stringify(data), 'utf-8');
    }
    async destroy(id) {
        const file = (0, node_path_1.join)(this.path, id);
        if ((0, node_fs_1.existsSync)(file))
            (0, node_fs_1.unlinkSync)(file);
    }
    async gc(lifetime) {
        const files = (0, node_fs_1.readdirSync)(this.path);
        const now = Date.now();
        for (const file of files) {
            const filePath = (0, node_path_1.join)(this.path, file);
            const stats = (0, node_fs_1.statSync)(filePath);
            const age = (now - stats.mtimeMs) / 1000 / 60; // minutes
            if (age > lifetime) {
                try {
                    (0, node_fs_1.unlinkSync)(filePath);
                }
                catch (e) {
                    // ignore race condition
                }
            }
        }
    }
}
exports.FileDriver = FileDriver;
class Session {
    driver;
    id = null;
    attributes = {};
    config;
    started = false;
    constructor(config = {}) {
        this.config = {
            driver: 'file', // Changed default to file for better DX
            lifetime: 120,
            expireOnClose: false,
            encrypt: false,
            cookie: 'canx_session',
            files: process.cwd() + '/storage/framework/sessions',
            ...config
        };
        // Driver factory
        if (this.config.driver === 'file') {
            this.driver = new FileDriver(this.config.files || process.cwd() + '/.sessions');
        }
        else {
            this.driver = new MemoryDriver();
        }
    }
    /**
     * Start the session (load from ID)
     */
    async start(id) {
        if (this.started)
            return this.id;
        this.id = id || (0, Str_1.randomUuid)();
        this.attributes = await this.driver.read(this.id);
        this.started = true;
        return this.id;
    }
    /**
     * Save session state
     */
    async save() {
        if (!this.started || !this.id)
            return;
        await this.driver.write(this.id, this.attributes);
    }
    /**
     * Get a value
     */
    get(key, defaultValue) {
        return (this.attributes[key] !== undefined ? this.attributes[key] : defaultValue);
    }
    /**
     * Set a value
     */
    put(key, value) {
        this.attributes[key] = value;
    }
    /**
     * Delete a value
     */
    forget(key) {
        delete this.attributes[key];
    }
    /**
     * Get all attributes
     */
    all() {
        return { ...this.attributes };
    }
    /**
     * Destroy the session
     */
    async invalidate() {
        if (this.id) {
            await this.driver.destroy(this.id);
        }
        this.attributes = {};
        this.started = false;
        this.id = (0, Str_1.randomUuid)(); // Regenerate ID
    }
    /**
     * Regenerate session ID
     */
    async regenerate() {
        const oldId = this.id;
        this.id = (0, Str_1.randomUuid)();
        if (oldId)
            await this.driver.destroy(oldId);
        await this.save();
    }
}
exports.Session = Session;
