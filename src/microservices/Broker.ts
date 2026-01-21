/**
 * CanxJS Message Broker
 * Pub/Sub messaging with topics and queues
 */

// ============================================
// Types
// ============================================

export interface BrokerOptions {
  maxRetries?: number;
  retryDelay?: number;
  persistence?: boolean;
}

export interface Subscription {
  id: string;
  topic: string;
  handler: MessageHandler;
  options?: SubscriptionOptions;
}

export interface SubscriptionOptions {
  group?: string; // Consumer group for load balancing
  autoAck?: boolean;
  maxConcurrency?: number;
}

export interface PublishOptions {
  priority?: number;
  delay?: number;
  ttl?: number; // Time to live in ms
  headers?: Record<string, string>;
}

export type MessageHandler<T = unknown> = (message: BrokerMessage<T>) => void | Promise<void>;

export interface BrokerMessage<T = unknown> {
  id: string;
  topic: string;
  data: T;
  timestamp: number;
  headers?: Record<string, string>;
  ack: () => void;
  nack: () => void;
}

// ============================================
// Message Broker
// ============================================

export class MessageBroker {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private messageQueue: Map<string, BrokerMessage[]> = new Map();
  private options: Required<BrokerOptions>;

  constructor(options: BrokerOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      persistence: options.persistence ?? false,
    };
  }

  /**
   * Subscribe to a topic
   */
  subscribe<T>(
    topic: string,
    handler: MessageHandler<T>,
    options?: SubscriptionOptions
  ): string {
    const subscription: Subscription = {
      id: this.generateId(),
      topic,
      handler: handler as MessageHandler,
      options,
    };

    const existing = this.subscriptions.get(topic) || [];
    existing.push(subscription);
    this.subscriptions.set(topic, existing);

    // Process any queued messages
    this.processQueue(topic);

    return subscription.id;
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [topic, subs] of this.subscriptions) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(topic);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Publish a message to a topic
   */
  async publish<T>(
    topic: string,
    data: T,
    options?: PublishOptions
  ): Promise<void> {
    const message: BrokerMessage<T> = {
      id: this.generateId(),
      topic,
      data,
      timestamp: Date.now(),
      headers: options?.headers,
      ack: () => {},
      nack: () => {},
    };

    // Handle delay
    if (options?.delay && options.delay > 0) {
      setTimeout(() => this.deliverMessage(message), options.delay);
    } else {
      await this.deliverMessage(message);
    }
  }

  /**
   * Broadcast to all subscribers (fanout)
   */
  async broadcast<T>(topic: string, data: T, options?: PublishOptions): Promise<number> {
    const subscribers = this.subscriptions.get(topic) || [];
    
    const message: BrokerMessage<T> = {
      id: this.generateId(),
      topic,
      data,
      timestamp: Date.now(),
      headers: options?.headers,
      ack: () => {},
      nack: () => {},
    };

    const deliveryPromises = subscribers.map(sub => 
      this.executeHandler(sub, message)
    );

    await Promise.allSettled(deliveryPromises);
    return subscribers.length;
  }

  /**
   * Request/Reply pattern
   */
  async request<T, R>(
    topic: string,
    data: T,
    timeout: number = 5000
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const replyTopic = `reply:${this.generateId()}`;
      let resolved = false;

      // Set up reply handler
      const subId = this.subscribe<R>(replyTopic, (message) => {
        if (!resolved) {
          resolved = true;
          this.unsubscribe(subId);
          resolve(message.data);
        }
      });

      // Set up timeout
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.unsubscribe(subId);
          reject(new Error(`Request timeout for topic: ${topic}`));
        }
      }, timeout);

      // Publish request with reply topic in headers
      this.publish(topic, data, {
        headers: { replyTo: replyTopic },
      }).catch(error => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.unsubscribe(subId);
          reject(error);
        }
      });
    });
  }

  /**
   * Reply to a request
   */
  async reply<T>(replyTo: string, data: T): Promise<void> {
    await this.publish(replyTo, data);
  }

  /**
   * Get subscriber count for a topic
   */
  getSubscriberCount(topic: string): number {
    return (this.subscriptions.get(topic) || []).length;
  }

  /**
   * Get all topics
   */
  getTopics(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.messageQueue.clear();
  }

  /**
   * Deliver message to subscribers
   */
  private async deliverMessage<T>(message: BrokerMessage<T>): Promise<void> {
    const subscribers = this.subscriptions.get(message.topic) || [];

    if (subscribers.length === 0) {
      // Queue message if persistence is enabled
      if (this.options.persistence) {
        const queue = this.messageQueue.get(message.topic) || [];
        queue.push(message as BrokerMessage);
        this.messageQueue.set(message.topic, queue);
      }
      return;
    }

    // Load balance across consumer groups or deliver to first subscriber
    const groups = new Map<string, Subscription[]>();
    const ungrouped: Subscription[] = [];

    for (const sub of subscribers) {
      if (sub.options?.group) {
        const group = groups.get(sub.options.group) || [];
        group.push(sub);
        groups.set(sub.options.group, group);
      } else {
        ungrouped.push(sub);
      }
    }

    // For groups, pick one subscriber per group (round-robin could be added)
    const targetSubs: Subscription[] = [];
    for (const [, groupSubs] of groups) {
      const index = Math.floor(Math.random() * groupSubs.length);
      targetSubs.push(groupSubs[index]);
    }
    targetSubs.push(...ungrouped);

    // Execute handlers
    for (const sub of targetSubs) {
      await this.executeHandler(sub, message);
    }
  }

  /**
   * Execute a handler with error handling
   */
  private async executeHandler<T>(
    subscription: Subscription,
    message: BrokerMessage<T>
  ): Promise<void> {
    let acknowledged = false;
    let attempts = 0;

    const wrappedMessage: BrokerMessage<T> = {
      ...message,
      ack: () => { acknowledged = true; },
      nack: () => { acknowledged = false; },
    };

    while (attempts < this.options.maxRetries) {
      try {
        await subscription.handler(wrappedMessage);
        
        // Auto-ack if option is enabled and not manually nack'd
        if (subscription.options?.autoAck !== false && !acknowledged) {
          acknowledged = true;
        }
        
        if (acknowledged) break;
      } catch (error) {
        attempts++;
        if (attempts < this.options.maxRetries) {
          await this.delay(this.options.retryDelay);
        }
      }
    }
  }

  /**
   * Process queued messages for a topic
   */
  private async processQueue(topic: string): Promise<void> {
    const queue = this.messageQueue.get(topic);
    if (!queue || queue.length === 0) return;

    const messages = queue.splice(0, queue.length);
    for (const message of messages) {
      await this.deliverMessage(message);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Topic Exchange (for pattern matching)
// ============================================

export class TopicExchange {
  private broker: MessageBroker;
  private patterns: Map<string, RegExp> = new Map();

  constructor(broker?: MessageBroker) {
    this.broker = broker || new MessageBroker();
  }

  /**
   * Subscribe with wildcard pattern
   * Supports: * (single word), # (multiple words)
   */
  subscribe<T>(
    pattern: string,
    handler: MessageHandler<T>
  ): string {
    const regex = this.patternToRegex(pattern);
    const id = `pattern:${Date.now()}`;
    this.patterns.set(id, regex);
    
    // Internal subscription to capture all messages
    return this.broker.subscribe<T>('__all__', (message) => {
      if (regex.test(message.topic)) {
        handler(message);
      }
    });
  }

  /**
   * Publish to a topic
   */
  async publish<T>(topic: string, data: T, options?: PublishOptions): Promise<void> {
    // Also publish to __all__ for pattern matching
    await this.broker.publish('__all__', { topic, data } as any, options);
    await this.broker.publish(topic, data, options);
  }

  /**
   * Convert pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^.]+')
      .replace(/#/g, '.*');
    return new RegExp(`^${escaped}$`);
  }
}

// ============================================
// Factory
// ============================================

let defaultBroker: MessageBroker | null = null;

/**
 * Get or create default broker
 */
export function broker(): MessageBroker {
  if (!defaultBroker) {
    defaultBroker = new MessageBroker();
  }
  return defaultBroker;
}

/**
 * Create new broker instance
 */
export function createBroker(options?: BrokerOptions): MessageBroker {
  return new MessageBroker(options);
}

export default MessageBroker;
