/**
 * CanxJS Event Bus - Enterprise pub/sub messaging system
 * @description Distributed event bus with Redis/RabbitMQ support for microservices
 */

export type EventHandler<T = unknown> = (event: EventMessage<T>) => Promise<void> | void;

export interface EventMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: Date;
  source?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface EventBusConfig {
  /** Service/source name */
  serviceName?: string;
  /** Event prefix */
  prefix?: string;
  /** Dead letter queue enabled */
  deadLetterQueue?: boolean;
  /** Max retry attempts */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

export interface EventBusDriver {
  publish<T>(channel: string, event: EventMessage<T>): Promise<void>;
  subscribe<T>(channel: string, handler: EventHandler<T>): Promise<() => void>;
  unsubscribe(channel: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * In-memory Event Bus Driver (for development/single instance)
 */
export class MemoryEventBusDriver implements EventBusDriver {
  private handlers = new Map<string, Set<EventHandler>>();

  async publish<T>(channel: string, event: EventMessage<T>): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error(`[EventBus] Handler error on ${channel}:`, error);
        }
      }
    }
  }

  async subscribe<T>(channel: string, handler: EventHandler<T>): Promise<() => void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(channel)?.delete(handler as EventHandler);
    };
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}

/**
 * Redis Event Bus Driver (for distributed systems)
 */
export class RedisEventBusDriver implements EventBusDriver {
  private redis: any;
  private subscriber: any;
  private handlers = new Map<string, Set<EventHandler>>();

  constructor(redisClient: any) {
    this.redis = redisClient;
    this.subscriber = redisClient.duplicate();
  }

  async publish<T>(channel: string, event: EventMessage<T>): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(event));
  }

  async subscribe<T>(channel: string, handler: EventHandler<T>): Promise<() => void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      
      await this.subscriber.subscribe(channel, async (message: string) => {
        try {
          const event = JSON.parse(message) as EventMessage<T>;
          event.timestamp = new Date(event.timestamp);
          
          const handlers = this.handlers.get(channel);
          if (handlers) {
            for (const h of handlers) {
              await h(event);
            }
          }
        } catch (error) {
          console.error(`[EventBus] Error processing message on ${channel}:`, error);
        }
      });
    }

    this.handlers.get(channel)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(channel)?.delete(handler as EventHandler);
    };
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
    this.handlers.delete(channel);
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
    this.handlers.clear();
  }
}

/**
 * Enterprise Event Bus
 */
export class EventBus {
  private config: Required<EventBusConfig>;
  private driver: EventBusDriver;
  private unsubscribers = new Map<string, () => void>();

  constructor(driver: EventBusDriver, config: EventBusConfig = {}) {
    this.driver = driver;
    this.config = {
      serviceName: config.serviceName ?? 'unknown',
      prefix: config.prefix ?? 'events',
      deadLetterQueue: config.deadLetterQueue ?? true,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
  }

  /**
   * Publish an event
   */
  async publish<T>(eventType: string, payload: T, options?: {
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const event: EventMessage<T> = {
      id: crypto.randomUUID(),
      type: eventType,
      payload,
      timestamp: new Date(),
      source: this.config.serviceName,
      correlationId: options?.correlationId,
      metadata: options?.metadata,
    };

    const channel = this.getChannel(eventType);
    await this.driver.publish(channel, event);

    return event.id;
  }

  /**
   * Subscribe to an event type
   */
  async subscribe<T>(
    eventType: string,
    handler: (payload: T, event: EventMessage<T>) => Promise<void> | void
  ): Promise<void> {
    const channel = this.getChannel(eventType);
    
    const wrappedHandler: EventHandler<T> = async (event) => {
      try {
        await handler(event.payload, event);
      } catch (error) {
        console.error(`[EventBus] Error handling ${eventType}:`, error);
        
        if (this.config.deadLetterQueue) {
          await this.publishToDeadLetter(event, error);
        }
      }
    };

    const unsubscribe = await this.driver.subscribe(channel, wrappedHandler);
    this.unsubscribers.set(eventType, unsubscribe);
  }

  /**
   * Subscribe to multiple event types
   */
  async subscribeMultiple<T>(
    eventTypes: string[],
    handler: (payload: T, event: EventMessage<T>) => Promise<void> | void
  ): Promise<void> {
    for (const eventType of eventTypes) {
      await this.subscribe(eventType, handler);
    }
  }

  /**
   * Unsubscribe from an event type
   */
  async unsubscribe(eventType: string): Promise<void> {
    const unsubscribe = this.unsubscribers.get(eventType);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(eventType);
    }
    await this.driver.unsubscribe(this.getChannel(eventType));
  }

  /**
   * Request-reply pattern
   */
  async request<TReq, TRes>(
    eventType: string,
    payload: TReq,
    timeout: number = 30000
  ): Promise<TRes> {
    const correlationId = crypto.randomUUID();
    const replyChannel = `${this.config.prefix}.reply.${correlationId}`;

    return new Promise<TRes>(async (resolve, reject) => {
      const timer = setTimeout(() => {
        this.driver.unsubscribe(replyChannel);
        reject(new Error(`Request timeout for ${eventType}`));
      }, timeout);

      await this.driver.subscribe<TRes>(replyChannel, async (event) => {
        clearTimeout(timer);
        await this.driver.unsubscribe(replyChannel);
        resolve(event.payload);
      });

      await this.publish(eventType, payload, { correlationId });
    });
  }

  /**
   * Reply to a request
   */
  async reply<T>(originalEvent: EventMessage<unknown>, payload: T): Promise<void> {
    if (!originalEvent.correlationId) {
      throw new Error('Cannot reply: no correlationId in original event');
    }

    const replyChannel = `${this.config.prefix}.reply.${originalEvent.correlationId}`;
    await this.driver.publish(replyChannel, {
      id: crypto.randomUUID(),
      type: 'reply',
      payload,
      timestamp: new Date(),
      source: this.config.serviceName,
      correlationId: originalEvent.correlationId,
    });
  }

  /**
   * Publish to dead letter queue
   */
  private async publishToDeadLetter<T>(event: EventMessage<T>, error: unknown): Promise<void> {
    const dlqChannel = `${this.config.prefix}.dlq`;
    await this.driver.publish(dlqChannel, {
      id: crypto.randomUUID(),
      type: 'dlq',
      payload: {
        originalEvent: event,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      },
      timestamp: new Date(),
      source: this.config.serviceName,
    });
  }

  /**
   * Get channel name
   */
  private getChannel(eventType: string): string {
    return `${this.config.prefix}.${eventType}`;
  }

  /**
   * Close event bus
   */
  async close(): Promise<void> {
    for (const eventType of this.unsubscribers.keys()) {
      await this.unsubscribe(eventType);
    }
    await this.driver.close();
  }
}

// ============================================
// Decorators
// ============================================

const eventHandlers = new Map<string, { target: any; method: string }[]>();

/**
 * Subscribe decorator for event handlers
 */
export function Subscribe(eventType: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!eventHandlers.has(eventType)) {
      eventHandlers.set(eventType, []);
    }
    eventHandlers.get(eventType)!.push({ target, method: propertyKey });
    return descriptor;
  };
}

/**
 * Register decorated handlers with event bus
 */
export async function registerEventHandlers(eventBus: EventBus, handlers: object[]): Promise<void> {
  for (const handler of handlers) {
    for (const [eventType, methods] of eventHandlers) {
      for (const { target, method } of methods) {
        if (handler.constructor === target.constructor) {
          await eventBus.subscribe(eventType, (handler as any)[method].bind(handler));
        }
      }
    }
  }
}

// ============================================
// Factory Functions
// ============================================

let defaultEventBus: EventBus | null = null;

export function initEventBus(driver: EventBusDriver, config?: EventBusConfig): EventBus {
  defaultEventBus = new EventBus(driver, config);
  return defaultEventBus;
}

export function eventBus(): EventBus {
  if (!defaultEventBus) {
    defaultEventBus = new EventBus(new MemoryEventBusDriver());
  }
  return defaultEventBus;
}

export function createEventBus(driver: EventBusDriver, config?: EventBusConfig): EventBus {
  return new EventBus(driver, config);
}

export default EventBus;
