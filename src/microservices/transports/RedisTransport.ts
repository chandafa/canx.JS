/**
 * CanxJS Redis Transport
 * Redis pub/sub transport for microservices
 */

import { Transport, type TransportOptions, type MessagePattern, type TransportMessage, type MessageContext } from '../Transport';

// ============================================
// Types
// ============================================

export interface RedisTransportOptions extends TransportOptions {
  /** Redis URL (e.g., redis://localhost:6379) */
  url?: string;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** Channel prefix for all topics */
  prefix?: string;
  /** Request timeout in ms */
  requestTimeout?: number;
  /** Serializer (default: JSON) */
  serializer?: 'json' | 'msgpack';
}

// ============================================
// Redis Transport Implementation
// ============================================

export class RedisTransport extends Transport {
  protected redisOptions: RedisTransportOptions;
  private publisher: any = null;
  private subscriber: any = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private responseChannel: string;

  constructor(options: RedisTransportOptions = {}) {
    super(options);
    this.redisOptions = {
      url: options.url || 'redis://localhost:6379',
      password: options.password,
      db: options.db || 0,
      prefix: options.prefix || 'canx',
      requestTimeout: options.requestTimeout || 30000,
      serializer: options.serializer || 'json',
      ...options,
    };
    this.responseChannel = `${this.redisOptions.prefix}:responses:${this.generateId()}`;
  }

  async connect(): Promise<void> {
    try {
      // Dynamic import to make Redis optional
      const Redis = await this.loadRedisClient();
      
      const redisConfig = {
        host: this.options.host,
        port: this.options.port || 6379,
        password: this.redisOptions.password,
        db: this.redisOptions.db,
      };

      // Create publisher connection
      this.publisher = new Redis(redisConfig);
      
      // Create subscriber connection
      this.subscriber = new Redis(redisConfig);

      // Subscribe to response channel
      await this.subscriber.subscribe(this.responseChannel);
      
      // Handle incoming messages
      this.subscriber.on('message', (channel: string, message: string) => {
        this.handleMessage(channel, message);
      });

      this.connected = true;
      console.log(`📡 Redis transport connected to ${this.options.host}:${this.options.port}`);
    } catch (error) {
      throw new Error(`Failed to connect to Redis: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    // Close connections
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }

    this.connected = false;
    console.log('📡 Redis transport disconnected');
  }

  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    const id = this.generateId();
    const channel = this.patternToChannel(pattern);
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${channel}`));
      }, this.redisOptions.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Publish message with reply channel
      const payload = this.serialize({
        ...message,
        replyTo: this.responseChannel,
      });

      this.publisher.publish(channel, payload).catch((error: Error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    const channel = this.patternToChannel(pattern);
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    await this.publisher.publish(channel, this.serialize(message));
  }

  /**
   * Subscribe to patterns (call after connect)
   */
  async listen(): Promise<void> {
    for (const [key] of this.handlers) {
      const channel = `${this.redisOptions.prefix}:${key}`;
      await this.subscriber.subscribe(channel);
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(channel: string, rawMessage: string): Promise<void> {
    try {
      const message = this.deserialize<TransportMessage & { replyTo?: string }>(rawMessage);
      
      // Check if this is a response
      if (channel === this.responseChannel) {
        const pending = this.pendingRequests.get(message.id!);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id!);
          pending.resolve(message.data);
        }
        return;
      }

      // Find handler for pattern
      const handler = this.findHandler(message.pattern);
      if (handler) {
        const context: MessageContext = {
          pattern: message.pattern,
          id: message.id!,
          timestamp: message.timestamp!,
          replyTo: message.replyTo,
        };

        const result = await handler(message.data, context);

        // Send reply if replyTo is specified
        if (message.replyTo) {
          const response: TransportMessage = {
            pattern: message.pattern,
            data: result,
            id: message.id,
            timestamp: Date.now(),
          };
          await this.publisher.publish(message.replyTo, this.serialize(response));
        }
      }
    } catch (error) {
      console.error('Error handling Redis message:', error);
    }
  }

  /**
   * Convert pattern to Redis channel name
   */
  private patternToChannel(pattern: MessagePattern): string {
    const key = this.patternToKey(pattern);
    return `${this.redisOptions.prefix}:${key}`;
  }

  /**
   * Serialize message
   */
  private serialize(data: unknown): string {
    return JSON.stringify(data);
  }

  /**
   * Deserialize message
   */
  private deserialize<T>(data: string): T {
    return JSON.parse(data) as T;
  }

  /**
   * Dynamically load Redis client
   */
  private async loadRedisClient(): Promise<any> {
    try {
      // Try ioredis first
      const ioredis = await import('ioredis');
      return ioredis.default || ioredis;
    } catch {
      throw new Error(
        'Redis client not found. Please install ioredis: npm install ioredis'
      );
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createRedisTransport(options?: RedisTransportOptions): RedisTransport {
  return new RedisTransport(options);
}

export default RedisTransport;
