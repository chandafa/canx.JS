/**
 * S3-Compatible Storage Driver
 * Works with AWS S3, MinIO, DigitalOcean Spaces, etc.
 */
import type { StorageDriver, FileMetadata, S3DriverConfig } from './types';
export declare class S3Driver implements StorageDriver {
    private config;
    private endpoint;
    constructor(config: S3DriverConfig);
    private getUrl;
    private sign;
    private sha256;
    private hmac;
    private hmacHex;
    private getSigningKey;
    put(path: string, content: Buffer | string | Blob): Promise<string>;
    get(path: string): Promise<Buffer>;
    exists(path: string): Promise<boolean>;
    delete(path: string): Promise<boolean>;
    copy(from: string, to: string): Promise<boolean>;
    move(from: string, to: string): Promise<boolean>;
    url(path: string): string;
    temporaryUrl(path: string, expiresIn: number): Promise<string>;
    metadata(path: string): Promise<FileMetadata>;
    files(directory?: string): Promise<string[]>;
    allFiles(directory?: string): Promise<string[]>;
    makeDirectory(_path: string): Promise<boolean>;
    deleteDirectory(path: string): Promise<boolean>;
    append(path: string, content: string | Buffer): Promise<boolean>;
    prepend(path: string, content: string | Buffer): Promise<boolean>;
}
export default S3Driver;
