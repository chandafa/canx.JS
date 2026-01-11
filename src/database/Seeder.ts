/**
 * CanxJS Seeder - Database seeding utilities
 */

import { execute, query } from '../mvc/Model';

type SeederFunction = () => Promise<void>;

interface SeederDefinition {
  name: string;
  run: SeederFunction;
}

class SeederRunner {
  private seeders: SeederDefinition[] = [];

  register(name: string, run: SeederFunction): void {
    this.seeders.push({ name, run });
  }

  async run(name?: string): Promise<void> {
    const toRun = name 
      ? this.seeders.filter(s => s.name === name)
      : this.seeders;

    if (toRun.length === 0) {
      console.log('[Seeder] No seeders to run.');
      return;
    }

    for (const seeder of toRun) {
      console.log(`[Seeder] Running: ${seeder.name}`);
      await seeder.run();
      console.log(`[Seeder] Completed: ${seeder.name}`);
    }
  }

  list(): string[] {
    return this.seeders.map(s => s.name);
  }
}

export const seeder = new SeederRunner();

// Faker-like utilities for seeding
export const fake = {
  name: () => {
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  },
  
  email: () => {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com'];
    const name = Math.random().toString(36).slice(2, 10);
    return `${name}@${domains[Math.floor(Math.random() * domains.length)]}`;
  },
  
  uuid: () => crypto.randomUUID(),
  
  number: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
  
  boolean: () => Math.random() > 0.5,
  
  date: (start = new Date(2020, 0, 1), end = new Date()) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  },
  
  pick: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],
  
  paragraph: () => {
    const sentences = [
      'Lorem ipsum dolor sit amet.',
      'Consectetur adipiscing elit.',
      'Sed do eiusmod tempor incididunt.',
      'Ut labore et dolore magna aliqua.',
    ];
    return sentences.slice(0, fake.number(2, 4)).join(' ');
  },
  
  phone: () => `+1${fake.number(100, 999)}${fake.number(100, 999)}${fake.number(1000, 9999)}`,
  
  address: () => `${fake.number(100, 9999)} ${fake.pick(['Main', 'Oak', 'Elm', 'Park'])} ${fake.pick(['St', 'Ave', 'Blvd'])}`,
};

// Factory pattern for creating test data
export function factory<T>(generator: () => T) {
  return {
    create: () => generator(),
    createMany: (count: number) => Array.from({ length: count }, generator),
  };
}

export function defineSeeder(name: string, run: SeederFunction): void {
  seeder.register(name, run);
}

export default { seeder, fake, factory, defineSeeder };
