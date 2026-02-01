/**
 * CanxJS Signal Registry - Central management for Universal Signals
 */

import { Signal, SignalOptions } from './Signal';

export class SignalRegistry {
  private signals = new Map<string, Signal<any>>();

  /**
   * Get or Create a Signal
   */
  signal<T>(key: string, initialValue: T, options?: SignalOptions<T>): Signal<T> {
    if (this.signals.has(key)) {
      return this.signals.get(key) as Signal<T>;
    }

    const signal = new Signal<T>(key, initialValue, options);
    this.signals.set(key, signal);
    return signal;
  }

  /**
   * Get an existing signal
   */
  get<T>(key: string): Signal<T> | undefined {
    return this.signals.get(key) as Signal<T> | undefined;
  }

  /**
   * Remove a signal
   */
  remove(key: string): void {
    const signal = this.signals.get(key);
    if (signal) {
      signal.dispose();
      this.signals.delete(key);
    }
  }

  /**
   * Get all active signals (for debugging)
   */
  getAllKeys(): string[] {
    return Array.from(this.signals.keys());
  }
}

// Singleton
export const signalRegistry = new SignalRegistry();

/**
 * Helper to define a global signal
 */
export function useSignal<T>(key: string, initialValue: T, options?: SignalOptions<T>): Signal<T> {
  return signalRegistry.signal(key, initialValue, options);
}
