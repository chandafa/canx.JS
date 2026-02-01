/**
 * CanxJS Seeder - Database seeding utilities
 */
type SeederFunction = () => Promise<void>;
declare class SeederRunner {
    private seeders;
    register(name: string, run: SeederFunction): void;
    run(name?: string): Promise<void>;
    list(): string[];
}
export declare const seeder: SeederRunner;
export declare const fake: {
    name: () => string;
    email: () => string;
    uuid: () => `${string}-${string}-${string}-${string}-${string}`;
    number: (min?: number, max?: number) => number;
    boolean: () => boolean;
    date: (start?: Date, end?: Date) => Date;
    pick: <T>(arr: T[]) => T;
    paragraph: () => string;
    phone: () => string;
    address: () => string;
};
export declare function factory<T>(generator: () => T): {
    create: () => T;
    createMany: (count: number) => T[];
};
export declare function defineSeeder(name: string, run: SeederFunction): void;
declare const _default: {
    seeder: SeederRunner;
    fake: {
        name: () => string;
        email: () => string;
        uuid: () => `${string}-${string}-${string}-${string}-${string}`;
        number: (min?: number, max?: number) => number;
        boolean: () => boolean;
        date: (start?: Date, end?: Date) => Date;
        pick: <T>(arr: T[]) => T;
        paragraph: () => string;
        phone: () => string;
        address: () => string;
    };
    factory: typeof factory;
    defineSeeder: typeof defineSeeder;
};
export default _default;
