/**
 * CanxJS Model - Zero-config ORM with MySQL primary, PostgreSQL secondary
 */

import type { DatabaseConfig, DatabaseDriver, ModelField, ModelSchema, QueryBuilder } from '../types';

// Database connection pool
let mysqlPool: any = null;
let pgPool: any = null;
let sqliteDb: any = null;
let currentDriver: DatabaseDriver = 'mysql';
let dbConfig: DatabaseConfig | null = null;

export async function initDatabase(config: DatabaseConfig): Promise<void> {
  dbConfig = config;
  currentDriver = config.driver;

  if (config.driver === 'mysql') {
    const mysql = await import('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
      waitForConnections: true,
      connectionLimit: config.pool?.max || 10,
      queueLimit: 0,
    });
    console.log('[CanxJS] MySQL connection pool created');
  } else if (config.driver === 'postgresql') {
    const { Pool } = await import('pg');
    pgPool = new Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.pool?.max || 10,
      idleTimeoutMillis: config.pool?.idle || 30000,
    });
    console.log('[CanxJS] PostgreSQL connection pool created');
  } else if (config.driver === 'sqlite') {
    const { Database } = await import('bun:sqlite');
    sqliteDb = new Database(config.database);
    console.log('[CanxJS] SQLite database connected');
  }
}

export async function closeDatabase(): Promise<void> {
  if (mysqlPool) { await mysqlPool.end(); mysqlPool = null; }
  if (pgPool) { await pgPool.end(); pgPool = null; }
  if (sqliteDb) { sqliteDb.close(); sqliteDb = null; }
}

export function getCurrentDriver(): DatabaseDriver {
  return currentDriver;
}

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (dbConfig?.logging) console.log('[SQL]', sql, params);

  if (currentDriver === 'mysql' && mysqlPool) {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows as T[];
  } else if (currentDriver === 'postgresql' && pgPool) {
    // Convert ? placeholders to $1, $2 for PostgreSQL
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await pgPool.query(pgSql, params);
    return result.rows as T[];
  } else if (currentDriver === 'sqlite' && sqliteDb) {
    const query = sqliteDb.query(sql);
    // bun:sqlite uses $1, $2 or named params, but handle simple ? for compatibility?
    // Bun sqlite actually supports ? binding since recent versions or via .all(...params)
    // Let's try direct binding.
    return query.all(...params) as T[];
  }
  throw new Error('No database connection');
}

async function execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId: number }> {
  if (dbConfig?.logging) console.log('[SQL]', sql, params);

  if (currentDriver === 'mysql' && mysqlPool) {
    const [result] = await mysqlPool.execute(sql, params);
    return { affectedRows: result.affectedRows, insertId: result.insertId };
  } else if (currentDriver === 'postgresql' && pgPool) {
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await pgPool.query(pgSql + ' RETURNING *', params);
    return { affectedRows: result.rowCount || 0, insertId: result.rows[0]?.id || 0 };
  } else if (currentDriver === 'sqlite' && sqliteDb) {
    const query = sqliteDb.query(sql);
    const result = query.run(...params);
    return { affectedRows: result.changes, insertId: result.lastInsertRowid };
  }
  throw new Error('No database connection');
}

// Relation Metadata interface
interface RelationInfo {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
  relatedClass: any;
  foreignKey: string;
  localKey?: string;
  ownerKey?: string;
  pivotTable?: string;
  foreignPivotKey?: string;
  relatedPivotKey?: string;
}

// Query Builder implementation
export class QueryBuilderImpl<T> implements QueryBuilder<T> {
  private table: string;
  private selectCols: string[] = ['*'];
  private whereClauses: string[] = [];
  private orderClauses: string[] = [];
  private limitVal?: number;
  private offsetVal?: number;
  private joinClauses: string[] = [];
  private groupClauses: string[] = [];
  private havingClauses: string[] = [];
  private bindings: any[] = [];
  
  // Model mapping
  private modelClass?: any;
  
  // Eager Loading
  private withRelations: string[] = [];
  // Internal relation info attached by relationship methods
  public _relationInfo?: RelationInfo;

  constructor(table: string, modelClass?: any) { 
    this.table = table;
    this.modelClass = modelClass;
  }
  
  // ... existing methods ...

  select(...cols: any[]): this { this.selectCols = cols.length ? cols : ['*']; return this; }
  
  where(col: any, op: string, val: any): this {
    this.whereClauses.push(`${String(col)} ${op} ?`);
    this.bindings.push(val);
    return this;
  }
  
  whereIn(col: any, vals: any[]): this {
    if (vals.length === 0) {
       this.whereClauses.push('1 = 0'); // False condition if empty
       return this;
    }
    this.whereClauses.push(`${String(col)} IN (${vals.map(() => '?').join(',')})`);
    this.bindings.push(...vals);
    return this;
  }

  whereNull(col: any): this { this.whereClauses.push(`${String(col)} IS NULL`); return this; }
  whereNotNull(col: any): this { this.whereClauses.push(`${String(col)} IS NOT NULL`); return this; }

  orWhere(col: any, op: string, val: any): this {
    if (this.whereClauses.length) {
      const last = this.whereClauses.pop();
      this.whereClauses.push(`(${last} OR ${String(col)} ${op} ?)`);
    } else {
      this.whereClauses.push(`${String(col)} ${op} ?`);
    }
    this.bindings.push(val);
    return this;
  }

  orderBy(col: any, dir: 'asc' | 'desc' = 'asc'): this {
    this.orderClauses.push(`${String(col)} ${dir.toUpperCase()}`);
    return this;
  }
  
  limit(n: number): this { this.limitVal = n; return this; }
  offset(n: number): this { this.offsetVal = n; return this; }

  join(table: string, first: string, op: string, second: string): this {
    this.joinClauses.push(`INNER JOIN ${table} ON ${first} ${op} ${second}`);
    return this;
  }
  
  leftJoin(table: string, first: string, op: string, second: string): this {
    this.joinClauses.push(`LEFT JOIN ${table} ON ${first} ${op} ${second}`);
    return this;
  }

  groupBy(...cols: any[]): this { this.groupClauses = cols.map(String); return this; }

  having(col: any, op: string, val: any): this {
    this.havingClauses.push(`${String(col)} ${op} ?`);
    this.bindings.push(val);
    return this;
  }
  
  whereRaw(sql: string, bindings: any[] = []): this {
    this.whereClauses.push(sql);
    this.bindings.push(...bindings);
    return this;
  }
  
  // Eager Loading
  with(...relations: string[]): this {
    this.withRelations.push(...relations);
    return this;
  }

  private buildSelect(): string {
    let sql = `SELECT ${this.selectCols.join(', ')} FROM ${this.table}`;
    if (this.joinClauses.length) sql += ' ' + this.joinClauses.join(' ');
    if (this.whereClauses.length) sql += ' WHERE ' + this.whereClauses.join(' AND ');
    if (this.groupClauses.length) sql += ' GROUP BY ' + this.groupClauses.join(', ');
    if (this.havingClauses.length) sql += ' HAVING ' + this.havingClauses.join(' AND ');
    if (this.orderClauses.length) sql += ' ORDER BY ' + this.orderClauses.join(', ');
    if (this.limitVal !== undefined) sql += ` LIMIT ${this.limitVal}`;
    if (this.offsetVal !== undefined) sql += ` OFFSET ${this.offsetVal}`;
    return sql;
  }

  async get(): Promise<T[]> { 
    const rows = await query<any>(this.buildSelect(), this.bindings);
    let results: T[] = rows as T[];
    
    if (this.modelClass) {
      results = rows.map(r => new this.modelClass().fill(r));
    }
    
    // Process Eager Loading
    if (this.withRelations.length > 0 && this.modelClass && results.length > 0) {
      await this.eagerLoad(results);
    }
    
    return results;
  }
  
  async eagerLoad(results: any[]) {
    // We assume results are instances of modelClass
    const instance = new this.modelClass();
    
    for (const relationName of this.withRelations) {
      if (typeof instance[relationName] !== 'function') {
        console.warn(`[Model] Relation method '${relationName}' not found on ${this.modelClass.name}`);
        continue;
      }
      
      // Get relation definition by calling the method
      // The method returns a QueryBuilder with _relationInfo attached
      const relationQuery = instance[relationName]();
      const info = (relationQuery as any)._relationInfo as RelationInfo;
      
      if (!info) {
        console.warn(`[Model] Method '${relationName}' did not return a valid relation QueryBuilder`);
        continue;
      }
      
      if (info.type === 'hasMany' || info.type === 'hasOne') {
        const localKey = info.localKey || 'id';
        const foreignKey = info.foreignKey;
        
        const parentIds = results.map(r => r[localKey]).filter(id => id !== undefined && id !== null);
        if (parentIds.length === 0) continue;
        
        // Ensure unique IDs
        const uniqueIds = [...new Set(parentIds)];
        
        // Fetch related
        const relatedResults = await info.relatedClass.query().whereIn(foreignKey, uniqueIds).get();
        
        // Map back
        for (const parent of results) {
          const parentId = parent[localKey];
          if (info.type === 'hasMany') {
            parent.startRelation(relationName);
            parent.relations[relationName] = relatedResults.filter((r: any) => r[foreignKey] == parentId);
          } else {
             // hasOne
             parent.startRelation(relationName);
             parent.relations[relationName] = relatedResults.find((r: any) => r[foreignKey] == parentId) || null;
          }
        }
        
      } else if (info.type === 'belongsTo') {
         const foreignKey = info.foreignKey; // e.g. user_id on Post
         const ownerKey = info.ownerKey || 'id'; // e.g. id on User
         
         const relatedIds = results.map(r => r[foreignKey]).filter(id => id !== undefined && id !== null);
         if (relatedIds.length === 0) continue;
         
         const uniqueIds = [...new Set(relatedIds)];
         const relatedResults = await info.relatedClass.query().whereIn(ownerKey, uniqueIds).get();
         
         for (const parent of results) {
           const relatedId = parent[foreignKey];
           parent.startRelation(relationName);
           parent.relations[relationName] = relatedResults.find((r: any) => r[ownerKey] == relatedId) || null;
         }
      } else if (info.type === 'belongsToMany') {
          // Pivot logic
          const localKey = 'id';
          const parentIds = results.map(r => r[localKey]).filter(id => id !== undefined && id !== null);
          if (parentIds.length === 0) continue;
          const uniqueIds = [...new Set(parentIds)];

          // 1. Get pivot rows
          // SELECT * FROM pivot WHERE foreignPivotKey IN (ids)
          const pivotSql = `SELECT * FROM ${info.pivotTable} WHERE ${info.foreignPivotKey} IN (${uniqueIds.map(() => '?').join(',')})`;
          const pivotRows = await query<any>(pivotSql, uniqueIds);
          
          if (pivotRows.length === 0) {
             for (const parent of results) {
                parent.startRelation(relationName);
                parent.relations[relationName] = [];
             }
             continue;
          }
          
          // 2. Get related rows
          const relatedIds = pivotRows.map(r => r[info.relatedPivotKey!]);
          const uniqueRelatedIds = [...new Set(relatedIds)];
          const relatedResults = await info.relatedClass.query().whereIn('id', uniqueRelatedIds).get();
          
          // 3. Map back
          for (const parent of results) {
             parent.startRelation(relationName);
             const myPivotRows = pivotRows.filter(r => r[info.foreignPivotKey!] == parent[localKey]);
             const myRelatedIds = myPivotRows.map(r => r[info.relatedPivotKey!]);
             
             parent.relations[relationName] = relatedResults.filter((r: any) => myRelatedIds.includes(r.id));
          }
      }
    }
  }
  
  async first(): Promise<T | null> { 
    this.limitVal = 1; 
    const rows = await this.get();
    return rows[0] || null; 
  }
  
  async count(): Promise<number> { this.selectCols = ['COUNT(*) as count']; const r = await query<any>(this.buildSelect(), this.bindings); return (r[0] as any)?.count || 0; }
  async sum(col: any): Promise<number> { this.selectCols = [`SUM(${String(col)}) as sum`]; const r = await query<any>(this.buildSelect(), this.bindings); return (r[0] as any)?.sum || 0; }
  async avg(col: any): Promise<number> { this.selectCols = [`AVG(${String(col)}) as avg`]; const r = await query<any>(this.buildSelect(), this.bindings); return (r[0] as any)?.avg || 0; }

  async insert(data: Partial<T> | Partial<T>[]): Promise<T> {
    const items = Array.isArray(data) ? data : [data];
    const keys = Object.keys(items[0]!);
    const values = items.map(item => keys.map(k => (item as any)[k]));
    const placeholders = values.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders}`;
    const result = await execute(sql, values.flat());
    
    // If modelClass is set, return instance?
    // insert() signature returns T.
    if (this.modelClass) {
       return new this.modelClass().fill({ ...(items[0] as any), id: result.insertId });
    }
    return { ...(items[0] as any), id: result.insertId } as T;
  }

  async update(data: Partial<T>): Promise<number> {
    const keys = Object.keys(data);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => (data as any)[k]);
    let sql = `UPDATE ${this.table} SET ${sets}`;
    if (this.whereClauses.length) sql += ' WHERE ' + this.whereClauses.join(' AND ');
    const result = await execute(sql, [...vals, ...this.bindings]);
    return result.affectedRows;
  }

  async delete(): Promise<number> {
    let sql = `DELETE FROM ${this.table}`;
    if (this.whereClauses.length) sql += ' WHERE ' + this.whereClauses.join(' AND ');
    const result = await execute(sql, this.bindings);
    return result.affectedRows;
  }

  async raw(sql: string, bindings: any[] = []): Promise<any> { return query(sql, bindings); }

  /**
   * Paginate results
   * @param page - Current page (1-indexed)
   * @param perPage - Items per page
   */
  async paginate(page: number = 1, perPage: number = 15): Promise<{
    data: T[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    from: number;
    to: number;
  }> {
    // Get total count
    const countBuilder = new QueryBuilderImpl<T>(this.table, this.modelClass);
    countBuilder.whereClauses = [...this.whereClauses];
    countBuilder.bindings = [...this.bindings];
    const total = await countBuilder.count();
    
    // Calculate pagination
    const lastPage = Math.ceil(total / perPage) || 1;
    const currentPage = Math.max(1, Math.min(page, lastPage));
    const offset = (currentPage - 1) * perPage;
    
    // Get data
    this.limitVal = perPage;
    this.offsetVal = offset;
    const data = await this.get();
    
    return {
      data,
      total,
      perPage,
      currentPage,
      lastPage,
      from: offset + 1,
      to: Math.min(offset + perPage, total),
    };
  }
}

// Base Model class
export abstract class Model {
  protected static tableName: string;
  protected static primaryKey: string = 'id';
  protected static timestamps: boolean = true;
  
  // Instance properties
  [key: string]: any;
  
  // Relations storage
  public relations: Record<string, any> = {};

  constructor(data?: any) {
    if (data) Object.assign(this, data);
  }



  /**
   * Define hasOne relationship
   */
  protected hasOne<T extends Model>(relatedClass: { new (): T } & typeof Model, foreignKey?: string, localKey: string = 'id'): QueryBuilder<T> {
    const fk = foreignKey || `${this.constructor.name.toLowerCase()}_id`;
    const qb = relatedClass.query<T>().where(fk, '=', this[localKey]).limit(1);
    
    (qb as any)._relationInfo = {
      type: 'hasOne',
      relatedClass: relatedClass,
      foreignKey: fk,
      localKey
    };
    
    return qb;
  }

  /**
   * Define hasMany relationship
   */
  protected hasMany<T extends Model>(relatedClass: { new (): T } & typeof Model, foreignKey?: string, localKey: string = 'id'): QueryBuilder<T> {
    const fk = foreignKey || `${this.constructor.name.toLowerCase()}_id`;
    const qb = relatedClass.query<T>().where(fk, '=', this[localKey]);
    
    (qb as any)._relationInfo = {
      type: 'hasMany',
      relatedClass: relatedClass,
      foreignKey: fk,
      localKey
    };
    
    return qb;
  }

  /**
   * Define belongsTo relationship
   */
  protected belongsTo<T extends Model>(relatedClass: { new (): T } & typeof Model, foreignKey?: string, ownerKey: string = 'id'): QueryBuilder<T> {
    const fk = foreignKey || `${relatedClass.name.toLowerCase()}_id`;
    let qb: QueryBuilder<T>;
    
    if (!this[fk]) {
       // Return empty query if FK is missing
       qb = relatedClass.query<T>().where(ownerKey, '=', null).limit(1);
    } else {
       qb = relatedClass.query<T>().where(ownerKey, '=', this[fk]).limit(1);
    }

    (qb as any)._relationInfo = {
      type: 'belongsTo',
      relatedClass: relatedClass,
      foreignKey: fk,
      ownerKey
    };
    
    return qb;
  }
  
  /**
   * Define belongsToMany relationship (ManyToMany)
   * Assumes pivot table name is alphabetical order of model names joined by underscore
   */
  protected belongsToMany<T extends Model>(
    relatedClass: { new (): T } & typeof Model, 
    pivotTable?: string, 
    foreignPivotKey?: string, 
    relatedPivotKey?: string
  ): QueryBuilder<T> {
    const relatedName = relatedClass.name.toLowerCase();
    const thisName = this.constructor.name.toLowerCase();
    
    // Default pivot table name: alphabetical order (e.g., role_user)
    const table = pivotTable || [relatedName, thisName].sort().join('_');
    
    // Keys
    const fk = foreignPivotKey || `${thisName}_id`;
    const rk = relatedPivotKey || `${relatedName}_id`;
    
    const builder = relatedClass.query<T>();
    
    const sql = `id IN (SELECT ${rk} FROM ${table} WHERE ${fk} = ?)`;
    // We pass the binding
    const qb = builder.whereRaw(sql, [this['id']]);
    
    (qb as any)._relationInfo = {
      type: 'belongsToMany',
      relatedClass: relatedClass,
      pivotTable: table,
      foreignPivotKey: fk,
      relatedPivotKey: rk
    };
    
    return qb;
  }
  static table<T extends Model>(this: new () => T): QueryBuilder<T> {
    return new QueryBuilderImpl<T>((this as any).tableName, this);
  }

  // Find by ID - returns Instance
  static async find<T extends Model>(this: { new (): T } & typeof Model, id: number | string): Promise<T | null> {
    return this.table<T>().where(this.primaryKey, '=', id).first();
  }

  // Chainable query builder
  static query<T extends Model>(this: { new (): T } & typeof Model): QueryBuilder<T> {
    return new QueryBuilderImpl<T>(this.tableName, this);
  }

  static async all<T extends Model>(this: { new (): T } & typeof Model): Promise<T[]> {
    return this.query<T>().get();
  }

  // Init relation storage
  startRelation(name: string) {
    if (!this.relations) this.relations = {};
  }
  
  // Lazy load relations
  async load(...relations: string[]): Promise<this> {
     // Create a builder just to use its eagerLoad ability
     const builder = new QueryBuilderImpl<any>((this.constructor as any).tableName, this.constructor);
     builder.with(...relations);
     await builder.eagerLoad([this]);
     return this;
  }
  
  // Start Eager Loading
  static with<T extends Model>(this: { new (): T } & typeof Model, ...relations: string[]): QueryBuilder<T> {
    return this.query<T>().with(...relations);
  }

  // Helper to fill data (chainable)
  fill(data: any): this {
    Object.assign(this, data);
    return this;
  }

  // Create - returns Instance
  static async create<T extends Model>(this: { new (): T } & typeof Model, data: Partial<T>): Promise<T> {
    if (this.timestamps) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      (data as any).created_at = now;
      (data as any).updated_at = now;
    }
    return this.query<T>().insert(data);
  }

  static async updateById<T>(id: number | string, data: Partial<T>): Promise<number> {
    if (this.timestamps) {
      (data as any).updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    return new QueryBuilderImpl<any>(this.tableName).where(this.primaryKey, '=', id).update(data);
  }

  static async deleteById(id: number | string): Promise<number> {
    return new QueryBuilderImpl<any>(this.tableName).where(this.primaryKey, '=', id).delete();
  }
  

}

export { query, execute };
export default Model;
