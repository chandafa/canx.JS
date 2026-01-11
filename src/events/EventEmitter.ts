/**
 * CanxJS Event System - Type-safe event emitter with async support
 */

// ============================================
// Types
// ============================================

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;
export type EventUnsubscribe = () => void;

interface EventSubscription<T = unknown> {
  handler: EventHandler<T>;
  once: boolean;
  priority: number;
}

// ============================================
// Event Emitter Class
// ============================================

export class EventEmitter<Events extends Record<string, unknown> = Record<string, unknown>> {
  private listeners: Map<keyof Events, EventSubscription[]> = new Map();
  private wildcardListeners: EventSubscription[] = [];
  private maxListeners: number = 100;

  /**
   * Set maximum number of listeners per event
   */
  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }

  /**
   * Subscribe to an event
   */
  on<K extends keyof Events>(
    event: K,
    handler: EventHandler<Events[K]>,
    options: { priority?: number } = {}
  ): EventUnsubscribe {
    const subscription: EventSubscription<Events[K]> = {
      handler,
      once: false,
      priority: options.priority || 0,
    };

    this.addSubscription(event, subscription as EventSubscription);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event (once)
   */
  once<K extends keyof Events>(
    event: K,
    handler: EventHandler<Events[K]>,
    options: { priority?: number } = {}
  ): EventUnsubscribe {
    const subscription: EventSubscription<Events[K]> = {
      handler,
      once: true,
      priority: options.priority || 0,
    };

    this.addSubscription(event, subscription as EventSubscription);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: EventHandler<{ event: string; payload: unknown }>): EventUnsubscribe {
    const subscription: EventSubscription = {
      handler: handler as EventHandler,
      once: false,
      priority: 0,
    };
    this.wildcardListeners.push(subscription);
    return () => {
      const idx = this.wildcardListeners.indexOf(subscription);
      if (idx > -1) this.wildcardListeners.splice(idx, 1);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof Events>(event: K, handler?: EventHandler<Events[K]>): this {
    if (!handler) {
      this.listeners.delete(event);
      return this;
    }

    const subs = this.listeners.get(event);
    if (subs) {
      const idx = subs.findIndex(s => s.handler === handler);
      if (idx > -1) subs.splice(idx, 1);
      if (subs.length === 0) this.listeners.delete(event);
    }
    return this;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: keyof Events): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.wildcardListeners = [];
    }
    return this;
  }

  /**
   * Emit an event synchronously
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): boolean {
    const subs = this.listeners.get(event) || [];
    const toRemove: EventSubscription[] = [];

    // Sort by priority (higher first)
    const sorted = [...subs].sort((a, b) => b.priority - a.priority);

    for (const sub of sorted) {
      try {
        sub.handler(payload);
        if (sub.once) toRemove.push(sub);
      } catch (error) {
        console.error(`[Event] Error in handler for "${String(event)}":`, error);
      }
    }

    // Notify wildcard listeners
    for (const sub of this.wildcardListeners) {
      try {
        sub.handler({ event: String(event), payload });
      } catch (error) {
        console.error(`[Event] Error in wildcard handler:`, error);
      }
    }

    // Remove once listeners
    for (const sub of toRemove) {
      const idx = subs.indexOf(sub);
      if (idx > -1) subs.splice(idx, 1);
    }

    return sorted.length > 0;
  }

  /**
   * Emit an event asynchronously (waits for all handlers)
   */
  async emitAsync<K extends keyof Events>(event: K, payload: Events[K]): Promise<boolean> {
    const subs = this.listeners.get(event) || [];
    const toRemove: EventSubscription[] = [];

    const sorted = [...subs].sort((a, b) => b.priority - a.priority);

    for (const sub of sorted) {
      try {
        await sub.handler(payload);
        if (sub.once) toRemove.push(sub);
      } catch (error) {
        console.error(`[Event] Error in async handler for "${String(event)}":`, error);
      }
    }

    // Notify wildcard listeners
    for (const sub of this.wildcardListeners) {
      try {
        await sub.handler({ event: String(event), payload });
      } catch (error) {
        console.error(`[Event] Error in wildcard handler:`, error);
      }
    }

    for (const sub of toRemove) {
      const idx = subs.indexOf(sub);
      if (idx > -1) subs.splice(idx, 1);
    }

    return sorted.length > 0;
  }

  /**
   * Emit event in parallel (doesn't wait for handlers)
   */
  emitParallel<K extends keyof Events>(event: K, payload: Events[K]): void {
    const subs = this.listeners.get(event) || [];

    for (const sub of subs) {
      Promise.resolve(sub.handler(payload)).catch(error => {
        console.error(`[Event] Error in parallel handler for "${String(event)}":`, error);
      });

      if (sub.once) {
        const idx = subs.indexOf(sub);
        if (idx > -1) subs.splice(idx, 1);
      }
    }

    for (const sub of this.wildcardListeners) {
      Promise.resolve(sub.handler({ event: String(event), payload })).catch(error => {
        console.error(`[Event] Error in wildcard handler:`, error);
      });
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event?: keyof Events): number {
    if (event) {
      return this.listeners.get(event)?.length || 0;
    }
    let count = 0;
    for (const subs of this.listeners.values()) {
      count += subs.length;
    }
    return count + this.wildcardListeners.length;
  }

  /**
   * Get all registered event names
   */
  eventNames(): (keyof Events)[] {
    return Array.from(this.listeners.keys());
  }

  private addSubscription(event: keyof Events, subscription: EventSubscription): void {
    let subs = this.listeners.get(event);
    if (!subs) {
      subs = [];
      this.listeners.set(event, subs);
    }

    if (subs.length >= this.maxListeners) {
      console.warn(
        `[Event] Warning: Event "${String(event)}" has ${subs.length} listeners. ` +
        `Consider increasing maxListeners or removing unused listeners.`
      );
    }

    subs.push(subscription);
  }
}

// ============================================
// Event Decorators
// ============================================

interface EventMetadata {
  event: string;
  method: string;
  priority?: number;
}

// Use WeakMap instead of Reflect.metadata for broader compatibility
const eventMetadataStore = new WeakMap<object, EventMetadata[]>();

export function Listen(event: string, options: { priority?: number } = {}): MethodDecorator {
  return (target, propertyKey) => {
    const constructor = target.constructor;
    const metadata: EventMetadata[] = eventMetadataStore.get(constructor) || [];
    metadata.push({
      event,
      method: String(propertyKey),
      priority: options.priority,
    });
    eventMetadataStore.set(constructor, metadata);
  };
}

export function getEventListeners(target: object): EventMetadata[] {
  return eventMetadataStore.get(target.constructor) || [];
}

// ============================================
// Event Service Provider
// ============================================

export class EventServiceProvider {
  private emitter: EventEmitter;
  private subscribers: Map<string, object[]> = new Map();

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
  }

  /**
   * Register a subscriber class
   */
  subscribe(subscriber: object): void {
    const listeners = getEventListeners(subscriber);
    
    for (const meta of listeners) {
      const handler = (subscriber as any)[meta.method].bind(subscriber);
      this.emitter.on(meta.event as any, handler, { priority: meta.priority });
      
      const subs = this.subscribers.get(meta.event) || [];
      subs.push(subscriber);
      this.subscribers.set(meta.event, subs);
    }
  }

  /**
   * Unregister a subscriber
   */
  unsubscribe(subscriber: object): void {
    const listeners = getEventListeners(subscriber);
    
    for (const meta of listeners) {
      this.emitter.off(meta.event as any);
    }
  }
}

// ============================================
// Singleton & Exports
// ============================================

export const events = new EventEmitter();

export function createEventEmitter<T extends Record<string, unknown>>(): EventEmitter<T> {
  return new EventEmitter<T>();
}

export default events;
