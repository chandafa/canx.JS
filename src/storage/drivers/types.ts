/**
 * Storage Driver Types
 */

export interface FileMetadata {
  path: string;
  size: number;
  mimeType: string;
  lastModified: Date;
  etag?: string;
}

export interface StorageDriver {
  /**
   * Store content at path
   */
  put(path: string, content: Buffer | string | Blob): Promise<string>;

  /**
   * Get file contents
   */
  get(path: string): Promise<Buffer>;

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
   * Get public URL
   */
  url(path: string): string;

  /**
   * Get temporary signed URL
   */
  temporaryUrl(path: string, expiresIn: number): Promise<string>;

  /**
   * Get file metadata
   */
  metadata(path: string): Promise<FileMetadata>;

  /**
   * List files in directory
   */
  files(directory: string): Promise<string[]>;

  /**
   * List all files recursively
   */
  allFiles(directory: string): Promise<string[]>;

  /**
   * Create directory
   */
  makeDirectory(path: string): Promise<boolean>;

  /**
   * Delete directory
   */
  deleteDirectory(path: string): Promise<boolean>;

  /**
   * Append to file
   */
  append(path: string, content: string | Buffer): Promise<boolean>;

  /**
   * Prepend to file
   */
  prepend(path: string, content: string | Buffer): Promise<boolean>;
}

export interface LocalDriverConfig {
  root: string;
  urlPrefix?: string;
}

export interface S3DriverConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  urlPrefix?: string;
}

export interface StorageConfig {
  default?: string;
  disks?: {
    local?: LocalDriverConfig;
    s3?: S3DriverConfig;
    [key: string]: LocalDriverConfig | S3DriverConfig | undefined;
  };
}
