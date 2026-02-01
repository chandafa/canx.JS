"use strict";
/**
 * CanxJS Event System - Type-safe event emitter with async support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.events = exports.EventServiceProvider = exports.EventEmitter = void 0;
exports.Listen = Listen;
exports.getEventListeners = getEventListeners;
exports.createEventEmitter = createEventEmitter;
// ============================================
// Event Emitter Class
// ============================================
class EventEmitter {
    listeners = new Map();
    wildcardListeners = [];
    maxListeners = 100;
    /**
     * Set maximum number of listeners per event
     */
    setMaxListeners(n) {
        this.maxListeners = n;
        return this;
    }
    /**
     * Subscribe to an event
     */
    on(event, handler, options = {}) {
        const subscription = {
            handler,
            once: false,
            priority: options.priority || 0,
        };
        this.addSubscription(event, subscription);
        return () => this.off(event, handler);
    }
    /**
     * Subscribe to an event (once)
     */
    once(event, handler, options = {}) {
        const subscription = {
            handler,
            once: true,
            priority: options.priority || 0,
        };
        this.addSubscription(event, subscription);
        return () => this.off(event, handler);
    }
    /**
     * Subscribe to all events
     */
    onAny(handler) {
        const subscription = {
            handler: handler,
            once: false,
            priority: 0,
        };
        this.wildcardListeners.push(subscription);
        return () => {
            const idx = this.wildcardListeners.indexOf(subscription);
            if (idx > -1)
                this.wildcardListeners.splice(idx, 1);
        };
    }
    /**
     * Unsubscribe from an event
     */
    off(event, handler) {
        if (!handler) {
            this.listeners.delete(event);
            return this;
        }
        const subs = this.listeners.get(event);
        if (subs) {
            const idx = subs.findIndex(s => s.handler === handler);
            if (idx > -1)
                subs.splice(idx, 1);
            if (subs.length === 0)
                this.listeners.delete(event);
        }
        return this;
    }
    /**
     * Remove all listeners
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
            this.wildcardListeners = [];
        }
        return this;
    }
    /**
     * Emit an event synchronously
     */
    emit(event, payload) {
        const subs = this.listeners.get(event) || [];
        const toRemove = [];
        // Sort by priority (higher first)
        const sorted = [...subs].sort((a, b) => b.priority - a.priority);
        for (const sub of sorted) {
            try {
                sub.handler(payload);
                if (sub.once)
                    toRemove.push(sub);
            }
            catch (error) {
                console.error(`[Event] Error in handler for "${String(event)}":`, error);
            }
        }
        // Notify wildcard listeners
        for (const sub of this.wildcardListeners) {
            try {
                sub.handler({ event: String(event), payload });
            }
            catch (error) {
                console.error(`[Event] Error in wildcard handler:`, error);
            }
        }
        // Remove once listeners
        for (const sub of toRemove) {
            const idx = subs.indexOf(sub);
            if (idx > -1)
                subs.splice(idx, 1);
        }
        return sorted.length > 0;
    }
    /**
     * Emit an event asynchronously (waits for all handlers)
     */
    async emitAsync(event, payload) {
        const subs = this.listeners.get(event) || [];
        const toRemove = [];
        const sorted = [...subs].sort((a, b) => b.priority - a.priority);
        for (const sub of sorted) {
            try {
                await sub.handler(payload);
                if (sub.once)
                    toRemove.push(sub);
            }
            catch (error) {
                console.error(`[Event] Error in async handler for "${String(event)}":`, error);
            }
        }
        // Notify wildcard listeners
        for (const sub of this.wildcardListeners) {
            try {
                await sub.handler({ event: String(event), payload });
            }
            catch (error) {
                console.error(`[Event] Error in wildcard handler:`, error);
            }
        }
        for (const sub of toRemove) {
            const idx = subs.indexOf(sub);
            if (idx > -1)
                subs.splice(idx, 1);
        }
        return sorted.length > 0;
    }
    /**
     * Emit event in parallel (doesn't wait for handlers)
     */
    emitParallel(event, payload) {
        const subs = this.listeners.get(event) || [];
        for (const sub of subs) {
            Promise.resolve(sub.handler(payload)).catch(error => {
                console.error(`[Event] Error in parallel handler for "${String(event)}":`, error);
            });
            if (sub.once) {
                const idx = subs.indexOf(sub);
                if (idx > -1)
                    subs.splice(idx, 1);
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
    listenerCount(event) {
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
    eventNames() {
        return Array.from(this.listeners.keys());
    }
    addSubscription(event, subscription) {
        let subs = this.listeners.get(event);
        if (!subs) {
            subs = [];
            this.listeners.set(event, subs);
        }
        if (subs.length >= this.maxListeners) {
            console.warn(`[Event] Warning: Event "${String(event)}" has ${subs.length} listeners. ` +
                `Consider increasing maxListeners or removing unused listeners.`);
        }
        subs.push(subscription);
    }
}
exports.EventEmitter = EventEmitter;
// Use WeakMap instead of Reflect.metadata for broader compatibility
const eventMetadataStore = new WeakMap();
function Listen(event, options = {}) {
    return (target, propertyKey) => {
        const constructor = target.constructor;
        const metadata = eventMetadataStore.get(constructor) || [];
        metadata.push({
            event,
            method: String(propertyKey),
            priority: options.priority,
        });
        eventMetadataStore.set(constructor, metadata);
    };
}
function getEventListeners(target) {
    return eventMetadataStore.get(target.constructor) || [];
}
// ============================================
// Event Service Provider
// ============================================
class EventServiceProvider {
    emitter;
    subscribers = new Map();
    constructor(emitter) {
        this.emitter = emitter;
    }
    /**
     * Register a subscriber class
     */
    subscribe(subscriber) {
        const listeners = getEventListeners(subscriber);
        for (const meta of listeners) {
            const handler = subscriber[meta.method].bind(subscriber);
            this.emitter.on(meta.event, handler, { priority: meta.priority });
            const subs = this.subscribers.get(meta.event) || [];
            subs.push(subscriber);
            this.subscribers.set(meta.event, subs);
        }
    }
    /**
     * Unregister a subscriber
     */
    unsubscribe(subscriber) {
        const listeners = getEventListeners(subscriber);
        for (const meta of listeners) {
            this.emitter.off(meta.event);
        }
    }
}
exports.EventServiceProvider = EventServiceProvider;
// ============================================
// Singleton & Exports
// ============================================
exports.events = new EventEmitter();
function createEventEmitter() {
    return new EventEmitter();
}
exports.default = exports.events;
