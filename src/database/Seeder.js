"use strict";
/**
 * CanxJS Seeder - Database seeding utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fake = exports.seeder = void 0;
exports.factory = factory;
exports.defineSeeder = defineSeeder;
class SeederRunner {
    seeders = [];
    register(name, run) {
        this.seeders.push({ name, run });
    }
    async run(name) {
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
    list() {
        return this.seeders.map(s => s.name);
    }
}
exports.seeder = new SeederRunner();
// Faker-like utilities for seeding
exports.fake = {
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
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    paragraph: () => {
        const sentences = [
            'Lorem ipsum dolor sit amet.',
            'Consectetur adipiscing elit.',
            'Sed do eiusmod tempor incididunt.',
            'Ut labore et dolore magna aliqua.',
        ];
        return sentences.slice(0, exports.fake.number(2, 4)).join(' ');
    },
    phone: () => `+1${exports.fake.number(100, 999)}${exports.fake.number(100, 999)}${exports.fake.number(1000, 9999)}`,
    address: () => `${exports.fake.number(100, 9999)} ${exports.fake.pick(['Main', 'Oak', 'Elm', 'Park'])} ${exports.fake.pick(['St', 'Ave', 'Blvd'])}`,
};
// Factory pattern for creating test data
function factory(generator) {
    return {
        create: () => generator(),
        createMany: (count) => Array.from({ length: count }, generator),
    };
}
function defineSeeder(name, run) {
    exports.seeder.register(name, run);
}
exports.default = { seeder: exports.seeder, fake: exports.fake, factory, defineSeeder };
