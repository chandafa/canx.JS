import { Model } from '../mvc/Model';
import { Scout, searchManager } from './SearchManager';
import { SearchBuilder } from './engines/Engine';

export interface Searchable {
  searchableAs(): string;
  toSearchableArray(): Record<string, any>;
  getScoutKey(): string | number;
  getScoutKeyName(): string;
}

/**
 * Perform a search on the model
 */
export function search<T extends typeof Model>(
  model: T, 
  query: string,
  callback?: (query: any) => any
): SearchBuilder {
    return new SearchBuilder(model, query, callback);
}

/**
 * Mixin to add search capabilities to a Model class
 * Note: TypeScript class mixins are tricky.
 * Standard usage in CanxJS:
 * 
 * class User extends Model {
 *    static search(query) { return search(User, query); }
 * }
 */

export const Search = {
    search
};
