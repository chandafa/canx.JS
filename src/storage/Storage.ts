/**
 * CanxJS Storage - File storage abstraction layer with multiple drivers
 */

import type { StorageDriver, StorageConfig, FileMetadata } from './drivers/types';
import { LocalDriver } from './drivers/LocalDriver';

// ============================================
// Storage Manager
// ============================================

class StorageManager {
  private drivers: Map<string, StorageDriver> = new Map();
  private defaultDisk: string = 'local';
  private config: StorageConfig = {};

  /**
   * Initialize storage with configuration
   */
  initialize(config: StorageConfig): void {
    this.config = config;
    this.defaultDisk = config.default || 'local';

    // Auto-register local driver
    if (config.disks?.local) {
      this.registerDriver('local', new LocalDriver(config.disks.local));
    } else {
      this.registerDriver('local', new LocalDriver({ root: './storage' }));
    }

    // Register S3 driver if configured
    if (config.disks?.s3) {
      // Lazy load S3 driver
      import('./drivers/S3Driver').then(({ S3Driver }) => {
        this.registerDriver('s3', new S3Driver(config.disks!.s3!));
      });
    }
  }

  /**
   * Register a storage driver
   */
  registerDriver(name: string, driver: StorageDriver): void {
    this.drivers.set(name, driver);
  }

  /**
   * Get a disk instance
   */
  disk(name?: string): StorageDriver {
    const diskName = name || this.defaultDisk;
    const driver = this.drivers.get(diskName);
    
    if (!driver) {
      throw new Error(`Storage disk "${diskName}" not found. Available disks: ${Array.from(this.drivers.keys()).join(', ')}`);
    }
    
    return driver;
  }

  /**
   * Store a file (shortcut to default disk)
   */
  async put(path: string, content: Buffer | string | Blob): Promise<string> {
    return this.disk().put(path, content);
  }

  /**
   * Get file contents
   */
  async get(path: string): Promise<Buffer> {
    return this.disk().get(path);
  }

  /**
   * Get file as string
   */
  async getString(path: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    const buffer = await this.get(path);
    return buffer.toString(encoding);
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    return this.disk().exists(path);
  }

  /**
   * Delete a file
   */
  async delete(path: string): Promise<boolean> {
    return this.disk().delete(path);
  }

  /**
   * Copy a file
   */
  async copy(from: string, to: string): Promise<boolean> {
    return this.disk().copy(from, to);
  }

  /**
   * Move a file
   */
  async move(from: string, to: string): Promise<boolean> {
    return this.disk().move(from, to);
  }

  /**
   * Get file URL
   */
  url(path: string): string {
    return this.disk().url(path);
  }

  /**
   * Get temporary URL (for private files)
   */
  async temporaryUrl(path: string, expiresIn: number = 3600): Promise<string> {
    return this.disk().temporaryUrl(path, expiresIn);
  }

  /**
   * Get file metadata
   */
  async metadata(path: string): Promise<FileMetadata> {
    return this.disk().metadata(path);
  }

  /**
   * List files in directory
   */
  async files(directory: string = ''): Promise<string[]> {
    return this.disk().files(directory);
  }

  /**
   * List all files recursively
   */
  async allFiles(directory: string = ''): Promise<string[]> {
    return this.disk().allFiles(directory);
  }

  /**
   * Create directory
   */
  async makeDirectory(path: string): Promise<boolean> {
    return this.disk().makeDirectory(path);
  }

  /**
   * Delete directory
   */
  async deleteDirectory(path: string): Promise<boolean> {
    return this.disk().deleteDirectory(path);
  }

  /**
   * Get file size in bytes
   */
  async size(path: string): Promise<number> {
    const meta = await this.metadata(path);
    return meta.size;
  }

  /**
   * Get file MIME type
   */
  async mimeType(path: string): Promise<string> {
    const meta = await this.metadata(path);
    return meta.mimeType;
  }

  /**
   * Append to file
   */
  async append(path: string, content: string | Buffer): Promise<boolean> {
    return this.disk().append(path, content);
  }

  /**
   * Prepend to file
   */
  async prepend(path: string, content: string | Buffer): Promise<boolean> {
    return this.disk().prepend(path, content);
  }
}

// ============================================
// File Upload Handler
// ============================================

import type { CanxRequest } from '../types';

interface UploadOptions {
  disk?: string;
  directory?: string;
  filename?: string | ((file: File) => string);
  allowedTypes?: string[];
  maxSize?: number; // in bytes
}

interface UploadedFile {
  path: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export async function handleUpload(
  req: CanxRequest,
  fieldName: string,
  options: UploadOptions = {}
): Promise<UploadedFile | null> {
  const formData = await req.formData();
  const file = formData.get(fieldName);

  if (!file || !(file instanceof File)) {
    return null;
  }

  // Validate file type
  if (options.allowedTypes && options.allowedTypes.length > 0) {
    if (!options.allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`);
    }
  }

  // Validate file size
  if (options.maxSize && file.size > options.maxSize) {
    throw new Error(`File size ${file.size} exceeds maximum allowed size of ${options.maxSize} bytes`);
  }

  // Generate filename
  let filename: string;
  if (typeof options.filename === 'function') {
    filename = options.filename(file);
  } else if (options.filename) {
    filename = options.filename;
  } else {
    const ext = file.name.split('.').pop() || '';
    filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  }

  const directory = options.directory || 'uploads';
  const path = `${directory}/${filename}`;

  // Store file
  const disk = storage.disk(options.disk);
  const buffer = Buffer.from(await file.arrayBuffer());
  await disk.put(path, buffer);

  return {
    path,
    url: disk.url(path),
    originalName: file.name,
    size: file.size,
    mimeType: file.type,
  };
}

export async function handleMultipleUploads(
  req: CanxRequest,
  fieldName: string,
  options: UploadOptions = {}
): Promise<UploadedFile[]> {
  const formData = await req.formData();
  const files = formData.getAll(fieldName);
  const results: UploadedFile[] = [];

  for (const file of files) {
    if (file instanceof File) {
      // Create a mock request with this single file
      const mockFormData = new FormData();
      mockFormData.append(fieldName, file);
      
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Validate and process
      if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
        continue;
      }
      if (options.maxSize && file.size > options.maxSize) {
        continue;
      }

      const ext = file.name.split('.').pop() || '';
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const directory = options.directory || 'uploads';
      const path = `${directory}/${filename}`;

      const disk = storage.disk(options.disk);
      await disk.put(path, buffer);

      results.push({
        path,
        url: disk.url(path),
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      });
    }
  }

  return results;
}

// ============================================
// Singleton & Exports
// ============================================

export const storage = new StorageManager();

export function initStorage(config: StorageConfig): void {
  storage.initialize(config);
}

export { StorageDriver, StorageConfig, FileMetadata, LocalDriver };

export default storage;
