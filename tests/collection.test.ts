import { describe, expect, test } from 'bun:test';
import { Collection, collect, range, times } from '../src/utils/Collection';

// ============================================
// Test Data
// ============================================

interface User {
  id: number;
  name: string;
  age: number;
  role: string;
}

const users: User[] = [
  { id: 1, name: 'John', age: 30, role: 'admin' },
  { id: 2, name: 'Jane', age: 25, role: 'user' },
  { id: 3, name: 'Bob', age: 35, role: 'user' },
  { id: 4, name: 'Alice', age: 28, role: 'admin' },
];

// ============================================
// Tests
// ============================================

describe('Collection', () => {
  describe('Creation Methods', () => {
    test('make() should create collection from array', () => {
      const col = Collection.make([1, 2, 3]);
      expect(col.count()).toBe(3);
      expect(col.toArray()).toEqual([1, 2, 3]);
    });

    test('range() should create number range collection', () => {
      const col = Collection.range(1, 5);
      expect(col.toArray()).toEqual([1, 2, 3, 4, 5]);
    });

    test('times() should create collection with N items', () => {
      const col = Collection.times(3, (i) => i * 2);
      expect(col.toArray()).toEqual([0, 2, 4]);
    });

    test('collect() helper should create collection', () => {
      const col = collect([1, 2, 3]);
      expect(col.count()).toBe(3);
    });

    test('range() helper should create number range', () => {
      const col = range(1, 3);
      expect(col.toArray()).toEqual([1, 2, 3]);
    });

    test('times() helper should create repeated collection', () => {
      const col = times(3, (i) => `item-${i}`);
      expect(col.toArray()).toEqual(['item-0', 'item-1', 'item-2']);
    });
  });

  describe('Transformation Methods', () => {
    test('map() should transform items', () => {
      const col = collect(users).map(u => u.name);
      expect(col.toArray()).toEqual(['John', 'Jane', 'Bob', 'Alice']);
    });

    test('filter() should filter items', () => {
      const col = collect(users).filter(u => u.role === 'admin');
      expect(col.count()).toBe(2);
      expect(col.pluck('name').toArray()).toEqual(['John', 'Alice']);
    });

    test('reject() should reject items', () => {
      const col = collect(users).reject(u => u.role === 'admin');
      expect(col.count()).toBe(2);
    });

    test('reduce() should reduce to single value', () => {
      const total = collect(users).reduce((sum, u) => sum + u.age, 0);
      expect(total).toBe(118); // 30 + 25 + 35 + 28
    });

    test('flatten() should flatten nested arrays', () => {
      const col = collect([[1, 2], [3, 4]]).flatten<number>();
      expect(col.toArray()).toEqual([1, 2, 3, 4]);
    });

    test('flatMap() should flatten and map', () => {
      const col = collect([1, 2]).flatMap(n => [n, n * 2]);
      expect(col.toArray()).toEqual([1, 2, 2, 4]);
    });

    test('unique() should return unique items', () => {
      const col = collect([1, 2, 2, 3, 3, 3]).unique();
      expect(col.toArray()).toEqual([1, 2, 3]);
    });

    test('unique() should work with key', () => {
      const col = collect(users).unique('role');
      expect(col.count()).toBe(2);
    });

    test('sort() should sort items', () => {
      const col = collect([3, 1, 2]).sort();
      expect(col.toArray()).toEqual([1, 2, 3]);
    });

    test('sortBy() should sort by key', () => {
      const col = collect(users).sortBy('age');
      expect(col.first()?.name).toBe('Jane');
      expect(col.last()?.name).toBe('Bob');
    });

    test('sortBy() should support descending order', () => {
      const col = collect(users).sortBy('age', 'desc');
      expect(col.first()?.name).toBe('Bob');
    });

    test('reverse() should reverse items', () => {
      const col = collect([1, 2, 3]).reverse();
      expect(col.toArray()).toEqual([3, 2, 1]);
    });

    test('groupBy() should group items', () => {
      const groups = collect(users).groupBy('role');
      expect(groups.get('admin')?.length).toBe(2);
      expect(groups.get('user')?.length).toBe(2);
    });

    test('keyBy() should key by field', () => {
      const keyed = collect(users).keyBy('id');
      expect(keyed.get(1)?.name).toBe('John');
      expect(keyed.get(2)?.name).toBe('Jane');
    });

    test('pluck() should extract single key', () => {
      const names = collect(users).pluck('name');
      expect(names.toArray()).toEqual(['John', 'Jane', 'Bob', 'Alice']);
    });

    test('chunk() should split into chunks', () => {
      const chunks = collect([1, 2, 3, 4, 5]).chunk(2);
      expect(chunks.toArray()).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('take() should take first N items', () => {
      const col = collect(users).take(2);
      expect(col.count()).toBe(2);
      expect(col.pluck('name').toArray()).toEqual(['John', 'Jane']);
    });

    test('skip() should skip first N items', () => {
      const col = collect(users).skip(2);
      expect(col.count()).toBe(2);
      expect(col.pluck('name').toArray()).toEqual(['Bob', 'Alice']);
    });

    test('takeWhile() should take while true', () => {
      const col = collect([1, 2, 3, 1, 2]).takeWhile(n => n < 3);
      expect(col.toArray()).toEqual([1, 2]);
    });

    test('skipWhile() should skip while true', () => {
      const col = collect([1, 2, 3, 1, 2]).skipWhile(n => n < 3);
      expect(col.toArray()).toEqual([3, 1, 2]);
    });
  });

  describe('Aggregation Methods', () => {
    test('count() should return count', () => {
      expect(collect(users).count()).toBe(4);
    });

    test('sum() should sum numbers', () => {
      expect(collect([1, 2, 3]).sum()).toBe(6);
    });

    test('sum() should sum by key', () => {
      expect(collect(users).sum('age')).toBe(118);
    });

    test('avg() should calculate average', () => {
      expect(collect([1, 2, 3, 4]).avg()).toBe(2.5);
    });

    test('avg() should average by key', () => {
      expect(collect(users).avg('age')).toBe(29.5);
    });

    test('min() should return minimum', () => {
      expect(collect([3, 1, 2]).min()).toBe(1);
    });

    test('min() should return item with minimum key', () => {
      const youngest = collect(users).min('age') as User;
      expect(youngest.name).toBe('Jane');
    });

    test('max() should return maximum', () => {
      expect(collect([3, 1, 2]).max()).toBe(3);
    });

    test('max() should return item with maximum key', () => {
      const oldest = collect(users).max('age') as User;
      expect(oldest.name).toBe('Bob');
    });
  });

  describe('Retrieval Methods', () => {
    test('first() should return first item', () => {
      expect(collect(users).first()?.name).toBe('John');
    });

    test('first() should return undefined for empty collection', () => {
      expect(collect([]).first()).toBeUndefined();
    });

    test('last() should return last item', () => {
      expect(collect(users).last()?.name).toBe('Alice');
    });

    test('get() should return item at index', () => {
      expect(collect(users).get(1)?.name).toBe('Jane');
    });

    test('nth() should return nth item (1-indexed)', () => {
      expect(collect(users).nth(2)?.name).toBe('Jane');
    });

    test('find() should find matching item', () => {
      const user = collect(users).find(u => u.name === 'Bob');
      expect(user?.age).toBe(35);
    });

    test('findIndex() should return index', () => {
      const index = collect(users).findIndex(u => u.name === 'Bob');
      expect(index).toBe(2);
    });

    test('random() should return random item', () => {
      const item = collect(users).random();
      expect(item).toBeDefined();
      expect(users.includes(item!)).toBe(true);
    });

    test('shuffle() should shuffle items', () => {
      const shuffled = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).shuffle();
      expect(shuffled.count()).toBe(10);
      // Can't test randomness reliably, just check all items present
      expect(shuffled.sort((a, b) => a - b).toArray()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe('Boolean Methods', () => {
    test('isEmpty() should return true for empty collection', () => {
      expect(collect([]).isEmpty()).toBe(true);
      expect(collect([1]).isEmpty()).toBe(false);
    });

    test('isNotEmpty() should return true for non-empty collection', () => {
      expect(collect([1]).isNotEmpty()).toBe(true);
      expect(collect([]).isNotEmpty()).toBe(false);
    });

    test('contains() should check if item exists', () => {
      expect(collect([1, 2, 3]).contains(2)).toBe(true);
      expect(collect([1, 2, 3]).contains(4)).toBe(false);
    });

    test('every() should check all items', () => {
      expect(collect([2, 4, 6]).every(n => n % 2 === 0)).toBe(true);
      expect(collect([2, 4, 5]).every(n => n % 2 === 0)).toBe(false);
    });

    test('some() should check any item', () => {
      expect(collect([1, 2, 3]).some(n => n > 2)).toBe(true);
      expect(collect([1, 2, 3]).some(n => n > 5)).toBe(false);
    });
  });

  describe('Combination Methods', () => {
    test('merge() should merge collections', () => {
      const a = collect([1, 2]);
      const b = collect([3, 4]);
      expect(a.merge(b).toArray()).toEqual([1, 2, 3, 4]);
    });

    test('concat() should concatenate items', () => {
      const col = collect([1, 2]).concat([3, 4], 5);
      expect(col.toArray()).toEqual([1, 2, 3, 4, 5]);
    });

    test('zip() should zip two arrays', () => {
      const col = collect(['a', 'b', 'c']).zip([1, 2, 3]);
      expect(col.toArray()).toEqual([['a', 1], ['b', 2], ['c', 3]]);
    });

    test('diff() should return difference', () => {
      const col = collect([1, 2, 3, 4]).diff([2, 4]);
      expect(col.toArray()).toEqual([1, 3]);
    });

    test('intersect() should return intersection', () => {
      const col = collect([1, 2, 3, 4]).intersect([2, 4, 6]);
      expect(col.toArray()).toEqual([2, 4]);
    });
  });

  describe('Conversion Methods', () => {
    test('all() should return array copy', () => {
      const arr = [1, 2, 3];
      const col = collect(arr);
      const result = col.all();
      expect(result).toEqual(arr);
      expect(result).not.toBe(arr); // Different reference
    });

    test('toArray() should return array', () => {
      expect(collect([1, 2, 3]).toArray()).toEqual([1, 2, 3]);
    });

    test('toJSON() should return JSON string', () => {
      expect(collect([1, 2, 3]).toJSON()).toBe('[1,2,3]');
    });

    test('join() should join items', () => {
      expect(collect(['a', 'b', 'c']).join('-')).toBe('a-b-c');
    });

    test('implode() should implode by key', () => {
      expect(collect(users).implode('name', ', ')).toBe('John, Jane, Bob, Alice');
    });
  });

  describe('Iteration Methods', () => {
    test('each() should iterate over items', () => {
      const results: number[] = [];
      collect([1, 2, 3]).each(n => results.push(n * 2));
      expect(results).toEqual([2, 4, 6]);
    });

    test('tap() should tap into collection', () => {
      let count = 0;
      const col = collect([1, 2, 3]).tap(c => { count = c.count(); });
      expect(count).toBe(3);
      expect(col.count()).toBe(3);
    });

    test('pipe() should pipe through callback', () => {
      const result = collect([1, 2, 3]).pipe(c => c.sum());
      expect(result).toBe(6);
    });

    test('should be iterable', () => {
      const results: number[] = [];
      for (const item of collect([1, 2, 3])) {
        results.push(item);
      }
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('Modification Methods', () => {
    test('push() should add items', () => {
      const col = collect([1, 2]).push(3, 4);
      expect(col.toArray()).toEqual([1, 2, 3, 4]);
    });

    test('prepend() should prepend items', () => {
      const col = collect([3, 4]).prepend(1, 2);
      expect(col.toArray()).toEqual([1, 2, 3, 4]);
    });

    test('pop() should remove and return last item', () => {
      const { item, collection } = collect([1, 2, 3]).pop();
      expect(item).toBe(3);
      expect(collection.toArray()).toEqual([1, 2]);
    });

    test('shift() should remove and return first item', () => {
      const { item, collection } = collect([1, 2, 3]).shift();
      expect(item).toBe(1);
      expect(collection.toArray()).toEqual([2, 3]);
    });
  });
});
