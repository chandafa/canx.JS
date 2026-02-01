/**
 * Local Filesystem Storage Driver
 */
import type { StorageDriver, FileMetadata, LocalDriverConfig } from './types';
export declare class LocalDriver implements StorageDriver {
    private root;
    private urlPrefix;
    constructor(config: LocalDriverConfig);
    private getFullPath;
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
    makeDirectory(path: string): Promise<boolean>;
    deleteDirectory(path: string): Promise<boolean>;
    append(path: string, content: string | Buffer): Promise<boolean>;
    prepend(path: string, content: string | Buffer): Promise<boolean>;
}
export default LocalDriver;
