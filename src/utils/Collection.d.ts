/**
 * CanxJS Collection - Fluent data manipulation
 * Laravel-compatible collection with TypeScript improvements
 */
export declare class Collection<T = unknown> {
    private items;
    constructor(items?: T[]);
    /**
     * Create a new collection
     */
    static make<U>(items?: U[]): Collection<U>;
    /**
     * Create collection from a range of numbers
     */
    static range(start: number, end: number): Collection<number>;
    /**
     * Create collection with N items
     */
    static times<U>(n: number, callback: (index: number) => U): Collection<U>;
    /**
     * Map over items
     */
    map<U>(callback: (item: T, index: number) => U): Collection<U>;
    /**
     * Filter items
     */
    filter(callback: (item: T, index: number) => boolean): Collection<T>;
    /**
     * Reject items (opposite of filter)
     */
    reject(callback: (item: T, index: number) => boolean): Collection<T>;
    /**
     * Reduce items to a single value
     */
    reduce<U>(callback: (acc: U, item: T, index: number) => U, initial: U): U;
    /**
     * Flatten nested arrays
     */
    flatten<U = T>(): Collection<U>;
    /**
     * Flatten and map
     */
    flatMap<U>(callback: (item: T, index: number) => U[]): Collection<U>;
    /**
     * Get unique items
     */
    unique(key?: keyof T | ((item: T) => unknown)): Collection<T>;
    /**
     * Sort items
     */
    sort(compareFn?: (a: T, b: T) => number): Collection<T>;
    /**
     * Sort by key
     */
    sortBy(key: keyof T, direction?: 'asc' | 'desc'): Collection<T>;
    /**
     * Reverse items
     */
    reverse(): Collection<T>;
    /**
     * Group items by key
     */
    groupBy<K extends string | number>(key: keyof T | ((item: T) => K)): Map<K, T[]>;
    /**
     * Key by
     */
    keyBy<K extends string | number>(key: keyof T | ((item: T) => K)): Map<K, T>;
    /**
     * Pluck a specific key
     */
    pluck<K extends keyof T>(key: K): Collection<T[K]>;
    /**
     * Chunk into smaller collections
     */
    chunk(size: number): Collection<T[]>;
    /**
     * Take first N items
     */
    take(count: number): Collection<T>;
    /**
     * Skip first N items
     */
    skip(count: number): Collection<T>;
    /**
     * Take while condition is true
     */
    takeWhile(callback: (item: T) => boolean): Collection<T>;
    /**
     * Skip while condition is true
     */
    skipWhile(callback: (item: T) => boolean): Collection<T>;
    /**
     * Get count
     */
    count(): number;
    /**
     * Get sum
     */
    sum(key?: keyof T): number;
    /**
     * Get average
     */
    avg(key?: keyof T): number;
    /**
     * Get min value
     */
    min(key?: keyof T): T | number | undefined;
    /**
     * Get max value
     */
    max(key?: keyof T): T | number | undefined;
    /**
     * Get first item
     */
    first(): T | undefined;
    /**
     * Get last item
     */
    last(): T | undefined;
    /**
     * Get item at index
     */
    get(index: number): T | undefined;
    /**
     * Get nth item (1-indexed)
     */
    nth(n: number): T | undefined;
    /**
     * Find item
     */
    find(callback: (item: T, index: number) => boolean): T | undefined;
    /**
     * Find index
     */
    findIndex(callback: (item: T, index: number) => boolean): number;
    /**
     * Get random item
     */
    random(): T | undefined;
    /**
     * Shuffle items
     */
    shuffle(): Collection<T>;
    /**
     * Check if empty
     */
    isEmpty(): boolean;
    /**
     * Check if not empty
     */
    isNotEmpty(): boolean;
    /**
     * Check if contains item
     */
    contains(item: T): boolean;
    /**
     * Check if every item passes test
     */
    every(callback: (item: T, index: number) => boolean): boolean;
    /**
     * Check if some items pass test
     */
    some(callback: (item: T, index: number) => boolean): boolean;
    /**
     * Merge with another array/collection
     */
    merge(items: T[] | Collection<T>): Collection<T>;
    /**
     * Concatenate
     */
    concat(...items: (T | T[] | Collection<T>)[]): Collection<T>;
    /**
     * Zip with another array
     */
    zip<U>(other: U[]): Collection<[T, U]>;
    /**
     * Get the difference
     */
    diff(other: T[] | Collection<T>): Collection<T>;
    /**
     * Get the intersection
     */
    intersect(other: T[] | Collection<T>): Collection<T>;
    /**
     * Get all items as array
     */
    all(): T[];
    /**
     * Convert to array
     */
    toArray(): T[];
    /**
     * Convert to JSON string
     */
    toJSON(): string;
    /**
     * Join items
     */
    join(separator?: string): string;
    /**
     * Implode with key
     */
    implode(key: keyof T, separator?: string): string;
    /**
     * Iterate over items
     */
    each(callback: (item: T, index: number) => void): this;
    /**
     * Tap into the collection (for debugging)
     */
    tap(callback: (collection: Collection<T>) => void): this;
    /**
     * Pipe through a callback
     */
    pipe<U>(callback: (collection: Collection<T>) => U): U;
    /**
     * Make collection iterable
     */
    [Symbol.iterator](): Iterator<T>;
    /**
     * Push item
     */
    push(...items: T[]): Collection<T>;
    /**
     * Prepend item
     */
    prepend(...items: T[]): Collection<T>;
    /**
     * Pop last item
     */
    pop(): {
        item: T | undefined;
        collection: Collection<T>;
    };
    /**
     * Shift first item
     */
    shift(): {
        item: T | undefined;
        collection: Collection<T>;
    };
}
/**
 * Create a new collection
 */
export declare function collect<T>(items?: T[]): Collection<T>;
/**
 * Create range collection
 */
export declare function range(start: number, end: number): Collection<number>;
/**
 * Create collection with N items
 */
export declare function times<T>(n: number, callback: (index: number) => T): Collection<T>;
export default Collection;
