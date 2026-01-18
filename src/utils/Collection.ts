/**
 * CanxJS Collection - Fluent data manipulation
 * Laravel-compatible collection with TypeScript improvements
 */

// ============================================
// Collection Class
// ============================================

export class Collection<T = unknown> {
  private items: T[];

  constructor(items: T[] = []) {
    this.items = [...items];
  }

  // ============================================
  // Creation Methods
  // ============================================

  /**
   * Create a new collection
   */
  static make<U>(items: U[] = []): Collection<U> {
    return new Collection(items);
  }

  /**
   * Create collection from a range of numbers
   */
  static range(start: number, end: number): Collection<number> {
    const items: number[] = [];
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    return new Collection(items);
  }

  /**
   * Create collection with N items
   */
  static times<U>(n: number, callback: (index: number) => U): Collection<U> {
    const items: U[] = [];
    for (let i = 0; i < n; i++) {
      items.push(callback(i));
    }
    return new Collection(items);
  }

  // ============================================
  // Transformation Methods
  // ============================================

  /**
   * Map over items
   */
  map<U>(callback: (item: T, index: number) => U): Collection<U> {
    return new Collection(this.items.map(callback));
  }

  /**
   * Filter items
   */
  filter(callback: (item: T, index: number) => boolean): Collection<T> {
    return new Collection(this.items.filter(callback));
  }

  /**
   * Reject items (opposite of filter)
   */
  reject(callback: (item: T, index: number) => boolean): Collection<T> {
    return this.filter((item, index) => !callback(item, index));
  }

  /**
   * Reduce items to a single value
   */
  reduce<U>(callback: (acc: U, item: T, index: number) => U, initial: U): U {
    return this.items.reduce(callback, initial);
  }

  /**
   * Flatten nested arrays
   */
  flatten<U = T>(): Collection<U> {
    return new Collection(this.items.flat() as U[]);
  }

  /**
   * Flatten and map
   */
  flatMap<U>(callback: (item: T, index: number) => U[]): Collection<U> {
    return new Collection(this.items.flatMap(callback));
  }

  /**
   * Get unique items
   */
  unique(key?: keyof T | ((item: T) => unknown)): Collection<T> {
    if (!key) {
      return new Collection([...new Set(this.items)]);
    }
    
    const seen = new Set();
    return this.filter(item => {
      const value = typeof key === 'function' ? key(item) : item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  /**
   * Sort items
   */
  sort(compareFn?: (a: T, b: T) => number): Collection<T> {
    return new Collection([...this.items].sort(compareFn));
  }

  /**
   * Sort by key
   */
  sortBy(key: keyof T, direction: 'asc' | 'desc' = 'asc'): Collection<T> {
    return this.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === 'asc' ? result : -result;
    });
  }

  /**
   * Reverse items
   */
  reverse(): Collection<T> {
    return new Collection([...this.items].reverse());
  }

  /**
   * Group items by key
   */
  groupBy<K extends string | number>(key: keyof T | ((item: T) => K)): Map<K, T[]> {
    const groups = new Map<K, T[]>();
    
    this.items.forEach(item => {
      const groupKey = (typeof key === 'function' ? key(item) : item[key]) as K;
      const group = groups.get(groupKey) || [];
      group.push(item);
      groups.set(groupKey, group);
    });
    
    return groups;
  }

  /**
   * Key by
   */
  keyBy<K extends string | number>(key: keyof T | ((item: T) => K)): Map<K, T> {
    const result = new Map<K, T>();
    
    this.items.forEach(item => {
      const mapKey = (typeof key === 'function' ? key(item) : item[key]) as K;
      result.set(mapKey, item);
    });
    
    return result;
  }

  /**
   * Pluck a specific key
   */
  pluck<K extends keyof T>(key: K): Collection<T[K]> {
    return new Collection(this.items.map(item => item[key]));
  }

  /**
   * Chunk into smaller collections
   */
  chunk(size: number): Collection<T[]> {
    const chunks: T[][] = [];
    for (let i = 0; i < this.items.length; i += size) {
      chunks.push(this.items.slice(i, i + size));
    }
    return new Collection(chunks);
  }

  /**
   * Take first N items
   */
  take(count: number): Collection<T> {
    return new Collection(this.items.slice(0, count));
  }

  /**
   * Skip first N items
   */
  skip(count: number): Collection<T> {
    return new Collection(this.items.slice(count));
  }

  /**
   * Take while condition is true
   */
  takeWhile(callback: (item: T) => boolean): Collection<T> {
    const result: T[] = [];
    for (const item of this.items) {
      if (!callback(item)) break;
      result.push(item);
    }
    return new Collection(result);
  }

  /**
   * Skip while condition is true
   */
  skipWhile(callback: (item: T) => boolean): Collection<T> {
    let skipping = true;
    return this.filter(item => {
      if (skipping && callback(item)) return false;
      skipping = false;
      return true;
    });
  }

  // ============================================
  // Aggregation Methods
  // ============================================

  /**
   * Get count
   */
  count(): number {
    return this.items.length;
  }

  /**
   * Get sum
   */
  sum(key?: keyof T): number {
    if (key) {
      return this.items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
    }
    return this.items.reduce((sum, item) => sum + (Number(item) || 0), 0);
  }

  /**
   * Get average
   */
  avg(key?: keyof T): number {
    if (this.items.length === 0) return 0;
    return this.sum(key) / this.items.length;
  }

  /**
   * Get min value
   */
  min(key?: keyof T): T | number | undefined {
    if (this.items.length === 0) return undefined;
    
    if (key) {
      return this.items.reduce((min, item) => 
        (item[key] as number) < (min[key] as number) ? item : min
      );
    }
    return Math.min(...(this.items as number[]));
  }

  /**
   * Get max value
   */
  max(key?: keyof T): T | number | undefined {
    if (this.items.length === 0) return undefined;
    
    if (key) {
      return this.items.reduce((max, item) => 
        (item[key] as number) > (max[key] as number) ? item : max
      );
    }
    return Math.max(...(this.items as number[]));
  }

  // ============================================
  // Retrieval Methods
  // ============================================

  /**
   * Get first item
   */
  first(): T | undefined {
    return this.items[0];
  }

  /**
   * Get last item
   */
  last(): T | undefined {
    return this.items[this.items.length - 1];
  }

  /**
   * Get item at index
   */
  get(index: number): T | undefined {
    return this.items[index];
  }

  /**
   * Get nth item (1-indexed)
   */
  nth(n: number): T | undefined {
    return this.items[n - 1];
  }

  /**
   * Find item
   */
  find(callback: (item: T, index: number) => boolean): T | undefined {
    return this.items.find(callback);
  }

  /**
   * Find index
   */
  findIndex(callback: (item: T, index: number) => boolean): number {
    return this.items.findIndex(callback);
  }

  /**
   * Get random item
   */
  random(): T | undefined {
    if (this.items.length === 0) return undefined;
    return this.items[Math.floor(Math.random() * this.items.length)];
  }

  /**
   * Shuffle items
   */
  shuffle(): Collection<T> {
    const shuffled = [...this.items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return new Collection(shuffled);
  }

  // ============================================
  // Boolean Methods
  // ============================================

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Check if not empty
   */
  isNotEmpty(): boolean {
    return this.items.length > 0;
  }

  /**
   * Check if contains item
   */
  contains(item: T): boolean {
    return this.items.includes(item);
  }

  /**
   * Check if every item passes test
   */
  every(callback: (item: T, index: number) => boolean): boolean {
    return this.items.every(callback);
  }

  /**
   * Check if some items pass test
   */
  some(callback: (item: T, index: number) => boolean): boolean {
    return this.items.some(callback);
  }

  // ============================================
  // Combination Methods
  // ============================================

  /**
   * Merge with another array/collection
   */
  merge(items: T[] | Collection<T>): Collection<T> {
    const other = items instanceof Collection ? items.all() : items;
    return new Collection([...this.items, ...other]);
  }

  /**
   * Concatenate
   */
  concat(...items: (T | T[] | Collection<T>)[]): Collection<T> {
    let result = [...this.items];
    
    items.forEach(item => {
      if (item instanceof Collection) {
        result = result.concat(item.all());
      } else if (Array.isArray(item)) {
        result = result.concat(item);
      } else {
        result.push(item);
      }
    });
    
    return new Collection(result);
  }

  /**
   * Zip with another array
   */
  zip<U>(other: U[]): Collection<[T, U]> {
    const length = Math.min(this.items.length, other.length);
    const result: [T, U][] = [];
    
    for (let i = 0; i < length; i++) {
      result.push([this.items[i], other[i]]);
    }
    
    return new Collection(result);
  }

  /**
   * Get the difference
   */
  diff(other: T[] | Collection<T>): Collection<T> {
    const otherItems = other instanceof Collection ? other.all() : other;
    return this.filter(item => !otherItems.includes(item));
  }

  /**
   * Get the intersection
   */
  intersect(other: T[] | Collection<T>): Collection<T> {
    const otherItems = other instanceof Collection ? other.all() : other;
    return this.filter(item => otherItems.includes(item));
  }

  // ============================================
  // Conversion Methods
  // ============================================

  /**
   * Get all items as array
   */
  all(): T[] {
    return [...this.items];
  }

  /**
   * Convert to array
   */
  toArray(): T[] {
    return this.all();
  }

  /**
   * Convert to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.items);
  }

  /**
   * Join items
   */
  join(separator: string = ', '): string {
    return this.items.map(String).join(separator);
  }

  /**
   * Implode with key
   */
  implode(key: keyof T, separator: string = ', '): string {
    return this.pluck(key).join(separator);
  }

  // ============================================
  // Iteration Methods
  // ============================================

  /**
   * Iterate over items
   */
  each(callback: (item: T, index: number) => void): this {
    this.items.forEach(callback);
    return this;
  }

  /**
   * Tap into the collection (for debugging)
   */
  tap(callback: (collection: Collection<T>) => void): this {
    callback(this);
    return this;
  }

  /**
   * Pipe through a callback
   */
  pipe<U>(callback: (collection: Collection<T>) => U): U {
    return callback(this);
  }

  /**
   * Make collection iterable
   */
  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  // ============================================
  // Modification Methods (returns new collection)
  // ============================================

  /**
   * Push item
   */
  push(...items: T[]): Collection<T> {
    return new Collection([...this.items, ...items]);
  }

  /**
   * Prepend item
   */
  prepend(...items: T[]): Collection<T> {
    return new Collection([...items, ...this.items]);
  }

  /**
   * Pop last item
   */
  pop(): { item: T | undefined; collection: Collection<T> } {
    const items = [...this.items];
    const item = items.pop();
    return { item, collection: new Collection(items) };
  }

  /**
   * Shift first item
   */
  shift(): { item: T | undefined; collection: Collection<T> } {
    const items = [...this.items];
    const item = items.shift();
    return { item, collection: new Collection(items) };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a new collection
 */
export function collect<T>(items: T[] = []): Collection<T> {
  return new Collection(items);
}

/**
 * Create range collection
 */
export function range(start: number, end: number): Collection<number> {
  return Collection.range(start, end);
}

/**
 * Create collection with N items
 */
export function times<T>(n: number, callback: (index: number) => T): Collection<T> {
  return Collection.times(n, callback);
}

export default Collection;
