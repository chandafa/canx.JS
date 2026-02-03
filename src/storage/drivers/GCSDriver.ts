import { S3Driver } from './S3Driver';
import type { GCSDriverConfig } from './types';

/**
 * Google Cloud Storage Driver
 * Uses S3 Interoperability Mode (HMAC Keys)
 */
export class GCSDriver extends S3Driver {
  constructor(config: GCSDriverConfig) {
    // Force GCS defaults
    super({
      ...config,
      endpoint: config.endpoint || 'https://storage.googleapis.com',
      region: config.region || 'auto', // GCS doesn't strictly require region in endpoint for global access
      // GCS path style is https://storage.googleapis.com/bucket/object
      forcePathStyle: config.forcePathStyle !== undefined ? config.forcePathStyle : true,
    });
  }
}
