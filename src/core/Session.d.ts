/**
 * CanxJS Session Manager
 * Handles session state via drivers (File / Cookie / Redis)
 */
export interface SessionConfig {
    driver: 'file' | 'cookie' | 'memory';
    lifetime: number;
    expireOnClose: boolean;
    encrypt: boolean;
    files?: string;
    cookie?: string;
}
export interface SessionDriver {
    read(id: string): Promise<Record<string, any>>;
    write(id: string, data: Record<string, any>): Promise<void>;
    destroy(id: string): Promise<void>;
    gc(lifetime: number): Promise<void>;
}
export declare class MemoryDriver implements SessionDriver {
    private store;
    read(id: string): Promise<Record<string, any>>;
    write(id: string, data: Record<string, any>): Promise<void>;
    destroy(id: string): Promise<void>;
    gc(lifetime: number): Promise<void>;
}
export declare class FileDriver implements SessionDriver {
    private path;
    constructor(path: string);
    read(id: string): Promise<Record<string, any>>;
    write(id: string, data: Record<string, any>): Promise<void>;
    destroy(id: string): Promise<void>;
    gc(lifetime: number): Promise<void>;
}
export declare class Session {
    private driver;
    private id;
    private attributes;
    private config;
    private started;
    constructor(config?: Partial<SessionConfig>);
    /**
     * Start the session (load from ID)
     */
    start(id?: string): Promise<string>;
    /**
     * Save session state
     */
    save(): Promise<void>;
    /**
     * Get a value
     */
    get<T = any>(key: string, defaultValue?: T): T;
    /**
     * Set a value
     */
    put(key: string, value: any): void;
    /**
     * Delete a value
     */
    forget(key: string): void;
    /**
     * Get all attributes
     */
    all(): Record<string, any>;
    /**
     * Destroy the session
     */
    invalidate(): Promise<void>;
    /**
     * Regenerate session ID
     */
    regenerate(): Promise<void>;
}
