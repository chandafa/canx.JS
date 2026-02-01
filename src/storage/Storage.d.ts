/**
 * CanxJS Storage - File storage abstraction layer with multiple drivers
 */
import type { StorageDriver, StorageConfig, FileMetadata } from './drivers/types';
import { LocalDriver } from './drivers/LocalDriver';
declare class StorageManager {
    private drivers;
    private defaultDisk;
    private config;
    /**
     * Initialize storage with configuration
     */
    initialize(config: StorageConfig): void;
    /**
     * Register a storage driver
     */
    registerDriver(name: string, driver: StorageDriver): void;
    /**
     * Get a disk instance
     */
    disk(name?: string): StorageDriver;
    /**
     * Store a file (shortcut to default disk)
     */
    put(path: string, content: Buffer | string | Blob): Promise<string>;
    /**
     * Get file contents
     */
    get(path: string): Promise<Buffer>;
    /**
     * Get file as string
     */
    getString(path: string, encoding?: BufferEncoding): Promise<string>;
    /**
     * Check if file exists
     */
    exists(path: string): Promise<boolean>;
    /**
     * Delete a file
     */
    delete(path: string): Promise<boolean>;
    /**
     * Copy a file
     */
    copy(from: string, to: string): Promise<boolean>;
    /**
     * Move a file
     */
    move(from: string, to: string): Promise<boolean>;
    /**
     * Get file URL
     */
    url(path: string): string;
    /**
     * Get temporary URL (for private files)
     */
    temporaryUrl(path: string, expiresIn?: number): Promise<string>;
    /**
     * Get file metadata
     */
    metadata(path: string): Promise<FileMetadata>;
    /**
     * List files in directory
     */
    files(directory?: string): Promise<string[]>;
    /**
     * List all files recursively
     */
    allFiles(directory?: string): Promise<string[]>;
    /**
     * Create directory
     */
    makeDirectory(path: string): Promise<boolean>;
    /**
     * Delete directory
     */
    deleteDirectory(path: string): Promise<boolean>;
    /**
     * Get file size in bytes
     */
    size(path: string): Promise<number>;
    /**
     * Get file MIME type
     */
    mimeType(path: string): Promise<string>;
    /**
     * Append to file
     */
    append(path: string, content: string | Buffer): Promise<boolean>;
    /**
     * Prepend to file
     */
    prepend(path: string, content: string | Buffer): Promise<boolean>;
}
import type { CanxRequest } from '../types';
interface UploadOptions {
    disk?: string;
    directory?: string;
    filename?: string | ((file: File) => string);
    allowedTypes?: string[];
    maxSize?: number;
}
interface UploadedFile {
    path: string;
    url: string;
    originalName: string;
    size: number;
    mimeType: string;
}
export declare function handleUpload(req: CanxRequest, fieldName: string, options?: UploadOptions): Promise<UploadedFile | null>;
export declare function handleMultipleUploads(req: CanxRequest, fieldName: string, options?: UploadOptions): Promise<UploadedFile[]>;
export declare const storage: StorageManager;
export declare function initStorage(config: StorageConfig): void;
export { StorageDriver, StorageConfig, FileMetadata, LocalDriver };
export default storage;
