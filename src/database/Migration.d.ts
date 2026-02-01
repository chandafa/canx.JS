/**
 * CanxJS Migrations - Database schema management
 */
export interface Migration {
    name: string;
    up: () => Promise<void>;
    down: () => Promise<void>;
}
declare class TableBuilder {
    private columns;
    private tableName;
    private indices;
    private uniques;
    constructor(name: string);
    id(name?: string): this;
    string(name: string, length?: number): this;
    text(name: string): this;
    integer(name: string): this;
    bigInteger(name: string): this;
    float(name: string): this;
    decimal(name: string, precision?: number, scale?: number): this;
    boolean(name: string): this;
    date(name: string): this;
    datetime(name: string): this;
    timestamp(name: string): this;
    timestamps(): this;
    softDeletes(): this;
    json(name: string): this;
    binary(name: string): this;
    nullable(): this;
    default(value: unknown): this;
    unique(): this;
    primary(): this;
    index(): this;
    unsigned(): this;
    references(table: string, column?: string): this;
    onDelete(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this;
    toSQL(): string;
}
export declare const Schema: {
    create(table: string, callback: (builder: TableBuilder) => void): Promise<void>;
    drop(table: string): Promise<void>;
    dropIfExists(table: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    hasTable(table: string): Promise<boolean>;
    hasColumn(table: string, column: string): Promise<boolean>;
};
declare class Migrator {
    private migrations;
    ensureTable(): Promise<void>;
    register(migration: Migration): void;
    getExecuted(): Promise<string[]>;
    getNextBatch(): Promise<number>;
    run(): Promise<void>;
    rollback(): Promise<void>;
    reset(): Promise<void>;
    fresh(): Promise<void>;
    status(): Promise<{
        name: string;
        ran: boolean;
    }[]>;
}
export declare const migrator: Migrator;
export declare function defineMigration(name: string, up: () => Promise<void>, down: () => Promise<void>): Migration;
declare const _default: {
    Schema: {
        create(table: string, callback: (builder: TableBuilder) => void): Promise<void>;
        drop(table: string): Promise<void>;
        dropIfExists(table: string): Promise<void>;
        rename(from: string, to: string): Promise<void>;
        hasTable(table: string): Promise<boolean>;
        hasColumn(table: string, column: string): Promise<boolean>;
    };
    migrator: Migrator;
    defineMigration: typeof defineMigration;
};
export default _default;
