/**
 * CanxJS Broadcasting
 * 
 * Laravel-style broadcasting for real-time events to frontend clients.
 * Supports Pusher and Ably as broadcast drivers.
 */

// ============================================
// MD5 (pure JS, RFC 1321)
// ============================================

/**
 * Compute the MD5 digest of a string and return it as a lowercase hex string.
 *
 * Pure-JS RFC 1321 implementation — WebCrypto's `crypto.subtle.digest` does NOT
 * support 'MD5', so we cannot rely on it. The input is encoded to UTF-8 bytes
 * before hashing so multi-byte characters (CJK/emoji) hash correctly.
 */
function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);

  const rotl = (x: number, c: number): number => (x << c) | (x >>> (32 - c));
  const add = (a: number, b: number): number => (a + b) | 0;

  // Per-round shift amounts.
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  // Precomputed constants: floor(2^32 * abs(sin(i + 1))).
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];

  // Padding: append 0x80, then zeros, then the 64-bit little-endian bit length.
  const originalBitLen = bytes.length * 8;
  const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6; // multiple of 64
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  // Little-endian 64-bit length (only low 32 bits populated for practical inputs).
  const bitLenLow = originalBitLen >>> 0;
  const bitLenHigh = Math.floor(originalBitLen / 0x100000000) >>> 0;
  msg[paddedLen - 8] = bitLenLow & 0xff;
  msg[paddedLen - 7] = (bitLenLow >>> 8) & 0xff;
  msg[paddedLen - 6] = (bitLenLow >>> 16) & 0xff;
  msg[paddedLen - 5] = (bitLenLow >>> 24) & 0xff;
  msg[paddedLen - 4] = bitLenHigh & 0xff;
  msg[paddedLen - 3] = (bitLenHigh >>> 8) & 0xff;
  msg[paddedLen - 2] = (bitLenHigh >>> 16) & 0xff;
  msg[paddedLen - 1] = (bitLenHigh >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Int32Array(16);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      M[i] = msg[j] | (msg[j + 1] << 8) | (msg[j + 2] << 16) | (msg[j + 3] << 24);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;

      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      f = add(add(add(f, a), K[i]), M[g]);
      a = d;
      d = c;
      c = b;
      b = add(b, rotl(f, s[i]));
    }

    a0 = add(a0, a);
    b0 = add(b0, b);
    c0 = add(c0, c);
    d0 = add(d0, d);
  }

  // Output: little-endian byte order of each 32-bit word, as hex.
  const toHexLE = (n: number): string => {
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return out;
  };

  return toHexLE(a0) + toHexLE(b0) + toHexLE(c0) + toHexLE(d0);
}

// ============================================
// Types
// ============================================

export interface BroadcastEvent {
  channel: string;
  event: string;
  data: unknown;
}

export interface BroadcastDriverConfig {
  [key: string]: unknown;
}

export interface BroadcastDriver {
  name: string;
  broadcast(event: BroadcastEvent): Promise<BroadcastResult>;
  broadcastToMany(events: BroadcastEvent[]): Promise<BroadcastResult[]>;
}

export interface BroadcastResult {
  success: boolean;
  error?: string;
  provider: string;
}

export interface PusherConfig extends BroadcastDriverConfig {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
  useTLS?: boolean;
  host?: string;
  port?: number;
}

export interface AblyConfig extends BroadcastDriverConfig {
  apiKey: string;
}

// ============================================
// Pusher Driver
// ============================================

export class PusherDriver implements BroadcastDriver {
  name = 'pusher';
  private config: PusherConfig;

  constructor(config: PusherConfig) {
    this.config = config;
  }

  async broadcast(event: BroadcastEvent): Promise<BroadcastResult> {
    const { appId, key, secret, cluster, useTLS = true } = this.config;
    
    try {
      const host = this.config.host || `api-${cluster}.pusher.com`;
      const path = `/apps/${appId}/events`;
      const timestamp = Math.floor(Date.now() / 1000);
      
      const body = JSON.stringify({
        name: event.event,
        channel: event.channel,
        data: typeof event.data === 'string' ? event.data : JSON.stringify(event.data),
      });

      // Create signature (Pusher requires the hex MD5 of the JSON body)
      const bodyMd5 = md5(body);
      const stringToSign = [
        'POST',
        path,
        `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`,
      ].join('\n');
      
      const signature = await this.hmacSha256(secret, stringToSign);
      
      const url = `${useTLS ? 'https' : 'http'}://${host}${path}?auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}&auth_signature=${signature}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error, provider: 'pusher' };
      }

      return { success: true, provider: 'pusher' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'pusher',
      };
    }
  }

  async broadcastToMany(events: BroadcastEvent[]): Promise<BroadcastResult[]> {
    return Promise.all(events.map(e => this.broadcast(e)));
  }

  private async hmacSha256(key: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// ============================================
// Ably Driver
// ============================================

export class AblyDriver implements BroadcastDriver {
  name = 'ably';
  private config: AblyConfig;

  constructor(config: AblyConfig) {
    this.config = config;
  }

  async broadcast(event: BroadcastEvent): Promise<BroadcastResult> {
    const { apiKey } = this.config;
    
    try {
      const [keyId] = apiKey.split(':');
      const url = `https://rest.ably.io/channels/${encodeURIComponent(event.channel)}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: event.event,
          data: event.data,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error, provider: 'ably' };
      }

      return { success: true, provider: 'ably' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'ably',
      };
    }
  }

  async broadcastToMany(events: BroadcastEvent[]): Promise<BroadcastResult[]> {
    return Promise.all(events.map(e => this.broadcast(e)));
  }
}

// ============================================
// Log Driver (for testing)
// ============================================

export class LogBroadcastDriver implements BroadcastDriver {
  name = 'log';
  private logs: BroadcastEvent[] = [];

  async broadcast(event: BroadcastEvent): Promise<BroadcastResult> {
    console.log('[Broadcast]', event.channel, ':', event.event, event.data);
    this.logs.push(event);
    return { success: true, provider: 'log' };
  }

  async broadcastToMany(events: BroadcastEvent[]): Promise<BroadcastResult[]> {
    return Promise.all(events.map(e => this.broadcast(e)));
  }

  getLogs(): BroadcastEvent[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

// ============================================
// Redis Driver (pub/sub fan-out across nodes)
// ============================================

/**
 * Redis pub/sub broadcast driver.
 *
 * Publishes events to Redis channels so multiple app nodes can subscribe and
 * fan out the same event to their own connected clients. The `client` is an
 * injected ioredis/node-redis-style instance (typed `any`, not imported — same
 * pattern as RedisStore elsewhere); it only needs a `publish(channel, message)`
 * method. Each published message is `JSON.stringify({ event, data })`.
 */
export class RedisBroadcastDriver implements BroadcastDriver {
  name = 'redis';

  constructor(private client: any, private prefix: string = '') {}

  async broadcast(event: BroadcastEvent): Promise<BroadcastResult> {
    try {
      await this.client.publish(
        this.prefix + event.channel,
        JSON.stringify({ event: event.event, data: event.data })
      );
      return { success: true, provider: 'redis' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'redis',
      };
    }
  }

  async broadcastToMany(events: BroadcastEvent[]): Promise<BroadcastResult[]> {
    return Promise.all(events.map(e => this.broadcast(e)));
  }
}

// ============================================
// Broadcast Manager
// ============================================

export class BroadcastManager {
  private drivers: Map<string, BroadcastDriver> = new Map();
  private defaultDriver: string = 'log';

  /**
   * Register a driver
   */
  driver(name: string, driver: BroadcastDriver): this {
    this.drivers.set(name, driver);
    return this;
  }

  /**
   * Set the default driver
   */
  via(name: string): this {
    this.defaultDriver = name;
    return this;
  }

  /**
   * Get a driver instance
   */
  getDriver(name?: string): BroadcastDriver {
    const driverName = name || this.defaultDriver;
    const driver = this.drivers.get(driverName);
    
    if (!driver) {
      throw new Error(`Broadcast driver "${driverName}" not configured`);
    }
    
    return driver;
  }

  /**
   * Broadcast an event
   */
  async event(channel: string, eventName: string, data: unknown): Promise<BroadcastResult> {
    return this.getDriver().broadcast({ channel, event: eventName, data });
  }

  /**
   * Broadcast to multiple channels
   */
  async toMany(channels: string[], eventName: string, data: unknown): Promise<BroadcastResult[]> {
    const events = channels.map(channel => ({ channel, event: eventName, data }));
    return this.getDriver().broadcastToMany(events);
  }

  /**
   * Configure Pusher driver
   */
  pusher(config: PusherConfig): this {
    return this.driver('pusher', new PusherDriver(config));
  }

  /**
   * Configure Ably driver
   */
  ably(config: AblyConfig): this {
    return this.driver('ably', new AblyDriver(config));
  }

  /**
   * Configure log driver (default)
   */
  log(): this {
    return this.driver('log', new LogBroadcastDriver());
  }
}

// ============================================
// Global Instance
// ============================================

let broadcastInstance: BroadcastManager | null = null;

/**
 * Initialize broadcast manager
 */
export function initBroadcast(config?: { default?: string }): BroadcastManager {
  broadcastInstance = new BroadcastManager();
  broadcastInstance.log(); // Always register log driver
  
  if (config?.default) {
    broadcastInstance.via(config.default);
  }
  
  return broadcastInstance;
}

/**
 * Get the global broadcast manager
 */
export function broadcasting(): BroadcastManager {
  if (!broadcastInstance) {
    broadcastInstance = initBroadcast();
  }
  return broadcastInstance;
}

/**
 * Broadcast an event (shorthand)
 * 
 * @example
 * await broadcast('orders', 'OrderCreated', { orderId: 123 });
 */
export async function broadcast(channel: string, event: string, data: unknown): Promise<BroadcastResult> {
  return broadcasting().event(channel, event, data);
}

// ============================================
// Broadcast Event Helpers
// ============================================

/**
 * Create a broadcastable event class
 * 
 * @example
 * class OrderPlaced extends BroadcastableEvent {
 *   constructor(public order: Order) {
 *     super();
 *   }
 *   
 *   broadcastOn() { return ['orders']; }
 *   broadcastAs() { return 'order.placed'; }
 *   broadcastWith() { return { orderId: this.order.id }; }
 * }
 */
export abstract class BroadcastableEvent {
  abstract broadcastOn(): string | string[];
  abstract broadcastAs(): string;
  abstract broadcastWith(): unknown;

  /**
   * Dispatch this event to broadcast
   */
  async dispatch(): Promise<BroadcastResult[]> {
    const channels = this.broadcastOn();
    const channelArray = Array.isArray(channels) ? channels : [channels];
    const eventName = this.broadcastAs();
    const data = this.broadcastWith();

    return broadcasting().toMany(channelArray, eventName, data);
  }
}
