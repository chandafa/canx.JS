"use strict";
/**
 * CanxJS Collection - Fluent data manipulation
 * Laravel-compatible collection with TypeScript improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
exports.collect = collect;
exports.range = range;
exports.times = times;
// ============================================
// Collection Class
// ============================================
class Collection {
    items;
    constructor(items = []) {
        this.items = [...items];
    }
    // ============================================
    // Creation Methods
    // ============================================
    /**
     * Create a new collection
     */
    static make(items = []) {
        return new Collection(items);
    }
    /**
     * Create collection from a range of numbers
     */
    static range(start, end) {
        const items = [];
        for (let i = start; i <= end; i++) {
            items.push(i);
        }
        return new Collection(items);
    }
    /**
     * Create collection with N items
     */
    static times(n, callback) {
        const items = [];
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
    map(callback) {
        return new Collection(this.items.map(callback));
    }
    /**
     * Filter items
     */
    filter(callback) {
        return new Collection(this.items.filter(callback));
    }
    /**
     * Reject items (opposite of filter)
     */
    reject(callback) {
        return this.filter((item, index) => !callback(item, index));
    }
    /**
     * Reduce items to a single value
     */
    reduce(callback, initial) {
        return this.items.reduce(callback, initial);
    }
    /**
     * Flatten nested arrays
     */
    flatten() {
        return new Collection(this.items.flat());
    }
    /**
     * Flatten and map
     */
    flatMap(callback) {
        return new Collection(this.items.flatMap(callback));
    }
    /**
     * Get unique items
     */
    unique(key) {
        if (!key) {
            return new Collection([...new Set(this.items)]);
        }
        const seen = new Set();
        return this.filter(item => {
            const value = typeof key === 'function' ? key(item) : item[key];
            if (seen.has(value))
                return false;
            seen.add(value);
            return true;
        });
    }
    /**
     * Sort items
     */
    sort(compareFn) {
        return new Collection([...this.items].sort(compareFn));
    }
    /**
     * Sort by key
     */
    sortBy(key, direction = 'asc') {
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
    reverse() {
        return new Collection([...this.items].reverse());
    }
    /**
     * Group items by key
     */
    groupBy(key) {
        const groups = new Map();
        this.items.forEach(item => {
            const groupKey = (typeof key === 'function' ? key(item) : item[key]);
            const group = groups.get(groupKey) || [];
            group.push(item);
            groups.set(groupKey, group);
        });
        return groups;
    }
    /**
     * Key by
     */
    keyBy(key) {
        const result = new Map();
        this.items.forEach(item => {
            const mapKey = (typeof key === 'function' ? key(item) : item[key]);
            result.set(mapKey, item);
        });
        return result;
    }
    /**
     * Pluck a specific key
     */
    pluck(key) {
        return new Collection(this.items.map(item => item[key]));
    }
    /**
     * Chunk into smaller collections
     */
    chunk(size) {
        const chunks = [];
        for (let i = 0; i < this.items.length; i += size) {
            chunks.push(this.items.slice(i, i + size));
        }
        return new Collection(chunks);
    }
    /**
     * Take first N items
     */
    take(count) {
        return new Collection(this.items.slice(0, count));
    }
    /**
     * Skip first N items
     */
    skip(count) {
        return new Collection(this.items.slice(count));
    }
    /**
     * Take while condition is true
     */
    takeWhile(callback) {
        const result = [];
        for (const item of this.items) {
            if (!callback(item))
                break;
            result.push(item);
        }
        return new Collection(result);
    }
    /**
     * Skip while condition is true
     */
    skipWhile(callback) {
        let skipping = true;
        return this.filter(item => {
            if (skipping && callback(item))
                return false;
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
    count() {
        return this.items.length;
    }
    /**
     * Get sum
     */
    sum(key) {
        if (key) {
            return this.items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
        }
        return this.items.reduce((sum, item) => sum + (Number(item) || 0), 0);
    }
    /**
     * Get average
     */
    avg(key) {
        if (this.items.length === 0)
            return 0;
        return this.sum(key) / this.items.length;
    }
    /**
     * Get min value
     */
    min(key) {
        if (this.items.length === 0)
            return undefined;
        if (key) {
            return this.items.reduce((min, item) => item[key] < min[key] ? item : min);
        }
        return Math.min(...this.items);
    }
    /**
     * Get max value
     */
    max(key) {
        if (this.items.length === 0)
            return undefined;
        if (key) {
            return this.items.reduce((max, item) => item[key] > max[key] ? item : max);
        }
        return Math.max(...this.items);
    }
    // ============================================
    // Retrieval Methods
    // ============================================
    /**
     * Get first item
     */
    first() {
        return this.items[0];
    }
    /**
     * Get last item
     */
    last() {
        return this.items[this.items.length - 1];
    }
    /**
     * Get item at index
     */
    get(index) {
        return this.items[index];
    }
    /**
     * Get nth item (1-indexed)
     */
    nth(n) {
        return this.items[n - 1];
    }
    /**
     * Find item
     */
    find(callback) {
        return this.items.find(callback);
    }
    /**
     * Find index
     */
    findIndex(callback) {
        return this.items.findIndex(callback);
    }
    /**
     * Get random item
     */
    random() {
        if (this.items.length === 0)
            return undefined;
        return this.items[Math.floor(Math.random() * this.items.length)];
    }
    /**
     * Shuffle items
     */
    shuffle() {
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
    isEmpty() {
        return this.items.length === 0;
    }
    /**
     * Check if not empty
     */
    isNotEmpty() {
        return this.items.length > 0;
    }
    /**
     * Check if contains item
     */
    contains(item) {
        return this.items.includes(item);
    }
    /**
     * Check if every item passes test
     */
    every(callback) {
        return this.items.every(callback);
    }
    /**
     * Check if some items pass test
     */
    some(callback) {
        return this.items.some(callback);
    }
    // ============================================
    // Combination Methods
    // ============================================
    /**
     * Merge with another array/collection
     */
    merge(items) {
        const other = items instanceof Collection ? items.all() : items;
        return new Collection([...this.items, ...other]);
    }
    /**
     * Concatenate
     */
    concat(...items) {
        let result = [...this.items];
        items.forEach(item => {
            if (item instanceof Collection) {
                result = result.concat(item.all());
            }
            else if (Array.isArray(item)) {
                result = result.concat(item);
            }
            else {
                result.push(item);
            }
        });
        return new Collection(result);
    }
    /**
     * Zip with another array
     */
    zip(other) {
        const length = Math.min(this.items.length, other.length);
        const result = [];
        for (let i = 0; i < length; i++) {
            result.push([this.items[i], other[i]]);
        }
        return new Collection(result);
    }
    /**
     * Get the difference
     */
    diff(other) {
        const otherItems = other instanceof Collection ? other.all() : other;
        return this.filter(item => !otherItems.includes(item));
    }
    /**
     * Get the intersection
     */
    intersect(other) {
        const otherItems = other instanceof Collection ? other.all() : other;
        return this.filter(item => otherItems.includes(item));
    }
    // ============================================
    // Conversion Methods
    // ============================================
    /**
     * Get all items as array
     */
    all() {
        return [...this.items];
    }
    /**
     * Convert to array
     */
    toArray() {
        return this.all();
    }
    /**
     * Convert to JSON string
     */
    toJSON() {
        return JSON.stringify(this.items);
    }
    /**
     * Join items
     */
    join(separator = ', ') {
        return this.items.map(String).join(separator);
    }
    /**
     * Implode with key
     */
    implode(key, separator = ', ') {
        return this.pluck(key).join(separator);
    }
    // ============================================
    // Iteration Methods
    // ============================================
    /**
     * Iterate over items
     */
    each(callback) {
        this.items.forEach(callback);
        return this;
    }
    /**
     * Tap into the collection (for debugging)
     */
    tap(callback) {
        callback(this);
        return this;
    }
    /**
     * Pipe through a callback
     */
    pipe(callback) {
        return callback(this);
    }
    /**
     * Make collection iterable
     */
    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
    // ============================================
    // Modification Methods (returns new collection)
    // ============================================
    /**
     * Push item
     */
    push(...items) {
        return new Collection([...this.items, ...items]);
    }
    /**
     * Prepend item
     */
    prepend(...items) {
        return new Collection([...items, ...this.items]);
    }
    /**
     * Pop last item
     */
    pop() {
        const items = [...this.items];
        const item = items.pop();
        return { item, collection: new Collection(items) };
    }
    /**
     * Shift first item
     */
    shift() {
        const items = [...this.items];
        const item = items.shift();
        return { item, collection: new Collection(items) };
    }
}
exports.Collection = Collection;
// ============================================
// Helper Functions
// ============================================
/**
 * Create a new collection
 */
function collect(items = []) {
    return new Collection(items);
}
/**
 * Create range collection
 */
function range(start, end) {
    return Collection.range(start, end);
}
/**
 * Create collection with N items
 */
function times(n, callback) {
    return Collection.times(n, callback);
}
exports.default = Collection;
