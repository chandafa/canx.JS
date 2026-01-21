/**
 * CanxJS Transport Layer
 * Abstraction for microservice communication patterns
 */

// ============================================
// Types
// ============================================

export interface TransportOptions {
  host?: string;
  port?: number;
  retries?: number;
  timeout?: number;
}

export interface MessagePattern {
  cmd?: string;
  event?: string;
  [key: string]: unknown;
}

export interface TransportMessage<T = unknown> {
  pattern: MessagePattern;
  data: T;
  id?: string;
  timestamp?: number;
}

export interface TransportHandler<T = unknown, R = unknown> {
  (data: T, context?: MessageContext): R | Promise<R>;
}

export interface MessageContext {
  pattern: MessagePattern;
  id: string;
  timestamp: number;
  replyTo?: string;
  headers?: Record<string, string>;
}

// ============================================
// Transport Base Class
// ============================================

export abstract class Transport {
  protected options: TransportOptions;
  protected handlers: Map<string, TransportHandler> = new Map();
  protected connected = false;

  constructor(options: TransportOptions = {}) {
    this.options = {
      host: options.host || 'localhost',
      port: options.port || 3000,
      retries: options.retries || 3,
      timeout: options.timeout || 30000,
    };
  }

  /**
   * Connect to transport
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from transport
   */
  abstract disconnect(): Promise<void>;

  /**
   * Send message (request-response)
   */
  abstract send<T, R>(pattern: MessagePattern, data: T): Promise<R>;

  /**
   * Emit event (fire-and-forget)
   */
  abstract emit<T>(pattern: MessagePattern, data: T): Promise<void>;

  /**
   * Register handler for pattern
   */
  subscribe(pattern: MessagePattern, handler: TransportHandler): void {
    const key = this.patternToKey(pattern);
    this.handlers.set(key, handler);
  }

  /**
   * Unregister handler
   */
  unsubscribe(pattern: MessagePattern): void {
    const key = this.patternToKey(pattern);
    this.handlers.delete(key);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Convert pattern to string key
   */
  protected patternToKey(pattern: MessagePattern): string {
    if (pattern.cmd) return `cmd:${pattern.cmd}`;
    if (pattern.event) return `event:${pattern.event}`;
    return JSON.stringify(pattern);
  }

  /**
   * Find handler for pattern
   */
  protected findHandler(pattern: MessagePattern): TransportHandler | undefined {
    const key = this.patternToKey(pattern);
    return this.handlers.get(key);
  }

  /**
   * Generate unique message ID
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================
// In-Memory Transport (for testing/local)
// ============================================

export class InMemoryTransport extends Transport {
  private static instances: Map<string, InMemoryTransport> = new Map();
  private pendingResponses: Map<string, { resolve: Function; reject: Function }> = new Map();

  constructor(options: TransportOptions = {}) {
    super(options);
    const key = `${this.options.host}:${this.options.port}`;
    InMemoryTransport.instances.set(key, this);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    const key = `${this.options.host}:${this.options.port}`;
    InMemoryTransport.instances.delete(key);
  }

  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    const id = this.generateId();
    const message: TransportMessage<T> = {
      pattern,
      data,
      id,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      this.pendingResponses.set(id, { resolve, reject });

      // Process locally or find remote handler
      const handler = this.findHandler(pattern);
      if (handler) {
        const context: MessageContext = {
          pattern,
          id,
          timestamp: message.timestamp!,
        };

        Promise.resolve(handler(data, context))
          .then(result => {
            const pending = this.pendingResponses.get(id);
            if (pending) {
              pending.resolve(result);
              this.pendingResponses.delete(id);
            }
          })
          .catch(error => {
            const pending = this.pendingResponses.get(id);
            if (pending) {
              pending.reject(error);
              this.pendingResponses.delete(id);
            }
          });
      } else {
        reject(new Error(`No handler for pattern: ${JSON.stringify(pattern)}`));
        this.pendingResponses.delete(id);
      }
    });
  }

  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    const handler = this.findHandler(pattern);
    if (handler) {
      const context: MessageContext = {
        pattern,
        id: this.generateId(),
        timestamp: Date.now(),
      };
      await handler(data, context);
    }
    // Fire and forget - no error if no handler
  }
}

// ============================================
// TCP Transport
// ============================================

export class TcpTransport extends Transport {
  private socket: any = null;

  async connect(): Promise<void> {
    // TCP connection would go here
    // For now, we'll use a mock implementation
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      // Close TCP socket
    }
    this.connected = false;
  }

  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }
    
    const message: TransportMessage<T> = {
      pattern,
      data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // In a real implementation, this would send over TCP
    // and wait for response
    return Promise.resolve({} as R);
  }

  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    const message: TransportMessage<T> = {
      pattern,
      data,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // Fire and forget
  }
}

// ============================================
// Client Proxy (for calling services)
// ============================================

export class ClientProxy {
  private transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /**
   * Send request and wait for response
   */
  async send<T, R>(pattern: MessagePattern, data: T): Promise<R> {
    return this.transport.send<T, R>(pattern, data);
  }

  /**
   * Emit event (fire-and-forget)
   */
  async emit<T>(pattern: MessagePattern, data: T): Promise<void> {
    return this.transport.emit(pattern, data);
  }

  /**
   * Connect the underlying transport
   */
  async connect(): Promise<void> {
    return this.transport.connect();
  }

  /**
   * Disconnect the underlying transport
   */
  async close(): Promise<void> {
    return this.transport.disconnect();
  }
}

// ============================================
// Microservice Server
// ============================================

export class MicroserviceServer {
  private transport: Transport;
  private started = false;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /**
   * Register message pattern handler
   */
  addHandler(pattern: MessagePattern, handler: TransportHandler): this {
    this.transport.subscribe(pattern, handler);
    return this;
  }

  /**
   * Decorator-style pattern registration
   */
  messagePattern(pattern: MessagePattern) {
    return (handler: TransportHandler) => {
      this.addHandler(pattern, handler);
      return handler;
    };
  }

  /**
   * Start the microservice
   */
  async start(): Promise<void> {
    await this.transport.connect();
    this.started = true;
    console.log(`🚀 Microservice started`);
  }

  /**
   * Stop the microservice
   */
  async stop(): Promise<void> {
    await this.transport.disconnect();
    this.started = false;
    console.log(`🛑 Microservice stopped`);
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.started;
  }
}

// ============================================
// Decorators for Microservices
// ============================================

const messagePatternMetadata = new Map<string, MessagePattern>();
const eventPatternMetadata = new Map<string, MessagePattern>();

/**
 * MessagePattern decorator
 */
export function MessageHandler(pattern: MessagePattern): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const key = `${target.constructor.name}.${String(propertyKey)}`;
    messagePatternMetadata.set(key, pattern);
    return descriptor;
  };
}

/**
 * EventPattern decorator
 */
export function EventHandler(pattern: MessagePattern): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const key = `${target.constructor.name}.${String(propertyKey)}`;
    eventPatternMetadata.set(key, { ...pattern, event: pattern.event || pattern.cmd });
    return descriptor;
  };
}

/**
 * Get message pattern for a handler
 */
export function getMessagePattern(target: Function, propertyKey: string): MessagePattern | undefined {
  return messagePatternMetadata.get(`${target.name}.${propertyKey}`);
}

/**
 * Get event pattern for a handler
 */
export function getEventPattern(target: Function, propertyKey: string): MessagePattern | undefined {
  return eventPatternMetadata.get(`${target.name}.${propertyKey}`);
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a client proxy for microservice communication
 */
export function createClient(options?: TransportOptions): ClientProxy {
  const transport = new InMemoryTransport(options);
  return new ClientProxy(transport);
}

/**
 * Create a microservice server
 */
export function createMicroservice(options?: TransportOptions): MicroserviceServer {
  const transport = new InMemoryTransport(options);
  return new MicroserviceServer(transport);
}

export default { Transport, InMemoryTransport, TcpTransport, ClientProxy, MicroserviceServer };
