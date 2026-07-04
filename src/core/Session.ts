/**
 * CanxJS Session Manager
 * Handles session state via drivers (File / Memory / Redis / Database)
 */

import { randomUuid } from '../utils/Str';
import { env } from '../utils/Env';

export interface SessionConfig {
    driver: 'file' | 'cookie' | 'memory' | 'redis' | 'database';
    lifetime: number; // minutes
    expireOnClose: boolean;
    encrypt: boolean;
    files?: string; // path for file driver
    cookie?: string; // cookie name
    client?: any; // injected redis client (ioredis / node-redis) for the redis driver
    table?: string; // table name for the database driver
}

export interface SessionDriver {
    read(id: string): Promise<Record<string, any>>;
    write(id: string, data: Record<string, any>): Promise<void>;
    destroy(id: string): Promise<void>;
    gc(lifetime: number): Promise<void>;
}

export class MemoryDriver implements SessionDriver {
    private store = new Map<string, { data: any; lastAccess: number }>();

    async read(id: string): Promise<Record<string, any>> {
        const session = this.store.get(id);
        if (!session) return {};
        return session.data;
    }

    async write(id: string, data: Record<string, any>): Promise<void> {
        this.store.set(id, { data, lastAccess: Date.now() });
    }

    async destroy(id: string): Promise<void> {
        this.store.delete(id);
    }

    async gc(lifetime: number): Promise<void> {
        const now = Date.now();
        for (const [id, session] of this.store.entries()) {
            if (now - session.lastAccess > lifetime * 60 * 1000) {
                this.store.delete(id);
            }
        }
    }
}

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export class FileDriver implements SessionDriver {
    private path: string;

    constructor(path: string) {
        this.path = path;
        if (!existsSync(this.path)) {
            mkdirSync(this.path, { recursive: true });
        }
    }

    async read(id: string): Promise<Record<string, any>> {
        const file = join(this.path, id);
        if (existsSync(file)) {
            try {
                const content = readFileSync(file, 'utf-8');
                const data = JSON.parse(content);
                // Check expiry if stored in file? 
                // Usually we rely on GC or lastAccess time stored in file.
                // For simplified file driver, we return data.
                return data;
            } catch (e) {
                return {};
            }
        }
        return {};
    }

    async write(id: string, data: Record<string, any>): Promise<void> {
        writeFileSync(join(this.path, id), JSON.stringify(data), 'utf-8');
    }

    async destroy(id: string): Promise<void> {
        const file = join(this.path, id);
        if (existsSync(file)) unlinkSync(file);
    }

    async gc(lifetime: number): Promise<void> {
        const files = readdirSync(this.path);
        const now = Date.now();
        
        for (const file of files) {
            const filePath = join(this.path, file);
            const stats = statSync(filePath);
            const age = (now - stats.mtimeMs) / 1000 / 60; // minutes
            
            if (age > lifetime) {
                try {
                    unlinkSync(filePath);
                } catch (e) {
                    // ignore race condition
                }
            }
        }
    }
}

/**
 * Redis session driver.
 * `client` is an injected ioredis / node-redis style object (typed `any`, not imported here
 * so the framework carries no hard redis dependency). `ttl` is in minutes and is converted
 * to seconds for redis' SETEX. Expiry is handled natively by redis, so `gc()` is a no-op.
 */
export class RedisSessionDriver implements SessionDriver {
    constructor(
        private client: any,
        private prefix: string = 'canxsess:',
        private ttl: number = 1440
    ) {}

    async read(id: string): Promise<Record<string, any>> {
        const raw = await this.client.get(this.prefix + id);
        return raw ? JSON.parse(raw) : {};
    }

    async write(id: string, data: Record<string, any>): Promise<void> {
        await this.client.setex(this.prefix + id, this.ttl * 60, JSON.stringify(data));
    }

    async destroy(id: string): Promise<void> {
        await this.client.del(this.prefix + id);
    }

    async gc(_lifetime: number): Promise<void> {
        // No-op: redis TTL (via SETEX) handles expiry automatically.
    }
}

import { query, execute } from '../mvc/Model';

/**
 * Database session driver.
 * Stores sessions in a table (default `sessions`) using portable SQL.
 * Required columns:
 *   - id            VARCHAR / TEXT (primary key)
 *   - payload       TEXT      (JSON-serialized session data)
 *   - last_activity INTEGER   (unix epoch seconds of last write)
 */
export class DatabaseSessionDriver implements SessionDriver {
    constructor(private table: string = 'sessions') {}

    async read(id: string): Promise<Record<string, any>> {
        const rows = await query(
            `SELECT payload FROM ${this.table} WHERE id = ?`,
            [id]
        );
        const row = rows && rows[0];
        if (!row || row.payload == null) return {};
        try {
            return JSON.parse(row.payload);
        } catch (e) {
            return {};
        }
    }

    async write(id: string, data: Record<string, any>): Promise<void> {
        const payload = JSON.stringify(data);
        const lastActivity = Math.floor(Date.now() / 1000);

        // Upsert without MySQL-only syntax: try UPDATE, INSERT if nothing was affected.
        const result: any = await execute(
            `UPDATE ${this.table} SET payload = ?, last_activity = ? WHERE id = ?`,
            [payload, lastActivity, id]
        );

        const affected =
            result && typeof result.affectedRows === 'number'
                ? result.affectedRows
                : result && typeof result.changes === 'number'
                    ? result.changes
                    : 0;

        if (!affected) {
            await execute(
                `INSERT INTO ${this.table} (id, payload, last_activity) VALUES (?, ?, ?)`,
                [id, payload, lastActivity]
            );
        }
    }

    async destroy(id: string): Promise<void> {
        await execute(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
    }

    async gc(lifetime: number): Promise<void> {
        const cutoff = Math.floor(Date.now() / 1000) - lifetime * 60;
        await execute(
            `DELETE FROM ${this.table} WHERE last_activity < ?`,
            [cutoff]
        );
    }
}

export class Session {
    private driver: SessionDriver;
    private id: string | null = null;
    private attributes: Record<string, any> = {};
    private config: SessionConfig;
    private started = false;

    constructor(config: Partial<SessionConfig> = {}) {
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
        } else if (this.config.driver === 'redis' && this.config.client) {
            this.driver = new RedisSessionDriver(this.config.client, undefined, this.config.lifetime);
        } else if (this.config.driver === 'database') {
            this.driver = new DatabaseSessionDriver(this.config.table);
        } else {
            this.driver = new MemoryDriver();
        }
    }

    /**
     * Start the session (load from ID)
     */
    async start(id?: string): Promise<string> {
        if (this.started) return this.id!;
        
        this.id = id || randomUuid();
        this.attributes = await this.driver.read(this.id);
        this.started = true;
        
        return this.id;
    }

    /**
     * Save session state
     */
    async save(): Promise<void> {
        if (!this.started || !this.id) return;
        await this.driver.write(this.id, this.attributes);
    }

    /**
     * Get a value
     */
    get<T = any>(key: string, defaultValue?: T): T {
        return (this.attributes[key] !== undefined ? this.attributes[key] : defaultValue) as T;
    }

    /**
     * Set a value
     */
    put(key: string, value: any): void {
        this.attributes[key] = value;
    }

    /**
     * Delete a value
     */
    forget(key: string): void {
        delete this.attributes[key];
    }

    /**
     * Get all attributes
     */
    all(): Record<string, any> {
        return { ...this.attributes };
    }

    /**
     * Destroy the session
     */
    async invalidate(): Promise<void> {
        if (this.id) {
            await this.driver.destroy(this.id);
        }
        this.attributes = {};
        this.started = false;
        this.id = randomUuid(); // Regenerate ID
    }

    /**
     * Regenerate session ID
     */
    async regenerate(): Promise<void> {
        const oldId = this.id;
        this.id = randomUuid();
        if (oldId) await this.driver.destroy(oldId);
        await this.save();
    }
}
