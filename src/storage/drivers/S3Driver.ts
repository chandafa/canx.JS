/**
 * S3-Compatible Storage Driver
 * Works with AWS S3, MinIO, DigitalOcean Spaces, etc.
 */

import type { StorageDriver, FileMetadata, S3DriverConfig } from './types';

// Simple S3 client implementation without external dependencies
// Uses Bun's native fetch with AWS Signature V4

export class S3Driver implements StorageDriver {
  private config: S3DriverConfig;
  private endpoint: string;

  constructor(config: S3DriverConfig) {
    this.config = config;
    this.endpoint = config.endpoint || `https://s3.${config.region}.amazonaws.com`;
  }

  private getUrl(path: string): string {
    if (this.config.forcePathStyle) {
      return `${this.endpoint}/${this.config.bucket}/${path}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${path}`;
  }

  private async sign(
    method: string,
    path: string,
    headers: Record<string, string>,
    payload: string = ''
  ): Promise<Record<string, string>> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
    const canonicalHeaders = Object.entries(headers)
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
      .sort()
      .join('\n');

    const payloadHash = await this.sha256(payload);
    const canonicalRequest = [
      method,
      `/${path}`,
      '',
      canonicalHeaders + '\n',
      signedHeaders,
      payloadHash,
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      scope,
      await this.sha256(canonicalRequest),
    ].join('\n');

    const signingKey = await this.getSigningKey(dateStamp);
    const signature = await this.hmacHex(signingKey, stringToSign);

    const authorization = `${algorithm} Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization,
    };
  }

  private async sha256(data: string): Promise<string> {
    const buffer = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async hmac(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
    const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  }

  private async hmacHex(key: ArrayBuffer, data: string): Promise<string> {
    const result = await this.hmac(key, data);
    return Array.from(new Uint8Array(result))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async getSigningKey(dateStamp: string): Promise<ArrayBuffer> {
    const kDate = await this.hmac('AWS4' + this.config.secretAccessKey, dateStamp);
    const kRegion = await this.hmac(kDate, this.config.region);
    const kService = await this.hmac(kRegion, 's3');
    return this.hmac(kService, 'aws4_request');
  }

  async put(path: string, content: Buffer | string | Blob): Promise<string> {
    let body: string;
    let contentType = 'application/octet-stream';

    if (content instanceof Blob) {
      body = await content.text();
      contentType = content.type || contentType;
    } else if (Buffer.isBuffer(content)) {
      body = content.toString('binary');
    } else {
      body = content;
    }

    const headers = await this.sign('PUT', path, {
      Host: new URL(this.getUrl(path)).host,
      'Content-Type': contentType,
      'Content-Length': String(body.length),
    }, body);

    const response = await fetch(this.getUrl(path), {
      method: 'PUT',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`S3 PUT failed: ${response.status} ${response.statusText}`);
    }

    return path;
  }

  async get(path: string): Promise<Buffer> {
    const headers = await this.sign('GET', path, {
      Host: new URL(this.getUrl(path)).host,
    });

    const response = await fetch(this.getUrl(path), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`S3 GET failed: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async exists(path: string): Promise<boolean> {
    try {
      const headers = await this.sign('HEAD', path, {
        Host: new URL(this.getUrl(path)).host,
      });

      const response = await fetch(this.getUrl(path), {
        method: 'HEAD',
        headers,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async delete(path: string): Promise<boolean> {
    try {
      const headers = await this.sign('DELETE', path, {
        Host: new URL(this.getUrl(path)).host,
      });

      const response = await fetch(this.getUrl(path), {
        method: 'DELETE',
        headers,
      });

      return response.ok;
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
    const copied = await this.copy(from, to);
    if (copied) {
      return this.delete(from);
    }
    return false;
  }

  url(path: string): string {
    if (this.config.urlPrefix) {
      return `${this.config.urlPrefix}/${path}`;
    }
    return this.getUrl(path);
  }

  async temporaryUrl(path: string, expiresIn: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.config.accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': 'host',
    });

    const canonicalRequest = [
      'GET',
      `/${path}`,
      queryParams.toString(),
      `host:${new URL(this.getUrl(path)).host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      await this.sha256(canonicalRequest),
    ].join('\n');

    const signingKey = await this.getSigningKey(dateStamp);
    const signature = await this.hmacHex(signingKey, stringToSign);

    queryParams.append('X-Amz-Signature', signature);

    return `${this.getUrl(path)}?${queryParams.toString()}`;
  }

  async metadata(path: string): Promise<FileMetadata> {
    const headers = await this.sign('HEAD', path, {
      Host: new URL(this.getUrl(path)).host,
    });

    const response = await fetch(this.getUrl(path), {
      method: 'HEAD',
      headers,
    });

    if (!response.ok) {
      throw new Error(`S3 HEAD failed: ${response.status}`);
    }

    return {
      path,
      size: parseInt(response.headers.get('content-length') || '0'),
      mimeType: response.headers.get('content-type') || 'application/octet-stream',
      lastModified: new Date(response.headers.get('last-modified') || Date.now()),
      etag: response.headers.get('etag') || undefined,
    };
  }

  async files(directory: string = ''): Promise<string[]> {
    // S3 ListObjects implementation
    const prefix = directory ? `${directory}/` : '';
    const url = `${this.endpoint}/${this.config.bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}&delimiter=%2F`;

    const headers = await this.sign('GET', '', {
      Host: new URL(url).host,
    });

    const response = await fetch(url, { headers });
    const xml = await response.text();

    // Simple XML parsing for S3 response
    const keys: string[] = [];
    const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    for (const match of keyMatches) {
      keys.push(match[1]);
    }

    return keys;
  }

  async allFiles(directory: string = ''): Promise<string[]> {
    const prefix = directory ? `${directory}/` : '';
    const url = `${this.endpoint}/${this.config.bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}`;

    const headers = await this.sign('GET', '', {
      Host: new URL(url).host,
    });

    const response = await fetch(url, { headers });
    const xml = await response.text();

    const keys: string[] = [];
    const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    for (const match of keyMatches) {
      keys.push(match[1]);
    }

    return keys;
  }

  async makeDirectory(_path: string): Promise<boolean> {
    // S3 doesn't have real directories, but we can create a placeholder
    return true;
  }

  async deleteDirectory(path: string): Promise<boolean> {
    const files = await this.allFiles(path);
    for (const file of files) {
      await this.delete(file);
    }
    return true;
  }

  async append(path: string, content: string | Buffer): Promise<boolean> {
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

export default S3Driver;
