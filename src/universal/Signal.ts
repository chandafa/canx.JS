/**
 * CanxJS Universal Signals - Distributed State Management
 * @description "Zero-API" architecture for syncing state across server cluster and clients.
 */

import { eventBus } from '../microservices/EventBus';

export interface SignalOptions<T> {
  driver?: 'memory' | 'redis';
  persistence?: boolean;
  syncToClient?: boolean; // If true, changes are broadcast to connected WebSocket clients
}

export type SignalListener<T> = (newValue: T, oldValue: T) => void;

/**
 * Universal Signal
 * A distributed reactive primitive that synchronizes across the cluster.
 */
export class Signal<T> {
  private _value: T;
  private listeners = new Set<SignalListener<T>>();
  private cleanup?: () => void;

  constructor(
    public readonly key: string,
    initialValue: T,
    public readonly options: SignalOptions<T> = {}
  ) {
    this._value = initialValue;
    this.options.driver = options.driver ?? 'redis';
    
    this.init();
  }

  private async init() {
    // Determine channel name for this signal
    const channel = `signal:${this.key}`;

    // Subscribe to cluster updates via EventBus
    if (this.options.driver === 'redis') {
      try {
        const bus = eventBus();
        await bus.subscribe(channel, (payload: any) => {
          if (JSON.stringify(payload.value) !== JSON.stringify(this._value)) {
            this.localUpdate(payload.value);
          }
        });
        this.cleanup = () => {
          bus.unsubscribe(channel).catch(console.error);
        };
      } catch (e) {
        console.warn(`[Signal] Failed to subscribe to EventBus for ${this.key}`, e);
      }
    }
  }

  /**
   * Get current value (local cache)
   */
  get value(): T {
    return this._value;
  }

  /**
   * Set new value and propagate to cluster
   */
  async set(newValue: T): Promise<void> {
    if (JSON.stringify(newValue) === JSON.stringify(this._value)) return;

    const oldValue = this._value;
    this._value = newValue;

    // 1. Notify local listeners
    this.notifyListeners(newValue, oldValue);

    // 2. Propagate to Cluster (Redis)
    if (this.options.driver === 'redis') {
      try {
        const bus = eventBus();
        await bus.publish(`signal:${this.key}`, {
          key: this.key,
          value: newValue,
          timestamp: Date.now()
        });
      } catch (e) {
        console.error(`[Signal] Failed to publish update for ${this.key}`, e);
      }
    }

    // 3. Propagate to WebSocket Clients (Zero-API)
    if (this.options.syncToClient) {
      // Dynamic import to avoid circular dependency issues if any
      // but here we can just import, assuming build handles it.
      // For safety in this environment, using a global or direct import helper.
      const { broadcastSignalUpdate } = require('./SignalServer'); 
      broadcastSignalUpdate(this.key, newValue);
    }
  }

  /**
   * Update local value without propagating (used when receiving update from cluster)
   */
  private localUpdate(newValue: T): void {
    const oldValue = this._value;
    this._value = newValue;
    this.notifyListeners(newValue, oldValue);
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: SignalListener<T>): () => void {
    this.listeners.add(listener);
    // Call immediately with current value
    listener(this._value, this._value);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(newValue: T, oldValue: T): void {
    for (const listener of this.listeners) {
      try {
        listener(newValue, oldValue);
      } catch (e) {
        console.error(`[Signal] Listener error for ${this.key}`, e);
      }
    }
  }

  /**
   * Broadcast update to connected WebSocket clients
   * This bridges the backend state to frontend UI
   */
  private broadcastToClients(newValue: T): void {
    // In a real implementation, this would interface with the WebSocket Gateway
    // For now, we'll emit a system event that the Gateway can listen to
    /*
    const gateway = global.webSocketGateway;
    if (gateway) {
      gateway.broadcast(`signal:${this.key}`, newValue);
    }
    */
   // Placeholder for WebSocket integration
  }

  /**
   * Dispose signal resources
   */
  dispose(): void {
    if (this.cleanup) {
      this.cleanup();
    }
    this.listeners.clear();
  }
}

/**
 * Factory for creating signals
 */
export function createSignal<T>(key: string, initialValue: T, options?: SignalOptions<T>): Signal<T> {
  return new Signal(key, initialValue, options);
}
