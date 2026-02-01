/**
 * CanxJS Debug Watcher
 * Captures requests, queries, logs, and exceptions for debugging.
 */

export interface DebugEntry {
  id: string;
  type: 'request' | 'query' | 'log' | 'exception' | 'event';
  timestamp: number;
  data: Record<string, unknown>;
}

export class DebugWatcher {
  private entries: DebugEntry[] = [];
  private limit: number = 100;
  private enabled: boolean = false;

  constructor(limit = 100) {
    this.limit = limit;
    this.enabled = process.env.NODE_ENV !== 'production';
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * Record a debug entry
   */
  record(type: DebugEntry['type'], data: Record<string, unknown>): void {
    if (!this.enabled) return;

    const entry: DebugEntry = {
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      data,
    };

    this.entries.unshift(entry);

    if (this.entries.length > this.limit) {
      this.entries.pop();
    }
  }

  /**
   * Get all entries
   */
  getEntries(type?: DebugEntry['type']): DebugEntry[] {
    if (type) {
      return this.entries.filter(e => e.type === type);
    }
    return this.entries;
  }

  /**
   * Clear entries
   */
  clear(): void {
    this.entries = [];
  }
}

export const debugWatcher = new DebugWatcher();
export default debugWatcher;
