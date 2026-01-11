/**
 * Local Filesystem Storage Driver
 */

import { join, dirname, relative } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync } from 'fs';
import type { StorageDriver, FileMetadata, LocalDriverConfig } from './types';

export class LocalDriver implements StorageDriver {
  private root: string;
  private urlPrefix: string;

  constructor(config: LocalDriverConfig) {
    this.root = config.root;
    this.urlPrefix = config.urlPrefix || '/storage';
    
    // Ensure root directory exists
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  private getFullPath(path: string): string {
    return join(this.root, path);
  }

  async put(path: string, content: Buffer | string | Blob): Promise<string> {
    const fullPath = this.getFullPath(path);
    const dir = dirname(fullPath);
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let data: Buffer | string;
    if (content instanceof Blob) {
      data = Buffer.from(await content.arrayBuffer());
    } else {
      data = content;
    }

    await Bun.write(fullPath, data);
    return path;
  }

  async get(path: string): Promise<Buffer> {
    const fullPath = this.getFullPath(path);
    const file = Bun.file(fullPath);
    
    if (!(await file.exists())) {
      throw new Error(`File not found: ${path}`);
    }
    
    return Buffer.from(await file.arrayBuffer());
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    return Bun.file(fullPath).exists();
  }

  async delete(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    try {
      unlinkSync(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async copy(from: string, to: string): Promise<boolean> {
    try {
      const content = await this.get(from);
      await this.put(to, content);
      return true;
    } catch {
      return false;
    }
  }

  async move(from: string, to: string): Promise<boolean> {
    try {
      const success = await this.copy(from, to);
      if (success) {
        await this.delete(from);
      }
      return success;
    } catch {
      return false;
    }
  }

  url(path: string): string {
    return `${this.urlPrefix}/${path}`;
  }

  async temporaryUrl(path: string, expiresIn: number): Promise<string> {
    // For local storage, generate a signed URL token
    const expires = Date.now() + (expiresIn * 1000);
    const token = Buffer.from(`${path}:${expires}`).toString('base64url');
    return `${this.urlPrefix}/${path}?token=${token}&expires=${expires}`;
  }

  async metadata(path: string): Promise<FileMetadata> {
    const fullPath = this.getFullPath(path);
    const stat = statSync(fullPath);
    const file = Bun.file(fullPath);
    
    return {
      path,
      size: stat.size,
      mimeType: file.type || 'application/octet-stream',
      lastModified: stat.mtime,
    };
  }

  async files(directory: string = ''): Promise<string[]> {
    const fullPath = this.getFullPath(directory);
    
    if (!existsSync(fullPath)) {
      return [];
    }

    const entries = readdirSync(fullPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile())
      .map(entry => join(directory, entry.name));
  }

  async allFiles(directory: string = ''): Promise<string[]> {
    const fullPath = this.getFullPath(directory);
    const results: string[] = [];

    if (!existsSync(fullPath)) {
      return results;
    }

    const scan = (dir: string) => {
      const entries = readdirSync(this.getFullPath(dir), { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = join(dir, entry.name);
        if (entry.isFile()) {
          results.push(entryPath);
        } else if (entry.isDirectory()) {
          scan(entryPath);
        }
      }
    };

    scan(directory);
    return results;
  }

  async makeDirectory(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    try {
      mkdirSync(fullPath, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  async deleteDirectory(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    
    try {
      const deleteRecursive = (dir: string) => {
        if (existsSync(dir)) {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const entryPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              deleteRecursive(entryPath);
            } else {
              unlinkSync(entryPath);
            }
          }
          rmdirSync(dir);
        }
      };
      
      deleteRecursive(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async append(path: string, content: string | Buffer): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    try {
      const existing = await this.exists(path) ? await this.get(path) : Buffer.alloc(0);
      const appended = Buffer.concat([existing, Buffer.from(content)]);
      await this.put(path, appended);
      return true;
    } catch {
      return false;
    }
  }

  async prepend(path: string, content: string | Buffer): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    try {
      const existing = await this.exists(path) ? await this.get(path) : Buffer.alloc(0);
      const prepended = Buffer.concat([Buffer.from(content), existing]);
      await this.put(path, prepended);
      return true;
    } catch {
      return false;
    }
  }
}

export default LocalDriver;
