/**
 * CanxJS Model - Zero-config ORM with MySQL primary, PostgreSQL secondary
 */
import type { DatabaseConfig, DatabaseDriver, QueryBuilder, CastType } from '../types';
export declare function initDatabase(config: DatabaseConfig): Promise<void>;
export declare function closeDatabase(): Promise<void>;
export declare function getCurrentDriver(): DatabaseDriver;
declare function query<T = any>(sql: string, params?: any[]): Promise<T[]>;
declare function execute(sql: string, params?: any[]): Promise<{
    affectedRows: number;
    insertId: number;
}>;
interface RelationInfo {
    type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
    relatedClass: any;
    foreignKey: string;
    localKey?: string;
    ownerKey?: string;
    pivotTable?: string;
    foreignPivotKey?: string;
    relatedPivotKey?: string;
    morphName?: string;
    morphType?: string;
    morphId?: string;
    throughClass?: any;
    firstKey?: string;
    secondKey?: string;
}
export interface ModelObserver {
    creating?(model: Model): void | Promise<void>;
    created?(model: Model): void | Promise<void>;
    updating?(model: Model): void | Promise<void>;
    updated?(model: Model): void | Promise<void>;
    saving?(model: Model): void | Promise<void>;
    saved?(model: Model): void | Promise<void>;
    deleting?(model: Model): void | Promise<void>;
    deleted?(model: Model): void | Promise<void>;
    restoring?(model: Model): void | Promise<void>;
    restored?(model: Model): void | Promise<void>;
}
export declare class QueryBuilderImpl<T> implements QueryBuilder<T> {
    private table;
    private selectCols;
    private whereClauses;
    private orderClauses;
    private limitVal?;
    private offsetVal?;
    private joinClauses;
    private groupClauses;
    private havingClauses;
    private bindings;
    private modelClass?;
    private withTrashed;
    private withRelations;
    _relationInfo?: RelationInfo;
    constructor(table: string, modelClass?: any);
    select(...cols: any[]): this;
    where(col: any, op: string, val: any): this;
    whereIn(col: any, vals: any[]): this;
    whereNull(col: any): this;
    whereNotNull(col: any): this;
    orWhere(col: any, op: string, val: any): this;
    orderBy(col: any, dir?: 'asc' | 'desc'): this;
    limit(n: number): this;
    offset(n: number): this;
    join(table: string, first: string, op: string, second: string): this;
    leftJoin(table: string, first: string, op: string, second: string): this;
    groupBy(...cols: any[]): this;
    having(col: any, op: string, val: any): this;
    whereRaw(sql: string, bindings?: any[]): this;
    with(...relations: string[]): this;
    private buildSelect;
    get(): Promise<T[]>;
    eagerLoad(results: any[]): Promise<void>;
    first(): Promise<T | null>;
    count(): Promise<number>;
    sum(col: any): Promise<number>;
    avg(col: any): Promise<number>;
    insert(data: Partial<T> | Partial<T>[]): Promise<T>;
    update(data: Partial<T>): Promise<number>;
    delete(): Promise<number>;
    forceDelete(): Promise<number>;
    withTrashedResults(): this;
    raw(sql: string, bindings?: any[]): Promise<any>;
    /**
     * Paginate results
     * @param page - Current page (1-indexed)
     * @param perPage - Items per page
     */
    paginate(page?: number, perPage?: number): Promise<{
        data: T[];
        total: number;
        perPage: number;
        currentPage: number;
        lastPage: number;
        from: number;
        to: number;
    }>;
}
export declare abstract class Model {
    protected static tableName: string;
    protected static primaryKey: string;
    protected static timestamps: boolean;
    protected static softDeletes: boolean;
    protected static deletedAtColumn: string;
    protected static observers: ModelObserver[];
    protected casts: Record<string, CastType>;
    [key: string]: any;
    relations: Record<string, any>;
    constructor(data?: any);
    /**
     * Create a new query builder for this model.
     */
    /**
     * Add a basic where clause to the query.
     */
    static observe(observer: ModelObserver): void;
    protected fireEvent(event: keyof ModelObserver): Promise<void>;
    private castAttribute;
    private prepareAttributeForStorage;
    fill(data: any): this;
    /**
     * Define hasOne relationship
     */
    protected hasOne<T extends Model>(relatedClass: {
        new (): T;
    } & typeof Model, foreignKey?: string, localKey?: string): QueryBuilder<T>;
    /**
     * Define hasMany relationship
     */
    protected hasMany<T extends Model>(relatedClass: {
        new (): T;
    } & typeof Model, foreignKey?: string, localKey?: string): QueryBuilder<T>;
    /**
     * Define belongsTo relationship
     */
    protected belongsTo<T extends Model>(relatedClass: {
        new (): T;
    } & typeof Model, foreignKey?: string, ownerKey?: string): QueryBuilder<T>;
    /**
     * Define belongsToMany relationship (ManyToMany)
     * Assumes pivot table name is alphabetical order of model names joined by underscore
     */
    protected belongsToMany<T extends Model>(relatedClass: {
        new (): T;
    } & typeof Model, pivotTable?: string, foreignPivotKey?: string, relatedPivotKey?: string): QueryBuilder<T>;
    /**
     * Define morphTo relationship
     */
    protected morphTo(name?: string, type?: string, id?: string, ownerKey?: string): QueryBuilder<any>;
    /**
     * Define morphOne relationship
     */
    protected morphOne<T extends Model>(relatedClass: {
        new (): T;
    } & typeof Model, name: string, type?: string, id?: string, localKey?: string): QueryBuilder<T>;
    /**
     * Define morphMany relationship
     */
    protected morphMany<T extends Model>(relatedClass: {
        new (): T;
    } & typeof Model, name: string, type?: string, id?: string, localKey?: string): QueryBuilder<T>;
    /**
     * Define hasManyThrough relationship
     */
    protected hasManyThrough<T extends Model>(relatedClass: {
        new (): T;
    } & typeof Model, throughClass: {
        new (): any;
    } & typeof Model, firstKey?: string, // Foreign key on through table
    secondKey?: string, // Foreign key on related table
    localKey?: string, // Local key on this model
    secondLocalKey?: string): QueryBuilder<T>;
    static table<T extends Model>(this: any): QueryBuilder<T>;
    static find<T extends Model>(this: any, id: number | string): Promise<T | null>;
    static query<T extends Model>(this: any): QueryBuilder<T>;
    static all<T extends Model>(this: any): Promise<T[]>;
    startRelation(name: string): void;
    load(...relations: string[]): Promise<this>;
    static with<T extends Model>(this: any, ...relations: string[]): QueryBuilder<T>;
    save(): Promise<this>;
    delete(): Promise<boolean>;
    restore(): Promise<boolean>;
    static create<T extends Model>(this: {
        new (): T;
    } & typeof Model, data: Partial<T>): Promise<T>;
    static updateById<T>(id: number | string, data: Partial<T>): Promise<number>;
    static deleteById(id: number | string): Promise<number>;
    static where<T extends Model>(this: any, col: string | any, op?: string, val?: any): QueryBuilder<T>;
}
export { query, execute };
export default Model;
