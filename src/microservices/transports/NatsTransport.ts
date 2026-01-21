/**
 * CanxJS NATS Transport
 * NATS messaging transport for microservices
 */

import { Transport, type TransportOptions, type MessagePattern, type TransportMessage, type MessageContext } from '../Transport';

// ============================================
// Types
// ============================================

export interface NatsTransportOptions extends TransportOptions {
  /** NATS server URLs */
  servers?: string[];
  /** Authentication token */
  token?: string;
  /** Username for auth */
  user?: string;
  /** Password for auth */
  pass?: string;
  /** Subject prefix */
  prefix?: string;
  /** Queue group name (for load balancing) */
  queue?: string;
  /** Request timeout in ms */
  requestTimeout?: number;
}

// ============================================
// NATS Transport Implementation
// ============================================

export class NatsTransport extends Transport {
  protected natsOptions: NatsTransportOptions;
  private connection: any = null;
  private subscriptions: Map<string, any> = new Map();

  constructor(options: NatsTransportOptions = {}) {
    super(options);
    this.natsOptions = {
      servers: options.servers || [`nats://${options.host || 'localhost'}:${options.port || 4222}`],
      token: options.token,
      user: options.user,
      pass: options.pass,
      prefix: options.prefix || 'canx',
      queue: options.queue,
      requestTimeout: options.requestTimeout || 30000,
      ...options,
    };
  }

  async connect(): Promise<void> {
    try {
      const nats = await this.loadNatsClient();
      
      const natsConfig: any = {
        servers: this.natsOptions.servers,
      };

      if (this.natsOptions.token) {
        natsConfig.token = this.natsOptions.token;
      }
      if (this.natsOptions.user && this.natsOptions.pass) {
        natsConfig.user = this.natsOptions.user;
        natsConfig.pass = this.natsOptions.pass;
      }

      this.connection = await nats.connect(natsConfig);
      this.connected = true;
      
      console.log(`📡 NATS transport connected to ${this.natsOptions.servers?.join(', ')}`);

      // Handle connection events
      (async () => {
        for await (const status of this.connection.status()) {
          if (status.type === 'disconnect') {
            console.warn('NATS disconnected');
            this.connected = false;
          } else if (status.type === 'reconnect') {
            console.log('NATS reconnected');
            this.connected = true;
          }
        }
      })().catch(() => {});
    } catch (error) {
      throw new Error(`Failed to connect to NATS: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    // Unsubscribe from all subjects
    for (const sub of this.subscriptions.values()) {
      await sub.drain();
    }
    this.subscriptions.clear();

    // Close connection
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
    }

    this.connected = false;
    console.log('📡 NATS transport disconnected');
  }

  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    if (!this.connected || !this.connection) {
      throw new Error('Transport not connected');
    }

    const subject = this.patternToSubject(pattern);
    const nats = await this.loadNatsClient();
    const codec = nats.JSONCodec();
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    try {
      const response = await this.connection.request(
        subject,
        codec.encode(message),
        { timeout: this.natsOptions.requestTimeout }
      );

      const decoded = codec.decode(response.data) as TransportMessage<R>;
      return decoded.data;
    } catch (error: any) {
      if (error.code === 'TIMEOUT' || error.code === '503') {
        throw new Error(`NATS request timeout: ${subject}`);
      }
      throw error;
    }
  }

  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    if (!this.connected || !this.connection) {
      throw new Error('Transport not connected');
    }

    const subject = this.patternToSubject(pattern);
    const nats = await this.loadNatsClient();
    const codec = nats.JSONCodec();
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.connection.publish(subject, codec.encode(message));
  }

  /**
   * Start listening for messages
   */
  async listen(): Promise<void> {
    if (!this.connected || !this.connection) {
      throw new Error('Transport not connected');
    }

    const nats = await this.loadNatsClient();
    const codec = nats.JSONCodec();

    for (const [key] of this.handlers) {
      const subject = `${this.natsOptions.prefix}.${key}`;
      
      const subscriptionOptions: any = {};
      if (this.natsOptions.queue) {
        subscriptionOptions.queue = this.natsOptions.queue;
      }

      const sub = this.connection.subscribe(subject, subscriptionOptions);
      this.subscriptions.set(key, sub);

      // Process messages
      (async () => {
        for await (const msg of sub) {
          try {
            const message = codec.decode(msg.data) as TransportMessage;
            const handler = this.findHandler(message.pattern);
            
            if (handler) {
              const context: MessageContext = {
                pattern: message.pattern,
                id: message.id!,
                timestamp: message.timestamp!,
              };

              const result = await handler(message.data, context);

              // Reply if this is a request
              if (msg.reply) {
                const response: TransportMessage = {
                  pattern: message.pattern,
                  data: result,
                  id: message.id,
                  timestamp: Date.now(),
                };
                msg.respond(codec.encode(response));
              }
            }
          } catch (error) {
            console.error('Error handling NATS message:', error);
          }
        }
      })().catch(() => {});
    }
  }

  /**
   * Convert pattern to NATS subject
   */
  private patternToSubject(pattern: MessagePattern): string {
    const key = this.patternToKey(pattern);
    return `${this.natsOptions.prefix}.${key}`;
  }

  /**
   * Dynamically load NATS client
   */
  private async loadNatsClient(): Promise<any> {
    try {
      return await import('nats');
    } catch {
      throw new Error(
        'NATS client not found. Please install nats: npm install nats'
      );
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createNatsTransport(options?: NatsTransportOptions): NatsTransport {
  return new NatsTransport(options);
}

export default NatsTransport;
