/**
 * CanxJS Factory - Database Seeding Utility
 */

import { Model } from '../mvc/Model';

type FactoryDefine<T> = (faker: Faker) => Partial<T>;

export class Factory<T extends Model> {
  private model: { new (): T } & typeof Model;
  private count: number = 1;
  private states: Array<(attrs: Partial<T>) => Partial<T>> = [];
  
  constructor(model: { new (): T } & typeof Model) {
    this.model = model;
  }

  // Set count
  countLines(n: number): this {
    this.count = n;
    return this;
  }

  // Create and save to DB
  async create(overrides: Partial<T> = {}): Promise<T | T[]> {
    const instances: T[] = [];
    const definition = factoryRegistry.get(this.model);
    
    if (!definition) {
       throw new Error(`No factory defined for model ${this.model.name}`);
    }

    for (let i = 0; i < this.count; i++) {
        let attrs = definition(faker);
        
        // Apply states
        for (const state of this.states) {
            attrs = { ...attrs, ...state(attrs) };
        }
        
        // Apply overrides
        attrs = { ...attrs, ...overrides };
        
        const instance = await this.model.create(attrs);
        instances.push(instance);
    }
    
    return this.count === 1 ? instances[0] : instances;
  }
  
  // Create instance but don't save
  make(overrides: Partial<T> = {}): T | T[] {
      const instances: T[] = [];
      const definition = factoryRegistry.get(this.model);
      
      if (!definition) {
         throw new Error(`No factory defined for model ${this.model.name}`);
      }
  
      for (let i = 0; i < this.count; i++) {
          let attrs = definition(faker);
          for (const state of this.states) {
              attrs = { ...attrs, ...state(attrs) };
          }
          attrs = { ...attrs, ...overrides };
          
          const instance = new (this.model as any)();
          instance.fill(attrs);
          instances.push(instance);
      }
      
      return this.count === 1 ? instances[0] : instances;
  }
}

// Registry
const factoryRegistry = new Map<any, FactoryDefine<any>>();

export function defineFactory<T>(model: any, definition: FactoryDefine<T>) {
    factoryRegistry.set(model, definition);
}

export function factory<T extends Model>(model: any): Factory<T> {
    return new Factory(model);
}

// ============================================
// Lightweight Faker Implementation
// ============================================

class Faker {
    name() {
        const first = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'James', 'Emma'];
        const last = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
        return `${this.pick(first)} ${this.pick(last)}`;
    }
    
    email() {
        const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'example.com'];
        return `${this.slug(this.name())}@${this.pick(domains)}`;
    }
    
    text(length = 50) {
        const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(' ');
        let res = "";
        while (res.length < length) {
            res += this.pick(words) + " ";
        }
        return res.trim().slice(0, length);
    }
    
    boolean() {
        return Math.random() > 0.5;
    }
    
    number(min = 1, max = 100) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    date() {
        return new Date(Date.now() - Math.floor(Math.random() * 10000000000));
    }

    pick<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    slug(str: string) {
        return str.toLowerCase().replace(/ /g, '.');
    }

    uuid() {
       return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

export const faker = new Faker();
