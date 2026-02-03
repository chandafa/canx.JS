/**
 * CanxJS Broadcasting
 * 
 * Laravel-style broadcasting for real-time events to frontend clients.
 * Supports Pusher and Ably as broadcast drivers.
 */

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

      // Create signature
      const bodyMd5 = await this.md5(body);
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

  private async md5(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
