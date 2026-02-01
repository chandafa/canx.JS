/**
 * CanxJS Event System - Type-safe event emitter with async support
 */
export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;
export type EventUnsubscribe = () => void;
export declare class EventEmitter<Events extends Record<string, unknown> = Record<string, unknown>> {
    private listeners;
    private wildcardListeners;
    private maxListeners;
    /**
     * Set maximum number of listeners per event
     */
    setMaxListeners(n: number): this;
    /**
     * Subscribe to an event
     */
    on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>, options?: {
        priority?: number;
    }): EventUnsubscribe;
    /**
     * Subscribe to an event (once)
     */
    once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>, options?: {
        priority?: number;
    }): EventUnsubscribe;
    /**
     * Subscribe to all events
     */
    onAny(handler: EventHandler<{
        event: string;
        payload: unknown;
    }>): EventUnsubscribe;
    /**
     * Unsubscribe from an event
     */
    off<K extends keyof Events>(event: K, handler?: EventHandler<Events[K]>): this;
    /**
     * Remove all listeners
     */
    removeAllListeners(event?: keyof Events): this;
    /**
     * Emit an event synchronously
     */
    emit<K extends keyof Events>(event: K, payload: Events[K]): boolean;
    /**
     * Emit an event asynchronously (waits for all handlers)
     */
    emitAsync<K extends keyof Events>(event: K, payload: Events[K]): Promise<boolean>;
    /**
     * Emit event in parallel (doesn't wait for handlers)
     */
    emitParallel<K extends keyof Events>(event: K, payload: Events[K]): void;
    /**
     * Get listener count for an event
     */
    listenerCount(event?: keyof Events): number;
    /**
     * Get all registered event names
     */
    eventNames(): (keyof Events)[];
    private addSubscription;
}
interface EventMetadata {
    event: string;
    method: string;
    priority?: number;
}
export declare function Listen(event: string, options?: {
    priority?: number;
}): MethodDecorator;
export declare function getEventListeners(target: object): EventMetadata[];
export declare class EventServiceProvider {
    private emitter;
    private subscribers;
    constructor(emitter: EventEmitter);
    /**
     * Register a subscriber class
     */
    subscribe(subscriber: object): void;
    /**
     * Unregister a subscriber
     */
    unsubscribe(subscriber: object): void;
}
export declare const events: EventEmitter<Record<string, unknown>>;
export declare function createEventEmitter<T extends Record<string, unknown>>(): EventEmitter<T>;
export default events;
