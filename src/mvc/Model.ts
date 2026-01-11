/**
 * CanxJS Model - Zero-config ORM with MySQL primary, PostgreSQL secondary
 */

import type { DatabaseConfig, DatabaseDriver, ModelField, ModelSchema, QueryBuilder } from '../types';

// Database connection pool
let mysqlPool: any = null;
let pgPool: any = null;
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
  }
}

export async function closeDatabase(): Promise<void> {
  if (mysqlPool) { await mysqlPool.end(); mysqlPool = null; }
  if (pgPool) { await pgPool.end(); pgPool = null; }
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
  }
  throw new Error('No database connection');
}

// Query Builder implementation
class QueryBuilderImpl<T> implements QueryBuilder<T> {
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

  constructor(table: string) { this.table = table; }

  select(...cols: any[]): this { this.selectCols = cols.length ? cols : ['*']; return this; }
  
  where(col: any, op: string, val: any): this {
    this.whereClauses.push(`${String(col)} ${op} ?`);
    this.bindings.push(val);
    return this;
  }

  whereIn(col: any, vals: any[]): this {
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

  async get(): Promise<T[]> { return query<T>(this.buildSelect(), this.bindings); }
  async first(): Promise<T | null> { this.limitVal = 1; const r = await this.get(); return r[0] || null; }
  async count(): Promise<number> { this.selectCols = ['COUNT(*) as count']; const r = await this.get(); return (r[0] as any)?.count || 0; }
  async sum(col: any): Promise<number> { this.selectCols = [`SUM(${String(col)}) as sum`]; const r = await this.get(); return (r[0] as any)?.sum || 0; }
  async avg(col: any): Promise<number> { this.selectCols = [`AVG(${String(col)}) as avg`]; const r = await this.get(); return (r[0] as any)?.avg || 0; }

  async insert(data: Partial<T> | Partial<T>[]): Promise<T> {
    const items = Array.isArray(data) ? data : [data];
    const keys = Object.keys(items[0]!);
    const values = items.map(item => keys.map(k => (item as any)[k]));
    const placeholders = values.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders}`;
    const result = await execute(sql, values.flat());
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
}

// Base Model class
export abstract class Model<T extends Record<string, any> = any> {
  protected static tableName: string;
  protected static primaryKey: string = 'id';
  protected static timestamps: boolean = true;

  static table<T>(): QueryBuilder<T> {
    return new QueryBuilderImpl<T>(this.tableName);
  }

  static async find<T>(id: number | string): Promise<T | null> {
    return new QueryBuilderImpl<T>(this.tableName).where(this.primaryKey, '=', id).first();
  }

  static async all<T>(): Promise<T[]> {
    return new QueryBuilderImpl<T>(this.tableName).get();
  }

  static async create<T>(data: Partial<T>): Promise<T> {
    if (this.timestamps) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      (data as any).created_at = now;
      (data as any).updated_at = now;
    }
    return new QueryBuilderImpl<T>(this.tableName).insert(data);
  }

  static async updateById<T>(id: number | string, data: Partial<T>): Promise<number> {
    if (this.timestamps) {
      (data as any).updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    return new QueryBuilderImpl<T>(this.tableName).where(this.primaryKey, '=', id).update(data);
  }

  static async deleteById(id: number | string): Promise<number> {
    return new QueryBuilderImpl<any>(this.tableName).where(this.primaryKey, '=', id).delete();
  }

  static query<T>(): QueryBuilder<T> {
    return new QueryBuilderImpl<T>(this.tableName);
  }
}

export { query, execute, QueryBuilderImpl };
export default Model;
