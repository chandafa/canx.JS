/**
 * CanxJS Model - Zero-config ORM with MySQL primary, PostgreSQL secondary
 */

import type { DatabaseConfig, DatabaseDriver, ModelField, ModelSchema, QueryBuilder, CastType } from '../types';

// Database connection state.
// Stored on globalThis so the state stays shared even if this module is
// loaded more than once (e.g. duplicate package instances / path-case
// differences on Windows).
interface DbState {
  mysqlPool: any;
  pgPool: any;
  sqliteDb: any;
  currentDriver: DatabaseDriver;
  dbConfig: DatabaseConfig | null;
}

const DB_STATE_KEY = Symbol.for('canxjs.database.state');
const dbState: DbState = ((globalThis as any)[DB_STATE_KEY] ??= {
  mysqlPool: null,
  pgPool: null,
  sqliteDb: null,
  currentDriver: 'mysql',
  dbConfig: null,
} satisfies DbState);

// Registry of model classes keyed by class name, used to resolve the related
// class for polymorphic `morphTo` relations (the `<name>_type` column stores
// the class name). On globalThis so it survives duplicate module copies.
const MODEL_REGISTRY_KEY = Symbol.for('canxjs.model.registry');
const modelRegistry: Map<string, any> = ((globalThis as any)[MODEL_REGISTRY_KEY] ??= new Map());
function registerModel(cls: any): void {
  if (cls && cls.name && (cls as any).tableName) {
    modelRegistry.set(cls.name, cls);
  }
}

export async function initDatabase(config: DatabaseConfig): Promise<void> {
  dbState.dbConfig = config;
  dbState.currentDriver = config.driver;

  if (config.driver === 'mysql') {
    const mysql = await import('mysql2/promise');
    dbState.mysqlPool = mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
      waitForConnections: true,
      connectionLimit: config.pool?.max || 10,
      queueLimit: 0,
    });

    if (config.logging) console.log('[CanxJS] MySQL connection pool created');
  } else if (config.driver === 'postgresql') {
    const { Pool } = await import('pg');
    dbState.pgPool = new Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.pool?.max || 10,
      idleTimeoutMillis: config.pool?.idle || 30000,
    });

    if (config.logging) console.log('[CanxJS] PostgreSQL connection pool created');
  } else if (config.driver === 'sqlite') {
    const { Database } = await import('bun:sqlite');
    dbState.sqliteDb = new Database(config.database);

    if (config.logging) console.log('[CanxJS] SQLite database connected');
  }
}

export async function closeDatabase(): Promise<void> {
  if (dbState.mysqlPool) { await dbState.mysqlPool.end(); dbState.mysqlPool = null; }
  if (dbState.pgPool) { await dbState.pgPool.end(); dbState.pgPool = null; }
  if (dbState.sqliteDb) { dbState.sqliteDb.close(); dbState.sqliteDb = null; }
}

export function getCurrentDriver(): DatabaseDriver {
  return dbState.currentDriver;
}

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (dbState.dbConfig?.logging) console.log('[SQL]', sql, params);

  if (dbState.currentDriver === 'mysql' && dbState.mysqlPool) {
    const [rows] = await dbState.mysqlPool.execute(sql, params);
    return rows as T[];
  } else if (dbState.currentDriver === 'postgresql' && dbState.pgPool) {
    // Convert ? placeholders to $1, $2 for PostgreSQL
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await dbState.pgPool.query(pgSql, params);
    return result.rows as T[];
  } else if (dbState.currentDriver === 'sqlite' && dbState.sqliteDb) {
    const query = dbState.sqliteDb.query(sql);
    // bun:sqlite uses $1, $2 or named params, but handle simple ? for compatibility?
    // Bun sqlite actually supports ? binding since recent versions or via .all(...params)
    // Let's try direct binding.
    return query.all(...params) as T[];
  }
  throw new Error('No database connection');
}

async function execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId: number }> {
  if (dbState.dbConfig?.logging) console.log('[SQL]', sql, params);

  if (dbState.currentDriver === 'mysql' && dbState.mysqlPool) {
    const [result] = await dbState.mysqlPool.execute(sql, params);
    return { affectedRows: result.affectedRows, insertId: result.insertId };
  } else if (dbState.currentDriver === 'postgresql' && dbState.pgPool) {
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    // Only INSERTs need RETURNING (to get the new id). Appending it to DDL
    // (CREATE/DROP/ALTER) or UPDATE/DELETE is a Postgres syntax error.
    const isInsert = /^\s*insert\b/i.test(pgSql);
    const finalSql = isInsert ? `${pgSql} RETURNING *` : pgSql;
    const result = await dbState.pgPool.query(finalSql, params);
    return { affectedRows: result.rowCount || 0, insertId: result.rows?.[0]?.id || 0 };
  } else if (dbState.currentDriver === 'sqlite' && dbState.sqliteDb) {
    const query = dbState.sqliteDb.query(sql);
    const result = query.run(...params);
    return { affectedRows: result.changes, insertId: result.lastInsertRowid };
  }
  throw new Error('No database connection');
}

// Relation Metadata interface
interface RelationInfo {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany' | 'morphTo' | 'morphOne' | 'morphMany' | 'hasManyThrough';
  relatedClass: any;
  foreignKey: string;
  localKey?: string;
  ownerKey?: string;
  pivotTable?: string;
  foreignPivotKey?: string;
  relatedPivotKey?: string;
  parentId?: any;
  /** Extra pivot columns automatically applied on attach/detach and pivot queries (e.g. morph type) */
  pivotDefaults?: Record<string, any>;
  morphName?: string;
  morphType?: string;
  morphId?: string;
  throughClass?: any;
  firstKey?: string;
  secondKey?: string;
}

// Observer Interface
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

// Cast Types definition moved to types/index.ts

// Identifier + operator validation to prevent SQL injection via column names
// and comparison operators (both are interpolated straight into SQL).
const IDENT_RE = /^[a-zA-Z0-9_.]+$/;
const ALLOWED_OPERATORS = new Set([
  '=', '!=', '<>', '<', '>', '<=', '>=', '<=>',
  'like', 'not like', 'ilike', 'not ilike', 'in', 'not in', 'is', 'is not',
  'regexp', 'not regexp', 'rlike', 'between',
]);

function assertIdentifier(id: string, kind = 'identifier'): void {
  if (typeof id === 'string' && !IDENT_RE.test(id)) {
    throw new Error(`Invalid ${kind}: ${id}`);
  }
}

function assertOperator(op: string): void {
  if (typeof op !== 'string' || !ALLOWED_OPERATORS.has(op.trim().toLowerCase())) {
    throw new Error(`Invalid SQL operator: ${op}`);
  }
}

/**
 * Convert cast-declared attributes to their storage representation.
 * Idempotent (safe to run on already-prepared data), so it can be applied in
 * both Model.save() and the QueryBuilder insert/update paths.
 */
function prepareForStorage(modelClass: any, data: Record<string, any>): Record<string, any> {
  const casts: Record<string, any> = modelClass ? (new modelClass() as any).casts || {} : {};
  if (!casts || Object.keys(casts).length === 0) return data;
  const out: Record<string, any> = { ...data };
  for (const key of Object.keys(out)) {
    const type = casts[key];
    if (!type) continue;
    const value = out[key];
    if (value === null || value === undefined) continue;
    switch (type) {
      case 'json':
      case 'array':
      case 'collection':
        if (typeof value === 'object') out[key] = JSON.stringify(value);
        break;
      case 'bool':
      case 'boolean':
        out[key] = value ? 1 : 0;
        break;
      case 'date':
      case 'datetime':
        if (value instanceof Date) out[key] = value.toISOString().slice(0, 19).replace('T', ' ');
        break;
    }
  }
  return out;
}

// Query Builder implementation
export class QueryBuilderImpl<T> implements QueryBuilder<T> {
  private table: string;
  private selectCols: string[] = ['*'];
  // Each clause carries its boolean connector so SQL's native precedence
  // (AND binds tighter than OR) yields Laravel-correct grouping:
  //   where(a).where(b).orWhere(c)  ->  a AND b OR c  ==  (a AND b) OR c
  private whereClauses: Array<{ boolean: 'AND' | 'OR'; sql: string }> = [];
  private orderClauses: string[] = [];
  private limitVal?: number;
  private offsetVal?: number;
  private joinClauses: string[] = [];
  private groupClauses: string[] = [];
  private havingClauses: string[] = [];
  private bindings: any[] = [];
  
  // Model mapping
  private modelClass?: any;
  private withTrashed: boolean = false;
  
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
    // Security: validate column name AND operator (both interpolated into SQL)
    assertIdentifier(col, 'column name');
    assertOperator(op);
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} ${op} ?` });
    this.bindings.push(val);
    return this;
  }

  whereIn(col: any, vals: any[]): this {
    if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col)) {
        throw new Error(`Invalid column name: ${col}`);
    }
    if (vals.length === 0) {
       this.whereClauses.push({ boolean: 'AND', sql: '1 = 0' }); // False condition if empty
       return this;
    }
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} IN (${vals.map(() => '?').join(',')})` });
    this.bindings.push(...vals);
    return this;
  }

  whereNull(col: any): this {
    if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col)) throw new Error(`Invalid column name: ${col}`);
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} IS NULL` }); return this;
  }
  whereNotNull(col: any): this {
    if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col)) throw new Error(`Invalid column name: ${col}`);
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} IS NOT NULL` }); return this;
  }

  orWhere(col: any, op: string, val: any): this {
    assertIdentifier(col, 'column name');
    assertOperator(op);
    // Push with an OR connector; SQL precedence groups `a AND b OR c` as
    // `(a AND b) OR c`, matching Laravel — no manual paren-wrapping needed.
    this.whereClauses.push({ boolean: 'OR', sql: `${String(col)} ${op} ?` });
    this.bindings.push(val);
    return this;
  }

  orderBy(col: any, dir: 'asc' | 'desc' = 'asc'): this {
    if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col)) throw new Error(`Invalid column name: ${col}`);
    this.orderClauses.push(`${String(col)} ${dir.toUpperCase()}`);
    return this;
  }
  
  limit(n: number): this { this.limitVal = n; return this; }
  offset(n: number): this { this.offsetVal = n; return this; }

  join(table: string, first: string, op: string, second: string): this {
    assertIdentifier(table, 'table name');
    assertIdentifier(first, 'identifier');
    assertIdentifier(second, 'identifier');
    assertOperator(op);
    this.joinClauses.push(`INNER JOIN ${table} ON ${first} ${op} ${second}`);
    return this;
  }
  
  leftJoin(table: string, first: string, op: string, second: string): this {
    assertIdentifier(table, 'table name');
    assertIdentifier(first, 'identifier');
    assertIdentifier(second, 'identifier');
    assertOperator(op);
    this.joinClauses.push(`LEFT JOIN ${table} ON ${first} ${op} ${second}`);
    return this;
  }

  groupBy(...cols: any[]): this {
    cols.forEach((c) => assertIdentifier(c, 'group by column'));
    this.groupClauses = cols.map(String);
    return this;
  }

  having(col: any, op: string, val: any): this {
    assertIdentifier(col, 'having column');
    assertOperator(op);
    this.havingClauses.push(`${String(col)} ${op} ?`);
    this.bindings.push(val);
    return this;
  }
  
  whereRaw(sql: string, bindings: any[] = []): this {
    this.whereClauses.push({ boolean: 'AND', sql });
    this.bindings.push(...bindings);
    return this;
  }
  
  // Eager Loading
  with(...relations: string[]): this {
    this.withRelations.push(...relations);
    return this;
  }

  // Join the where clauses respecting their AND/OR connectors. The first
  // clause has no leading connector.
  private buildWhere(): string {
    return this.whereClauses
      .map((c, i) => (i === 0 ? c.sql : `${c.boolean} ${c.sql}`))
      .join(' ');
  }

  private hasOrClause(): boolean {
    return this.whereClauses.some((c, i) => i > 0 && c.boolean === 'OR');
  }

  private buildSelect(): string {
    let sql = `SELECT ${this.selectCols.join(', ')} FROM ${this.table}`;
    if (this.joinClauses.length) sql += ' ' + this.joinClauses.join(' ');

    const userWhere = this.whereClauses.length ? this.buildWhere() : '';

    // Soft Deletes Scope
    let softDelete = '';
    if (this.modelClass && (this.modelClass as any).softDeletes && !this.withTrashed) {
       const deletedAtCol = (this.modelClass as any).deletedAtColumn || 'deleted_at';
       // Only skip the scope if a clause references deleted_at as a whole word
       // (not a mere substring like `deleted_at_by`, which shouldn't count).
       const deletedWordRe = new RegExp(`(^|[^a-zA-Z0-9_])${deletedAtCol}([^a-zA-Z0-9_]|$)`);
       const hasDeletedClause = this.whereClauses.some(c => deletedWordRe.test(c.sql));
       if (!hasDeletedClause) {
          softDelete = `${this.table}.${deletedAtCol} IS NULL`;
       }
    }

    if (userWhere && softDelete) {
      // Wrap user clauses so a global AND doesn't bind only to a trailing OR
      // branch: `WHERE (a AND b OR c) AND deleted_at IS NULL`.
      const wrapped = this.hasOrClause() ? `(${userWhere})` : userWhere;
      sql += ` WHERE ${wrapped} AND ${softDelete}`;
    } else if (userWhere) {
      sql += ` WHERE ${userWhere}`;
    } else if (softDelete) {
      sql += ` WHERE ${softDelete}`;
    }

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
      // Hydration from the database bypasses mass-assignment protection
      results = rows.map(r => new this.modelClass().forceFill(r));
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
          const pivotDefaultKeys = Object.keys(info.pivotDefaults || {});
          const pivotDefaultFilter = pivotDefaultKeys.map(k => ` AND ${k} = ?`).join('');
          const pivotSql = `SELECT * FROM ${info.pivotTable} WHERE ${info.foreignPivotKey} IN (${uniqueIds.map(() => '?').join(',')})${pivotDefaultFilter}`;
          const pivotRows = await query<any>(pivotSql, [...uniqueIds, ...pivotDefaultKeys.map(k => info.pivotDefaults![k])]);
          
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
      } else if (info.type === 'morphOne' || info.type === 'morphMany') {
          // Polymorphic relation loading
          const localKey = (info as any).localKey || 'id';
          const morphId = (info as any).morphId; // e.g. imageable_id
          const morphType = (info as any).morphType; // e.g. imageable_type
          const morphTypeName = this.modelClass.name; // e.g. 'User'
          
          const parentIds = results.map(r => r[localKey]).filter(id => id !== undefined && id !== null);
          if (parentIds.length === 0) continue;
          const uniqueIds = [...new Set(parentIds)];
          
          // Fetch related where morphId IN (ids) AND morphType = 'ParentClassName'
          const relatedResults = await info.relatedClass.query()
              .whereIn(morphId, uniqueIds)
              .where(morphType, '=', morphTypeName)
              .get();
          
          // Map back
          for (const parent of results) {
             const parentId = parent[localKey];
             parent.startRelation(relationName);
             
             if (info.type === 'morphOne') {
                parent.relations[relationName] = relatedResults.find((r: any) => r[morphId] == parentId) || null;
             } else {
                parent.relations[relationName] = relatedResults.filter((r: any) => r[morphId] == parentId);
             }
          }
      } else if (info.type === 'hasManyThrough') {
          const localKey = info.localKey || 'id';
          const firstKey = info.firstKey!;   // FK on through table pointing to parent
          const secondKey = info.secondKey!; // FK on related table pointing to through

          const parentIds = results.map(r => r[localKey]).filter(id => id !== undefined && id !== null);
          if (parentIds.length === 0) continue;
          const uniqueIds = [...new Set(parentIds)];

          const relatedTable = (info.relatedClass as any).tableName;
          const throughTable = (info.throughClass as any).tableName;

          const sql = `SELECT ${relatedTable}.*, ${throughTable}.${firstKey} AS __through_key FROM ${relatedTable} ` +
              `INNER JOIN ${throughTable} ON ${throughTable}.id = ${relatedTable}.${secondKey} ` +
              `WHERE ${throughTable}.${firstKey} IN (${uniqueIds.map(() => '?').join(',')})`;
          const rows = await query<any>(sql, uniqueIds);

          for (const parent of results) {
             const parentId = parent[localKey];
             parent.startRelation(relationName);
             parent.relations[relationName] = rows
                 .filter((r: any) => r.__through_key == parentId)
                 .map((r: any) => {
                    const { __through_key, ...attrs } = r;
                    return new (info.relatedClass as any)().forceFill(attrs);
                 });
          }
      } else if (info.type === 'morphTo') {
          // Inverse polymorphic: parents may point at DIFFERENT related models.
          const typeCol = (info as any).morphType;
          const idCol = (info as any).morphId;

          // Group the ids we need to load, per related type.
          const idsByType = new Map<string, Set<any>>();
          for (const p of results) {
            const tv = p[typeCol];
            const iv = p[idCol];
            if (!tv || iv === undefined || iv === null) continue;
            if (!idsByType.has(tv)) idsByType.set(tv, new Set());
            idsByType.get(tv)!.add(iv);
          }

          // Load each type's rows, indexed by primary key.
          const loadedByType = new Map<string, Map<any, any>>();
          for (const [tv, idSet] of idsByType) {
            const cls = modelRegistry.get(tv);
            if (!cls) continue;
            const pk = (cls as any).primaryKey || 'id';
            const rows = await cls.query().whereIn(pk, [...idSet]).get();
            const byId = new Map<any, any>();
            for (const row of rows) byId.set(row[pk], row);
            loadedByType.set(tv, byId);
          }

          for (const parent of results) {
            parent.startRelation(relationName);
            const tv = parent[typeCol];
            const iv = parent[idCol];
            const byId = tv ? loadedByType.get(tv) : undefined;
            parent.relations[relationName] = byId ? (byId.get(iv) || null) : null;
          }
      }
    }
  }
  
  async first(): Promise<T | null> {
    // Do not permanently mutate the builder — restore limit afterwards so the
    // same builder can be reused (e.g. await q.first(); await q.get()).
    const prevLimit = this.limitVal;
    this.limitVal = 1;
    try {
      const rows = await this.get();
      return rows[0] || null;
    } finally {
      this.limitVal = prevLimit;
    }
  }

  /**
   * Run an aggregate (COUNT/SUM/AVG) without corrupting builder state:
   * temporarily swaps select columns and drops order/limit/offset, then restores.
   */
  private async runAggregate(expr: string): Promise<number> {
    const prevSel = this.selectCols;
    const prevOrder = this.orderClauses;
    const prevLimit = this.limitVal;
    const prevOffset = this.offsetVal;
    this.selectCols = [expr];
    this.orderClauses = [];
    this.limitVal = undefined;
    this.offsetVal = undefined;
    try {
      const r = await query<any>(this.buildSelect(), this.bindings);
      return Number((r[0] as any)?.agg) || 0;
    } finally {
      this.selectCols = prevSel;
      this.orderClauses = prevOrder;
      this.limitVal = prevLimit;
      this.offsetVal = prevOffset;
    }
  }

  async count(): Promise<number> { return this.runAggregate('COUNT(*) as agg'); }
  async sum(col: any): Promise<number> { assertIdentifier(col, 'column'); return this.runAggregate(`SUM(${String(col)}) as agg`); }
  async avg(col: any): Promise<number> { assertIdentifier(col, 'column'); return this.runAggregate(`AVG(${String(col)}) as agg`); }

  async insert(data: Partial<T> | Partial<T>[]): Promise<T> {
    let items = Array.isArray(data) ? data : [data];
    
    // Auto-timestamps
    if (this.modelClass && (this.modelClass as any).timestamps) {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const createdAt = (this.modelClass as any).createdAtColumn || 'created_at';
        const updatedAt = (this.modelClass as any).updatedAtColumn || 'updated_at';
        
        items = items.map(item => ({
            ...item,
            [createdAt]: (item as any)[createdAt] || now,
            [updatedAt]: (item as any)[updatedAt] || now,
        }));
    }

    // Serialize cast columns (json/bool/date) so QueryBuilder.insert() matches
    // Model.create() behavior. Idempotent, so double-preparing is harmless.
    if (this.modelClass) {
      items = items.map(item => prepareForStorage(this.modelClass, item as any)) as any;
    }

    const keys = Object.keys(items[0]!);
    const values = items.map(item => keys.map(k => (item as any)[k]));
    const placeholders = values.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders}`;
    const result = await execute(sql, values.flat());
    
    if (this.modelClass) {
       return new this.modelClass().forceFill({ ...(items[0] as any), id: result.insertId });
    }
    return { ...(items[0] as any), id: result.insertId } as T;
  }

  async update(data: Partial<T>): Promise<number> {
    let updateData: Record<string, any> = { ...data };

    // Serialize cast columns (json/bool/date) — idempotent.
    if (this.modelClass) {
      updateData = prepareForStorage(this.modelClass, updateData);
    }

    // Auto-timestamps
    if (this.modelClass && (this.modelClass as any).timestamps) {
        const updatedAt = (this.modelClass as any).updatedAtColumn || 'updated_at';
        if (!(updateData as any)[updatedAt]) {
            (updateData as any)[updatedAt] = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
    }

    const keys = Object.keys(updateData);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => (updateData as any)[k]);
    
    let sql = `UPDATE ${this.table} SET ${sets}`;
    if (this.whereClauses.length) sql += ' WHERE ' + this.buildWhere();

    const result = await execute(sql, [...vals, ...this.bindings]);
    return result.affectedRows;
  }

  async delete(): Promise<number> {
    if (this.modelClass && (this.modelClass as any).softDeletes && !this.withTrashed) { // Allow force delete logic if explicit
        const deletedAtCol = (this.modelClass as any).deletedAtColumn || 'deleted_at';
        return this.update({ [deletedAtCol]: new Date().toISOString().slice(0, 19).replace('T', ' ') } as any);
    }

    let sql = `DELETE FROM ${this.table}`;
    if (this.whereClauses.length) sql += ' WHERE ' + this.buildWhere();
    const result = await execute(sql, this.bindings);
    return result.affectedRows;
  }

  async forceDelete(): Promise<number> {
     let sql = `DELETE FROM ${this.table}`;
     if (this.whereClauses.length) sql += ' WHERE ' + this.buildWhere();
     const result = await execute(sql, this.bindings);
     return result.affectedRows;
  }

  withTrashedResults(): this {
    this.withTrashed = true;
    return this;
  }

  // ============================
  // Pivot operations (belongsToMany)
  // ============================

  private assertPivotRelation(): RelationInfo {
    const info = this._relationInfo;
    if (!info || info.type !== 'belongsToMany' || !info.pivotTable) {
      throw new Error('attach/detach/sync can only be called on a belongsToMany relation');
    }
    if (info.parentId === undefined || info.parentId === null) {
      throw new Error('Cannot modify pivot table: parent model has no primary key value');
    }
    return info;
  }

  async attach(ids: number | string | (number | string)[], pivotData: Record<string, any> = {}): Promise<void> {
    const info = this.assertPivotRelation();
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return;

    const data = { ...(info.pivotDefaults || {}), ...pivotData };
    const extraKeys = Object.keys(data);
    const cols = [info.foreignPivotKey!, info.relatedPivotKey!, ...extraKeys];

    const defaultKeys = Object.keys(info.pivotDefaults || {});
    const defaultFilter = defaultKeys.map(k => ` AND ${k} = ?`).join('');
    const defaultVals = defaultKeys.map(k => info.pivotDefaults![k]);

    for (const id of list) {
      // Avoid duplicate pivot rows
      const existing = await query(
        `SELECT ${info.relatedPivotKey} FROM ${info.pivotTable} WHERE ${info.foreignPivotKey} = ? AND ${info.relatedPivotKey} = ?${defaultFilter}`,
        [info.parentId, id, ...defaultVals]
      );
      if (existing.length > 0) continue;

      await execute(
        `INSERT INTO ${info.pivotTable} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        [info.parentId, id, ...extraKeys.map(k => data[k])]
      );
    }
  }

  async detach(ids?: number | string | (number | string)[]): Promise<void> {
    const info = this.assertPivotRelation();

    const defaultKeys = Object.keys(info.pivotDefaults || {});
    const defaultFilter = defaultKeys.map(k => ` AND ${k} = ?`).join('');
    const defaultVals = defaultKeys.map(k => info.pivotDefaults![k]);

    if (ids === undefined) {
      await execute(
        `DELETE FROM ${info.pivotTable} WHERE ${info.foreignPivotKey} = ?${defaultFilter}`,
        [info.parentId, ...defaultVals]
      );
      return;
    }

    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return;

    await execute(
      `DELETE FROM ${info.pivotTable} WHERE ${info.foreignPivotKey} = ? AND ${info.relatedPivotKey} IN (${list.map(() => '?').join(',')})${defaultFilter}`,
      [info.parentId, ...list, ...defaultVals]
    );
  }

  async sync(ids: (number | string)[], pivotData: Record<string, any> = {}): Promise<void> {
    this.assertPivotRelation();
    await this.detach();
    await this.attach(ids, pivotData);
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
    // Count over the FULL query (wrapping it in a subquery), so joins, GROUP BY
    // and HAVING are all reflected in the total and the bindings always match.
    const prevLimit = this.limitVal;
    const prevOffset = this.offsetVal;
    const prevOrder = this.orderClauses;
    this.limitVal = undefined;
    this.offsetVal = undefined;
    this.orderClauses = [];
    const innerSql = this.buildSelect();
    this.limitVal = prevLimit;
    this.offsetVal = prevOffset;
    this.orderClauses = prevOrder;

    const countRows = await query<any>(`SELECT COUNT(*) as total FROM (${innerSql}) as __cnt`, this.bindings);
    const total = Number(countRows[0]?.total) || 0;

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
export abstract class Model<T = any> {
  protected static tableName: string;
  protected static primaryKey: string = 'id';
  protected static timestamps: boolean = true;
  protected static softDeletes: boolean = false;
  protected static deletedAtColumn: string = 'deleted_at';
  
  // Mass Assignment Protection
  protected static fillable: string[] = [];
  protected static guarded: string[] = ['id', 'created_at', 'updated_at', 'deleted_at'];

  // Observers
  protected static observers: ModelObserver[] = [];
  
  // Casting
  protected casts: Record<string, CastType> = {};
  
  // Instance properties
  [key: string]: any;
  
  // Relations storage
  public relations: Record<string, any> = {};

  constructor(data?: any) {
    if (data) this.fill(data);
  }

  /**
   * Create a new query builder for this model.
   */
  // Duplicate methods removed - verify subsequent duplicates manually if needed

  /**
   * Add a basic where clause to the query.
   */


  // ============================
  // Observer Registration
  // ============================
  static observe(observer: ModelObserver) {
    this.observers.push(observer);
  }

  protected async fireEvent(event: keyof ModelObserver): Promise<void> {
    for (const observer of (this.constructor as typeof Model).observers) {
       const handler = observer[event];
       if (typeof handler === 'function') {
         await (handler as Function)(this);
       }
    }
  }

  // ============================
  // Attribute Casting & Accessors
  // ============================
  
  // Helper to cast value based on type
  private castAttribute(key: string, value: any): any {
    if (value === null || value === undefined) return value;
    
    const type = this.casts[key];
    if (!type) return value;

    switch (type) {
      case 'int':
      case 'integer':
        return parseInt(value);
      case 'real':
      case 'float':
      case 'double':
        return parseFloat(value);
      case 'string':
        return String(value);
      case 'bool':
      case 'boolean':
        return value === 1 || value === '1' || value === true || value === 'true';
      case 'json':
      case 'array':
      case 'collection':
        return typeof value === 'string' ? JSON.parse(value) : value;
      case 'date':
      case 'datetime':
        return new Date(value);
      case 'timestamp':
        return new Date(value).getTime();
      default:
        return value;
    }
  }

  // Prepares data for database storage
  private prepareAttributeForStorage(key: string, value: any): any {
     const type = this.casts[key];
     if (!type) return value;

     switch(type) {
         case 'json':
         case 'array':
         case 'collection':
             return typeof value === 'object' ? JSON.stringify(value) : value;
         case 'bool':
         case 'boolean':
             return value ? 1 : 0;
         case 'date':
         case 'datetime':
             return value instanceof Date ? value.toISOString().slice(0, 19).replace('T', ' ') : value;
         default: 
             return value;
     }
  }

  // Override fill to handle casting and mass assignment protection
  fill(data: any): this {
    const Ctor = this.constructor as typeof Model;
    const fillable = Ctor.fillable;
    const guarded = Ctor.guarded;
    
    // Check if fillable is defined and not empty (allow-list mode)
    const isFillableMode = fillable.length > 0;

    for (const key in data) {
       // Filter keys
       if (isFillableMode) {
           if (!fillable.includes(key)) continue;
       } else {
           if (guarded.includes(key)) continue;
       }

       this[key] = this.castAttribute(key, data[key]);
    }
    return this;
  }

  /**
   * Fill attributes without mass-assignment protection.
   * Used when hydrating models from database rows.
   */
  forceFill(data: any): this {
    for (const key in data) {
       if (key === 'relations' || key === 'casts') continue;
       this[key] = this.castAttribute(key, data[key]);
    }
    return this;
  }

  /**
   * Serialize the model to a plain object for JSON responses.
   * Excludes framework internals (`casts`, `relations`) and methods, and
   * merges any eager-loaded relations under their relation name.
   * Called automatically by JSON.stringify (and therefore res.json()).
   */
  toJSON(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of Object.keys(this)) {
      if (key === 'casts' || key === 'relations') continue;
      const value = (this as any)[key];
      if (typeof value === 'function') continue;
      out[key] = value;
    }
    if (this.relations && Object.keys(this.relations).length > 0) {
      for (const [name, related] of Object.entries(this.relations)) {
        out[name] = related;
      }
    }
    return out;
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
    
    // subquery for whereIn
    const sql = `id IN (SELECT ${rk} FROM ${table} WHERE ${fk} = ?)`;
    const qb = builder.whereRaw(sql, [this['id']]);
    
    (qb as any)._relationInfo = {
      type: 'belongsToMany',
      relatedClass: relatedClass,
      pivotTable: table,
      foreignPivotKey: fk,
      relatedPivotKey: rk,
      parentId: this['id']
    };
    
    return qb;
  }

  /**
   * Define morphToMany relationship (polymorphic many-to-many).
   * Pivot table holds `<name>_id` + `<name>_type` columns pointing to this model.
   */
  protected morphToMany<T extends Model>(
    relatedClass: { new (): T } & typeof Model,
    name: string,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    typeColumn?: string
  ): QueryBuilder<T> {
    const relatedName = relatedClass.name.toLowerCase();
    const table = pivotTable || `${name}ables`;
    const fk = foreignPivotKey || `${name}_id`;
    const rk = relatedPivotKey || `${relatedName}_id`;
    const typeCol = typeColumn || `${name}_type`;
    const typeVal = this.constructor.name;

    const builder = relatedClass.query<T>();
    const sql = `id IN (SELECT ${rk} FROM ${table} WHERE ${fk} = ? AND ${typeCol} = ?)`;
    const qb = builder.whereRaw(sql, [this['id'], typeVal]);

    (qb as any)._relationInfo = {
      type: 'belongsToMany',
      relatedClass: relatedClass,
      pivotTable: table,
      foreignPivotKey: fk,
      relatedPivotKey: rk,
      parentId: this['id'],
      pivotDefaults: { [typeCol]: typeVal }
    };

    return qb;
  }

  /**
   * Define morphTo relationship
   */
  protected morphTo(name?: string, type?: string, id?: string, ownerKey: string = 'id'): QueryBuilder<any> {
      const n = name || 'morphable'; // fallback name
      const typeCol = type || `${n}_type`;
      const idCol = id || `${n}_id`;

      // Resolve the related class from the stored `<name>_type` value.
      const typeVal = this[typeCol];
      const relatedClass = typeVal ? modelRegistry.get(typeVal) : null;

      let qb: QueryBuilder<any>;
      if (relatedClass) {
        const rk = (relatedClass as any).primaryKey || ownerKey || 'id';
        const idVal = this[idCol];
        qb = idVal == null
          ? relatedClass.query().whereRaw('1 = 0')
          : relatedClass.query().where(rk, '=', idVal).limit(1);
      } else {
        // Unresolved type (class not registered / null) — return a harmless
        // empty query so lazy access yields null instead of an SQL error.
        qb = new QueryBuilderImpl<any>((this.constructor as any).tableName, this.constructor).whereRaw('1 = 0');
      }

      (qb as any)._relationInfo = {
        type: 'morphTo',
        relatedClass,
        morphName: n,
        morphType: typeCol,
        morphId: idCol,
        ownerKey,
      };

      return qb;
  }

  /**
   * Define morphOne relationship
   */
  protected morphOne<T extends Model>(relatedClass: { new (): T } & typeof Model, name: string, type?: string, id?: string, localKey: string = 'id'): QueryBuilder<T> {
      const typeCol = type || `${name}_type`;
      const idCol = id || `${name}_id`;
      
      const myClass = this.constructor.name;
      
      const qb = relatedClass.query<T>()
          .where(idCol, '=', this[localKey])
          .where(typeCol, '=', myClass)
          .limit(1);

      (qb as any)._relationInfo = {
        type: 'morphOne',
        relatedClass: relatedClass,
        morphName: name,
        morphType: typeCol,
        morphId: idCol,
        localKey
      };
      
      return qb;
  }

  /**
   * Define morphMany relationship
   */
  protected morphMany<T extends Model>(relatedClass: { new (): T } & typeof Model, name: string, type?: string, id?: string, localKey: string = 'id'): QueryBuilder<T> {
      const typeCol = type || `${name}_type`;
      const idCol = id || `${name}_id`;
      const myClass = this.constructor.name;
      
      const qb = relatedClass.query<T>()
          .where(idCol, '=', this[localKey])
          .where(typeCol, '=', myClass);

      (qb as any)._relationInfo = {
        type: 'morphMany',
        relatedClass: relatedClass,
        morphName: name,
        morphType: typeCol,
        morphId: idCol,
        localKey
      };
      
      return qb;
  }

  /**
   * Define hasManyThrough relationship
   */
  protected hasManyThrough<T extends Model>(
      relatedClass: { new (): T } & typeof Model, 
      throughClass: { new (): any } & typeof Model,
      firstKey?: string, // Foreign key on through table
      secondKey?: string, // Foreign key on related table
      localKey: string = 'id', // Local key on this model
      secondLocalKey: string = 'id' // Local key on through model
  ): QueryBuilder<T> {
      const fk1 = firstKey || `${this.constructor.name.toLowerCase()}_id`;
      const fk2 = secondKey || `${throughClass.name.toLowerCase()}_id`;
      
      const relatedTable = (relatedClass as any).tableName;
      const throughTable = (throughClass as any).tableName;
      
      const qb = relatedClass.query<T>();
      
      // Join
      qb.join(throughTable, `${throughTable}.${secondLocalKey}`, '=', `${relatedTable}.${fk2}`)
        .where(`${throughTable}.${fk1}`, '=', this[localKey])
        .select(`${relatedTable}.*`);
        
      (qb as any)._relationInfo = {
          type: 'hasManyThrough',
          relatedClass,
          throughClass,
          firstKey: fk1,
          secondKey: fk2,
          localKey,
      };

      return qb;
  }
  static table<T extends Model>(this: (abstract new (...a: any[]) => T) & typeof Model): QueryBuilder<T> {
    registerModel(this);
    return new QueryBuilderImpl<T>((this as any).tableName, this);
  }

  // Find by ID - returns Instance
  static async find<T extends Model>(this: (abstract new (...a: any[]) => T) & typeof Model, id: number | string): Promise<T | null> {
    return (this as any).table().where((this as any).primaryKey, '=', id).first();
  }

  // Chainable query builder
  static query<T extends Model>(this: (abstract new (...a: any[]) => T) & typeof Model): QueryBuilder<T> {
    registerModel(this);
    return new QueryBuilderImpl<T>((this as any).tableName, this);
  }

  static async all<T extends Model>(this: (abstract new (...a: any[]) => T) & typeof Model): Promise<T[]> {
    return (this as any).query().get();
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
  static with<T extends Model>(this: (abstract new (...a: any[]) => T) & typeof Model, ...relations: string[]): QueryBuilder<T> {
    return (this as any).query().with(...relations);
  }

  // Override save/update/insert logic with hooks
  async save(): Promise<this> {
    const isNew = !this[(this.constructor as typeof Model).primaryKey];
    
    await this.fireEvent('saving');
    
    if (isNew) {
       await this.fireEvent('creating');
       // Prepare data
       const data: any = {};
       for (const key of Object.keys(this)) {
           if (key === 'relations' || key === 'casts' || typeof this[key] === 'function') continue;
           data[key] = this.prepareAttributeForStorage(key, this[key]);
       }
       
       // Add timestamps if enabled
       const ModelClass = this.constructor as typeof Model;
       if (ModelClass.timestamps) {
         const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
         data.created_at = now;
         data.updated_at = now;
       }
       
       // Use direct insert instead of create() to avoid recursion
       const created = await ModelClass.query().insert(data);
       Object.assign(this, created); // Sync ID and timestamps
       
       await this.fireEvent('created');
    } else {
       await this.fireEvent('updating');
       
       const ModelClass = this.constructor as typeof Model;
       const data: any = {};
       // We should only update what's changed, but for now update explicit props
       for (const key of Object.keys(this)) {
          if (key === 'relations' || key === 'casts' || typeof this[key] === 'function') continue;
           data[key] = this.prepareAttributeForStorage(key, this[key]);
       }

       // Exclude ID and immutable/auto-managed timestamp columns:
       // - primary key must never be in SET
       // - created_at is immutable (never rewritten on update)
       // - updated_at is dropped so update() sets a fresh value
       const pk = ModelClass.primaryKey;
       delete data[pk];
       delete data.created_at;
       const updatedAtCol = (ModelClass as any).updatedAtColumn || 'updated_at';
       delete data[updatedAtCol];

       await ModelClass.query()
          .where(pk, '=', this[pk])
          .update(data);

       // Reflect the refreshed updated_at back onto the instance
       this[updatedAtCol] = new Date().toISOString().slice(0, 19).replace('T', ' ');
          
       await this.fireEvent('updated');
    }
    
    await this.fireEvent('saved');
    return this;
  }

  // Delete with hooks
  async delete(): Promise<boolean> {
     await this.fireEvent('deleting');
     
     const pk = (this.constructor as typeof Model).primaryKey;
     await (this.constructor as typeof Model).query().where(pk, '=', this[pk]).delete();
     
     await this.fireEvent('deleted');
     return true;
  }
  
  // Restore (Soft Deletes)
  async restore(): Promise<boolean> {
      if (!(this.constructor as typeof Model).softDeletes) return false;
      
      await this.fireEvent('restoring');
      
      const pk = (this.constructor as typeof Model).primaryKey;
      const deletedAtCol = (this.constructor as typeof Model).deletedAtColumn;
      
      await (this.constructor as typeof Model).query()
              .where(pk, '=', this[pk])
              .update({ [deletedAtCol]: null } as any);
      
      this[deletedAtCol] = null;
      await this.fireEvent('restored');
      return true;
  }

  // Create - returns Instance
  static async create<T extends Model>(this: { new (): T } & typeof Model, data: Partial<T>): Promise<T> {
    const instance = new (this as any)();
    instance.fill(data);
    await instance.save();
    return instance;
  }

  static async updateById<T>(id: number | string, data: Partial<T>): Promise<number> {
    // Pass `this` as the model class so casts + timestamps are applied.
    return new QueryBuilderImpl<any>(this.tableName, this).where(this.primaryKey, '=', id).update(data);
  }

  static async deleteById(id: number | string): Promise<number> {
    // Pass `this` so soft-delete models are soft-deleted, not hard-deleted.
    return new QueryBuilderImpl<any>(this.tableName, this).where(this.primaryKey, '=', id).delete();
  }



  static where<T extends Model>(this: (abstract new (...a: any[]) => T) & typeof Model, col: string | any, op?: string, val?: any): QueryBuilder<T> {
    const qb = (this as any).query() as QueryBuilder<T>;
    if (val === undefined) {
        return qb.where(col, '=', op);
    }
    return qb.where(col, op as string, val);
  }
}

export { query, execute };
export default Model;
