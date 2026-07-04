/**
 * CanxJS Model - Zero-config ORM with MySQL primary, PostgreSQL secondary
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseConfig, DatabaseDriver, ModelField, ModelSchema, QueryBuilder, CastType } from '../types';

// Database connection state.
// Stored on globalThis so the state stays shared even if this module is
// loaded more than once (e.g. duplicate package instances / path-case
// differences on Windows).
interface DbState {
  mysqlPool: any;
  pgPool: any;
  sqliteDb: any;
  // Optional dedicated read-replica pools. When configured, SELECT queries that
  // run OUTSIDE a transaction are routed here; all writes and transactional
  // reads stay on the primary (write) pool for read-your-writes consistency.
  readMysqlPool: any;
  readPgPool: any;
  currentDriver: DatabaseDriver;
  dbConfig: DatabaseConfig | null;
  // A single process-wide manual transaction connection (set by the argument-
  // less beginTransaction()/commit()/rollBack() API). The callback form of
  // `transaction()` uses AsyncLocalStorage instead and is concurrency-safe.
  manualTx: { driver: DatabaseDriver; conn: any } | null;
}

const DB_STATE_KEY = Symbol.for('canxjs.database.state');
const dbState: DbState = ((globalThis as any)[DB_STATE_KEY] ??= {
  mysqlPool: null,
  pgPool: null,
  sqliteDb: null,
  readMysqlPool: null,
  readPgPool: null,
  currentDriver: 'mysql',
  dbConfig: null,
  manualTx: null,
} satisfies DbState);

// Per-async-context transaction connection. When a `transaction(cb)` is active,
// every query/execute inside the callback (across await points) transparently
// runs on this dedicated connection so it participates in the transaction.
interface TxContext { driver: DatabaseDriver; conn: any; }
const txStorage = new AsyncLocalStorage<TxContext>();
// Monotonic counter for unique savepoint names on nested transactions.
let savepointCounter = 0;

// In-process query result cache backing QueryBuilder.remember().
const QUERY_CACHE_KEY = Symbol.for('canxjs.query.cache');
const queryCache: Map<string, { value: any; expires: number }> =
  ((globalThis as any)[QUERY_CACHE_KEY] ??= new Map());
/** Clear all cached query results (invalidate everything set via remember()). */
export function flushQueryCache(): void { queryCache.clear(); }

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

    // Optional read replica(s). `config.read` may be a single host config or an
    // array; we build one pool over all of them (mysql2 balances internally).
    if (config.read) {
      const reads = Array.isArray(config.read) ? config.read : [config.read];
      dbState.readMysqlPool = mysql.createPool({
        host: reads[0]!.host || 'localhost',
        port: reads[0]!.port || 3306,
        database: reads[0]!.database || config.database,
        user: reads[0]!.username || config.username,
        password: reads[0]!.password ?? config.password,
        waitForConnections: true,
        connectionLimit: config.pool?.max || 10,
        queueLimit: 0,
      });
    }

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

    if (config.read) {
      const reads = Array.isArray(config.read) ? config.read : [config.read];
      dbState.readPgPool = new Pool({
        host: reads[0]!.host || 'localhost',
        port: reads[0]!.port || 5432,
        database: reads[0]!.database || config.database,
        user: reads[0]!.username || config.username,
        password: reads[0]!.password ?? config.password,
        max: config.pool?.max || 10,
        idleTimeoutMillis: config.pool?.idle || 30000,
      });
    }

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
  if (dbState.readMysqlPool) { await dbState.readMysqlPool.end(); dbState.readMysqlPool = null; }
  if (dbState.readPgPool) { await dbState.readPgPool.end(); dbState.readPgPool = null; }
  if (dbState.sqliteDb) { dbState.sqliteDb.close(); dbState.sqliteDb = null; }
}

export function getCurrentDriver(): DatabaseDriver {
  return dbState.currentDriver;
}

// mysql2 rejects `undefined` bind params ("must not contain undefined"). Map
// any undefined to SQL NULL so a stray undefined never crashes a query.
function sanitizeParams(params: any[]): any[] {
  return params.map((p) => (p === undefined ? null : p));
}

// Resolve which connection a statement should run on:
//   1. an active AsyncLocalStorage transaction (callback form), else
//   2. a process-wide manual transaction, else
//   3. the pool. For reads, a configured read replica is preferred.
function activeTx(): { driver: DatabaseDriver; conn: any } | null {
  return txStorage.getStore() || dbState.manualTx || null;
}

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  params = sanitizeParams(params);
  if (dbState.dbConfig?.logging) console.log('[SQL]', sql, params);

  const tx = activeTx();

  if (dbState.currentDriver === 'mysql') {
    // Read replica only for non-transactional reads (read-your-writes safety).
    const conn = tx?.conn || dbState.readMysqlPool || dbState.mysqlPool;
    if (!conn) throw new Error('No database connection');
    const [rows] = await conn.execute(sql, params);
    return rows as T[];
  } else if (dbState.currentDriver === 'postgresql') {
    const conn = tx?.conn || dbState.readPgPool || dbState.pgPool;
    if (!conn) throw new Error('No database connection');
    // Convert ? placeholders to $1, $2 for PostgreSQL
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await conn.query(pgSql, params);
    return result.rows as T[];
  } else if (dbState.currentDriver === 'sqlite') {
    const db = tx?.conn || dbState.sqliteDb;
    if (!db) throw new Error('No database connection');
    const query = db.query(sql);
    return query.all(...params) as T[];
  }
  throw new Error('No database connection');
}

async function execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId: number }> {
  params = sanitizeParams(params);
  if (dbState.dbConfig?.logging) console.log('[SQL]', sql, params);

  const tx = activeTx();

  if (dbState.currentDriver === 'mysql') {
    const conn = tx?.conn || dbState.mysqlPool;
    if (!conn) throw new Error('No database connection');
    const [result] = await conn.execute(sql, params);
    return { affectedRows: result.affectedRows, insertId: result.insertId };
  } else if (dbState.currentDriver === 'postgresql') {
    const conn = tx?.conn || dbState.pgPool;
    if (!conn) throw new Error('No database connection');
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    // Only INSERTs need RETURNING (to get the new id). Appending it to DDL
    // (CREATE/DROP/ALTER) or UPDATE/DELETE is a Postgres syntax error.
    const isInsert = /^\s*insert\b/i.test(pgSql);
    const finalSql = isInsert ? `${pgSql} RETURNING *` : pgSql;
    const result = await conn.query(finalSql, params);
    return { affectedRows: result.rowCount || 0, insertId: result.rows?.[0]?.id || 0 };
  } else if (dbState.currentDriver === 'sqlite') {
    const db = tx?.conn || dbState.sqliteDb;
    if (!db) throw new Error('No database connection');
    const query = db.query(sql);
    const result = query.run(...params);
    return { affectedRows: result.changes, insertId: result.lastInsertRowid };
  }
  throw new Error('No database connection');
}

// Run a raw statement on a specific transaction connection (driver-aware).
async function runOnConn(tx: TxContext, sql: string): Promise<void> {
  if (tx.driver === 'mysql') await tx.conn.query(sql);
  else if (tx.driver === 'postgresql') await tx.conn.query(sql);
  else if (tx.driver === 'sqlite') tx.conn.run(sql);
}

/**
 * Run `cb` inside a database transaction. Every query/execute performed within
 * the callback (across await points) runs on a single dedicated connection and
 * is committed atomically, or rolled back if `cb` throws. Nested calls use
 * SAVEPOINTs so an inner failure only rolls back the inner block.
 *
 * @example
 *   await transaction(async () => {
 *     await Account.query().where('id','=',1).update({ balance: 900 });
 *     await Account.query().where('id','=',2).update({ balance: 1100 });
 *   });
 */
export async function transaction<T>(cb: () => Promise<T>): Promise<T> {
  const driver = dbState.currentDriver;

  // Already inside a transaction → use a SAVEPOINT for partial rollback.
  const existing = txStorage.getStore() || dbState.manualTx;
  if (existing) {
    const sp = `canx_sp_${++savepointCounter}`;
    await runOnConn(existing, `SAVEPOINT ${sp}`);
    try {
      const result = await cb();
      await runOnConn(existing, `RELEASE SAVEPOINT ${sp}`);
      return result;
    } catch (e) {
      await runOnConn(existing, `ROLLBACK TO SAVEPOINT ${sp}`);
      throw e;
    }
  }

  if (driver === 'mysql') {
    if (!dbState.mysqlPool) throw new Error('No database connection');
    const conn = await dbState.mysqlPool.getConnection();
    const ctx: TxContext = { driver, conn };
    try {
      await conn.beginTransaction();
      const result = await txStorage.run(ctx, cb);
      await conn.commit();
      return result;
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  } else if (driver === 'postgresql') {
    if (!dbState.pgPool) throw new Error('No database connection');
    const client = await dbState.pgPool.connect();
    const ctx: TxContext = { driver, conn: client };
    try {
      await client.query('BEGIN');
      const result = await txStorage.run(ctx, cb);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  } else if (driver === 'sqlite') {
    const db = dbState.sqliteDb;
    if (!db) throw new Error('No database connection');
    const ctx: TxContext = { driver, conn: db };
    db.run('BEGIN');
    try {
      const result = await txStorage.run(ctx, cb);
      db.run('COMMIT');
      return result;
    } catch (e) {
      try { db.run('ROLLBACK'); } catch {}
      throw e;
    }
  }
  throw new Error('No database connection');
}

/**
 * Begin a process-wide manual transaction. Pair with commit()/rollBack().
 * NOTE: this shares one connection globally and is NOT safe under concurrent
 * requests — prefer the callback form `transaction(cb)` in server code. This
 * form exists for scripts, seeders and REPL use.
 */
export async function beginTransaction(): Promise<void> {
  if (dbState.manualTx) throw new Error('A manual transaction is already active');
  const driver = dbState.currentDriver;
  if (driver === 'mysql') {
    const conn = await dbState.mysqlPool.getConnection();
    await conn.beginTransaction();
    dbState.manualTx = { driver, conn };
  } else if (driver === 'postgresql') {
    const client = await dbState.pgPool.connect();
    await client.query('BEGIN');
    dbState.manualTx = { driver, conn: client };
  } else if (driver === 'sqlite') {
    dbState.sqliteDb.run('BEGIN');
    dbState.manualTx = { driver, conn: dbState.sqliteDb };
  } else {
    throw new Error('No database connection');
  }
}

export async function commit(): Promise<void> {
  const tx = dbState.manualTx;
  if (!tx) throw new Error('No active manual transaction');
  dbState.manualTx = null;
  if (tx.driver === 'mysql') { await tx.conn.commit(); tx.conn.release(); }
  else if (tx.driver === 'postgresql') { await tx.conn.query('COMMIT'); tx.conn.release(); }
  else if (tx.driver === 'sqlite') { tx.conn.run('COMMIT'); }
}

export async function rollBack(): Promise<void> {
  const tx = dbState.manualTx;
  if (!tx) throw new Error('No active manual transaction');
  dbState.manualTx = null;
  if (tx.driver === 'mysql') { await tx.conn.rollback(); tx.conn.release(); }
  else if (tx.driver === 'postgresql') { await tx.conn.query('ROLLBACK'); tx.conn.release(); }
  else if (tx.driver === 'sqlite') { tx.conn.run('ROLLBACK'); }
}

/** Laravel-style DB facade for transactions and raw access. */
export const DB = {
  transaction,
  beginTransaction,
  commit,
  rollBack,
  raw: (sql: string, bindings: any[] = []) => query(sql, bindings),
  statement: (sql: string, bindings: any[] = []) => execute(sql, bindings),
};

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
  private lockMode?: 'update' | 'share';
  // Query result cache (remember): ttl in seconds + optional explicit key.
  private rememberTtl?: number;
  private rememberKey?: string;

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
  
  // Nested condition group: where(q => q.where(...).orWhere(...)) → (a OR b).
  private addNested(boolean: 'AND' | 'OR', cb: (q: QueryBuilderImpl<T>) => void): this {
    const sub = new QueryBuilderImpl<T>(this.table, this.modelClass);
    cb(sub);
    const body = sub.whereClauses
      .map((c, i) => (i === 0 ? c.sql : `${c.boolean} ${c.sql}`))
      .join(' ');
    if (body) {
      this.whereClauses.push({ boolean, sql: `(${body})` });
      this.bindings.push(...sub.bindings);
    }
    return this;
  }

  where(col: any, op?: any, val?: any): this {
    // where(callback) → nested condition group.
    if (typeof col === 'function') return this.addNested('AND', col);
    // where(col, val) shorthand → where(col, '=', val).
    if (val === undefined && op !== undefined) { val = op; op = '='; }
    // Security: validate column name AND operator (both interpolated into SQL)
    assertIdentifier(col, 'column name');
    assertOperator(op);
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} ${op} ?` });
    this.bindings.push(val);
    return this;
  }

  whereIn(col: any, vals: any): this {
    assertIdentifier(col, 'column name');
    // Subquery form: whereIn('id', User.query().select('id').where(...)).
    if (vals instanceof QueryBuilderImpl) {
      this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} IN (${vals.buildSelect()})` });
      this.bindings.push(...vals.bindings);
      return this;
    }
    if (vals.length === 0) {
       this.whereClauses.push({ boolean: 'AND', sql: '1 = 0' }); // False condition if empty
       return this;
    }
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} IN (${vals.map(() => '?').join(',')})` });
    this.bindings.push(...vals);
    return this;
  }

  whereNotIn(col: any, vals: any): this {
    assertIdentifier(col, 'column name');
    if (vals instanceof QueryBuilderImpl) {
      this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} NOT IN (${vals.buildSelect()})` });
      this.bindings.push(...vals.bindings);
      return this;
    }
    if (vals.length === 0) return this; // NOT IN () excludes nothing
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} NOT IN (${vals.map(() => '?').join(',')})` });
    this.bindings.push(...vals);
    return this;
  }

  orWhereIn(col: any, vals: any[]): this {
    assertIdentifier(col, 'column name');
    if (vals.length === 0) { this.whereClauses.push({ boolean: 'OR', sql: '1 = 0' }); return this; }
    this.whereClauses.push({ boolean: 'OR', sql: `${String(col)} IN (${vals.map(() => '?').join(',')})` });
    this.bindings.push(...vals);
    return this;
  }

  whereBetween(col: any, range: [any, any]): this {
    assertIdentifier(col, 'column name');
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} BETWEEN ? AND ?` });
    this.bindings.push(range[0], range[1]);
    return this;
  }

  whereNotBetween(col: any, range: [any, any]): this {
    assertIdentifier(col, 'column name');
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} NOT BETWEEN ? AND ?` });
    this.bindings.push(range[0], range[1]);
    return this;
  }

  whereNull(col: any): this {
    assertIdentifier(col, 'column name');
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} IS NULL` }); return this;
  }
  whereNotNull(col: any): this {
    assertIdentifier(col, 'column name');
    this.whereClauses.push({ boolean: 'AND', sql: `${String(col)} IS NOT NULL` }); return this;
  }
  orWhereNull(col: any): this {
    assertIdentifier(col, 'column name');
    this.whereClauses.push({ boolean: 'OR', sql: `${String(col)} IS NULL` }); return this;
  }
  orWhereNotNull(col: any): this {
    assertIdentifier(col, 'column name');
    this.whereClauses.push({ boolean: 'OR', sql: `${String(col)} IS NOT NULL` }); return this;
  }

  orWhere(col: any, op?: any, val?: any): this {
    if (typeof col === 'function') return this.addNested('OR', col);
    if (val === undefined && op !== undefined) { val = op; op = '='; }
    assertIdentifier(col, 'column name');
    assertOperator(op);
    // Push with an OR connector; SQL precedence groups `a AND b OR c` as
    // `(a AND b) OR c`, matching Laravel — no manual paren-wrapping needed.
    this.whereClauses.push({ boolean: 'OR', sql: `${String(col)} ${op} ?` });
    this.bindings.push(val);
    return this;
  }

  // ============================
  // whereHas — filter by relation existence via correlated EXISTS subquery.
  // ============================
  private relationInfoFor(name: string): RelationInfo {
    if (!this.modelClass) throw new Error('whereHas requires a model-bound query');
    const inst = new this.modelClass();
    if (typeof inst[name] !== 'function') {
      throw new Error(`Relation '${name}' not found on ${this.modelClass.name}`);
    }
    const relQb = inst[name]();
    const info = (relQb as any)._relationInfo as RelationInfo;
    if (!info) throw new Error(`'${name}' did not return a relation`);
    return info;
  }

  private addHasClause(
    name: string,
    cb: ((q: QueryBuilderImpl<any>) => void) | undefined,
    boolean: 'AND' | 'OR',
    negate: boolean,
  ): this {
    const info = this.relationInfoFor(name);
    const related = info.relatedClass;
    const relatedTable = related?.tableName || related?.name;
    const parent = this.table;
    const sub = new QueryBuilderImpl<any>(relatedTable, related);

    let from = relatedTable;
    let correlate = '';
    const pivotBindings: any[] = [];

    if (info.type === 'hasMany' || info.type === 'hasOne') {
      correlate = `${relatedTable}.${info.foreignKey} = ${parent}.${info.localKey || 'id'}`;
    } else if (info.type === 'belongsTo') {
      correlate = `${relatedTable}.${info.ownerKey || 'id'} = ${parent}.${info.foreignKey}`;
    } else if (info.type === 'morphMany' || info.type === 'morphOne') {
      correlate = `${relatedTable}.${(info as any).morphId} = ${parent}.${info.localKey || 'id'} AND ${relatedTable}.${(info as any).morphType} = '${this.modelClass.name}'`;
    } else if (info.type === 'belongsToMany') {
      const pivot = info.pivotTable!;
      from = `${relatedTable}, ${pivot}`;
      correlate = `${pivot}.${info.foreignPivotKey} = ${parent}.id AND ${pivot}.${info.relatedPivotKey} = ${relatedTable}.id`;
      for (const [k, v] of Object.entries((info as any).pivotDefaults || {})) {
        correlate += ` AND ${pivot}.${k} = ?`;
        pivotBindings.push(v);
      }
    } else {
      throw new Error(`whereHas does not support relation type '${info.type}'`);
    }

    if (cb) cb(sub);
    const subBody = sub.compileWhereBody();

    let inner = `SELECT 1 FROM ${from} WHERE ${correlate}`;
    if (subBody.sql) inner += ` AND ${subBody.sql}`;

    this.whereClauses.push({ boolean, sql: `${negate ? 'NOT ' : ''}EXISTS (${inner})` });
    // Binding order must match placeholder order: pivot defaults, then sub-where.
    this.bindings.push(...pivotBindings, ...subBody.bindings);
    return this;
  }

  whereHas(name: string, cb?: (q: QueryBuilderImpl<any>) => void): this {
    return this.addHasClause(name, cb, 'AND', false);
  }
  orWhereHas(name: string, cb?: (q: QueryBuilderImpl<any>) => void): this {
    return this.addHasClause(name, cb, 'OR', false);
  }
  whereDoesntHave(name: string, cb?: (q: QueryBuilderImpl<any>) => void): this {
    return this.addHasClause(name, cb, 'AND', true);
  }
  orWhereDoesntHave(name: string, cb?: (q: QueryBuilderImpl<any>) => void): this {
    return this.addHasClause(name, cb, 'OR', true);
  }

  /** Cache this query's results in-process for `seconds`. Optional explicit key. */
  remember(seconds: number, key?: string): this {
    this.rememberTtl = seconds;
    this.rememberKey = key;
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

  /**
   * Compile the WHERE body (user clauses + soft-delete scope) without the
   * `WHERE` keyword. Shared by buildSelect() and correlated whereHas subqueries.
   */
  compileWhereBody(): { sql: string; bindings: any[] } {
    const userWhere = this.whereClauses.length ? this.buildWhere() : '';

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

    let sql = '';
    if (userWhere && softDelete) {
      // Wrap user clauses so a global AND doesn't bind only to a trailing OR
      // branch: `(a AND b OR c) AND deleted_at IS NULL`.
      const wrapped = this.hasOrClause() ? `(${userWhere})` : userWhere;
      sql = `${wrapped} AND ${softDelete}`;
    } else if (userWhere) {
      sql = userWhere;
    } else if (softDelete) {
      sql = softDelete;
    }
    return { sql, bindings: this.bindings };
  }

  buildSelect(): string {
    let sql = `SELECT ${this.selectCols.join(', ')} FROM ${this.table}`;
    if (this.joinClauses.length) sql += ' ' + this.joinClauses.join(' ');

    const where = this.compileWhereBody().sql;
    if (where) sql += ` WHERE ${where}`;

    if (this.groupClauses.length) sql += ' GROUP BY ' + this.groupClauses.join(', ');
    if (this.havingClauses.length) sql += ' HAVING ' + this.havingClauses.join(' AND ');
    if (this.orderClauses.length) sql += ' ORDER BY ' + this.orderClauses.join(', ');
    if (this.limitVal !== undefined) sql += ` LIMIT ${this.limitVal}`;
    if (this.offsetVal !== undefined) sql += ` OFFSET ${this.offsetVal}`;

    // Pessimistic locking (ignored on SQLite, which has no row-level locks).
    if (this.lockMode) {
      const driver = getCurrentDriver();
      if (driver !== 'sqlite') {
        if (this.lockMode === 'update') sql += ' FOR UPDATE';
        else sql += driver === 'postgresql' ? ' FOR SHARE' : ' LOCK IN SHARE MODE';
      }
    }
    return sql;
  }

  /** Pessimistic write lock: SELECT ... FOR UPDATE. Use inside a transaction. */
  lockForUpdate(): this { this.lockMode = 'update'; return this; }
  /** Pessimistic shared lock: FOR SHARE / LOCK IN SHARE MODE. Use inside a transaction. */
  sharedLock(): this { this.lockMode = 'share'; return this; }

  async get(): Promise<T[]> {
    // Query result cache (remember): serve from cache when still fresh.
    if (this.rememberTtl !== undefined) {
      const key = this.rememberKey || `${this.buildSelect()}::${JSON.stringify(this.bindings)}`;
      const hit = queryCache.get(key);
      if (hit && hit.expires > Date.now()) return hit.value as T[];
      const fresh = await this.runGet();
      queryCache.set(key, { value: fresh, expires: Date.now() + this.rememberTtl * 1000 });
      return fresh;
    }
    return this.runGet();
  }

  private async runGet(): Promise<T[]> {
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

  /**
   * Process results in fixed-size batches without loading the whole table.
   * Return `false` from the callback to stop early.
   */
  async chunk(size: number, cb: (rows: T[], page: number) => any): Promise<void> {
    let page = 1;
    for (;;) {
      const prevL = this.limitVal, prevO = this.offsetVal;
      this.limitVal = size;
      this.offsetVal = (page - 1) * size;
      let rows: T[];
      try { rows = await this.runGet(); } finally { this.limitVal = prevL; this.offsetVal = prevO; }
      if (rows.length === 0) break;
      const cont = await cb(rows, page);
      if (cont === false) break;
      if (rows.length < size) break;
      page++;
    }
  }

  /** Async iterator over the full result set, fetched in pages of `size`. */
  async *cursor(size: number = 1000): AsyncGenerator<T> {
    let page = 1;
    for (;;) {
      const prevL = this.limitVal, prevO = this.offsetVal;
      this.limitVal = size;
      this.offsetVal = (page - 1) * size;
      let rows: T[];
      try { rows = await this.runGet(); } finally { this.limitVal = prevL; this.offsetVal = prevO; }
      if (rows.length === 0) break;
      for (const r of rows) yield r;
      if (rows.length < size) break;
      page++;
    }
  }

  /** Alias of cursor(): `for await (const row of Model.query().lazy()) {}`. */
  lazy(size: number = 1000): AsyncGenerator<T> { return this.cursor(size); }

  /** Iterate primary-key ordered pages (stable pagination for mutating scans). */
  async each(cb: (row: T) => any, size: number = 1000): Promise<void> {
    for await (const row of this.cursor(size)) {
      const cont = await cb(row);
      if (cont === false) break;
    }
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
  async min(col: any): Promise<number> { assertIdentifier(col, 'column'); return this.runAggregate(`MIN(${String(col)}) as agg`); }
  async max(col: any): Promise<number> { assertIdentifier(col, 'column'); return this.runAggregate(`MAX(${String(col)}) as agg`); }
  /** True if any row matches the current constraints. */
  async exists(): Promise<boolean> { return (await this.count()) > 0; }

  // Apply auto-timestamps + cast serialization to a set of insert rows.
  private prepInsertItems(items: any[]): any[] {
    if (this.modelClass && (this.modelClass as any).timestamps) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const createdAt = (this.modelClass as any).createdAtColumn || 'created_at';
      const updatedAt = (this.modelClass as any).updatedAtColumn || 'updated_at';
      items = items.map(item => ({
        ...item,
        [createdAt]: item[createdAt] || now,
        [updatedAt]: item[updatedAt] || now,
      }));
    }
    if (this.modelClass) {
      items = items.map(item => prepareForStorage(this.modelClass, item));
    }
    return items;
  }

  async insert(data: Partial<T> | Partial<T>[]): Promise<T> {
    const items = this.prepInsertItems(Array.isArray(data) ? data : [data]);
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

  /** Insert row(s), silently skipping ones that violate a unique constraint. */
  async insertOrIgnore(data: Partial<T> | Partial<T>[]): Promise<number> {
    const items = this.prepInsertItems(Array.isArray(data) ? data : [data]);
    if (items.length === 0) return 0;
    const keys = Object.keys(items[0]!);
    const values = items.map(item => keys.map(k => (item as any)[k]));
    const placeholders = values.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
    const driver = getCurrentDriver();
    let sql = driver === 'mysql'
      ? `INSERT IGNORE INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders}`
      : `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
    const result = await execute(sql, values.flat());
    return result.affectedRows;
  }

  /**
   * Insert rows, updating on unique-key conflict (MySQL ON DUPLICATE KEY /
   * Postgres & SQLite ON CONFLICT ... DO UPDATE).
   * @param uniqueBy columns forming the unique/primary key (used by PG/SQLite)
   * @param updateCols columns to overwrite on conflict (default: all non-key cols)
   */
  async upsert(rows: Partial<T>[], uniqueBy: string[], updateCols?: string[]): Promise<number> {
    if (!rows.length) return 0;
    const items = this.prepInsertItems([...rows]);
    const keys = Object.keys(items[0]!);
    keys.forEach(k => assertIdentifier(k, 'column'));
    uniqueBy.forEach(k => assertIdentifier(k, 'column'));
    const values = items.map(item => keys.map(k => (item as any)[k]));
    const placeholders = values.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
    const cols = (updateCols && updateCols.length ? updateCols : keys.filter(k => !uniqueBy.includes(k)));
    cols.forEach(k => assertIdentifier(k, 'column'));
    const driver = getCurrentDriver();
    let sql = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders}`;
    if (driver === 'mysql') {
      sql += ' ON DUPLICATE KEY UPDATE ' + cols.map(c => `${c}=VALUES(${c})`).join(', ');
    } else {
      sql += ` ON CONFLICT (${uniqueBy.join(',')}) DO UPDATE SET ` + cols.map(c => `${c}=EXCLUDED.${c}`).join(', ');
    }
    const result = await execute(sql, values.flat());
    return result.affectedRows;
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
   * Define the inverse of morphToMany. Here THIS model is the "tag"-like side:
   * e.g. Tag.morphedByMany(Post, 'taggable') returns the posts attached to this
   * tag via the polymorphic pivot (`<name>_id` + `<name>_type` point at Post).
   */
  protected morphedByMany<T extends Model>(
    relatedClass: { new (): T } & typeof Model,
    name: string,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    typeColumn?: string
  ): QueryBuilder<T> {
    const thisName = this.constructor.name.toLowerCase();
    const table = pivotTable || `${name}ables`;
    // This model's key in the pivot (e.g. tag_id); related's morph id (e.g. taggable_id).
    const fk = foreignPivotKey || `${thisName}_id`;
    const rk = relatedPivotKey || `${name}_id`;
    const typeCol = typeColumn || `${name}_type`;
    const typeVal = relatedClass.name;

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
           // Skip unset fields (e.g. a declared `id!: number` that compiles to an
           // `undefined` own property) so they aren't bound — MySQL rejects
           // undefined params, and an explicit NULL id breaks Postgres SERIAL.
           if (this[key] === undefined) continue;
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
          if (this[key] === undefined) continue; // skip unset fields
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

  // Build a query filtered by an attributes map (used by firstOr*/updateOr*).
  private static queryByAttributes(attributes: Record<string, any>): QueryBuilder<any> {
    let q = (this as any).query() as QueryBuilder<any>;
    for (const [k, v] of Object.entries(attributes)) {
      q = v === null ? (q as any).whereNull(k) : q.where(k, '=', v);
    }
    return q;
  }

  /** Return the first matching row, or a new UNSAVED instance filled with attributes+values. */
  static async firstOrNew<T extends Model>(this: { new (): T } & typeof Model, attributes: Partial<T>, values: Partial<T> = {}): Promise<T> {
    const found = await (this as any).queryByAttributes(attributes).first();
    if (found) return found;
    const inst = new (this as any)();
    inst.fill({ ...attributes, ...values });
    return inst;
  }

  /** Return the first matching row, or create + persist one from attributes+values. */
  static async firstOrCreate<T extends Model>(this: { new (): T } & typeof Model, attributes: Partial<T>, values: Partial<T> = {}): Promise<T> {
    const found = await (this as any).queryByAttributes(attributes).first();
    if (found) return found;
    return (this as any).create({ ...attributes, ...values });
  }

  /** Update the first matching row with values, or create it. Returns the persisted model. */
  static async updateOrCreate<T extends Model>(this: { new (): T } & typeof Model, attributes: Partial<T>, values: Partial<T> = {}): Promise<T> {
    const found = await (this as any).queryByAttributes(attributes).first();
    if (found) {
      (found as any).fill(values);
      await (found as any).save();
      return found;
    }
    return (this as any).create({ ...attributes, ...values });
  }

  /** Update matching rows with values, or insert attributes+values. Returns true if updated. */
  static async updateOrInsert(attributes: Record<string, any>, values: Record<string, any> = {}): Promise<boolean> {
    const existing = await (this as any).queryByAttributes(attributes).first();
    if (existing) {
      await (this as any).queryByAttributes(attributes).update(values);
      return true;
    }
    await (this as any).query().insert({ ...attributes, ...values });
    return false;
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
