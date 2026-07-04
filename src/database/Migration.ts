/**
 * CanxJS Migrations - Database schema management
 */

import { query, execute, getCurrentDriver } from '../mvc/Model';
import type { DatabaseDriver } from '../types';

// Quote an identifier for the active driver: double-quotes for Postgres,
// backticks for MySQL/SQLite.
function quoteId(id: string, driver: DatabaseDriver = getCurrentDriver()): string {
  return driver === 'postgresql' ? `"${id}"` : `\`${id}\``;
}

export interface Migration {
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

interface MigrationRecord {
  id: number;
  name: string;
  batch: number;
  executed_at: string;
}

// ============================================
// Schema Builder
// ============================================

type ColumnType = 'id' | 'string' | 'text' | 'int' | 'bigint' | 'float' | 'decimal' | 
                  'boolean' | 'date' | 'datetime' | 'timestamp' | 'json' | 'binary';

interface Column {
  name: string;
  type: ColumnType;
  length?: number;
  nullable?: boolean;
  default?: unknown;
  primary?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  index?: boolean;
  unsigned?: boolean;
  references?: { table: string; column: string; onDelete?: string; onUpdate?: string };
}

export class TableBuilder {
  private columns: Column[] = [];
  private tableName: string;
  private indices: string[] = [];
  private uniques: string[] = [];

  constructor(name: string) {
    this.tableName = name;
  }

  id(name = 'id'): this {
    this.columns.push({ name, type: 'id', primary: true, autoIncrement: true, unsigned: true });
    return this;
  }

  string(name: string, length = 255): this {
    this.columns.push({ name, type: 'string', length });
    return this;
  }

  text(name: string): this {
    this.columns.push({ name, type: 'text' });
    return this;
  }

  integer(name: string): this {
    this.columns.push({ name, type: 'int' });
    return this;
  }

  bigInteger(name: string): this {
    this.columns.push({ name, type: 'bigint' });
    return this;
  }

  float(name: string): this {
    this.columns.push({ name, type: 'float' });
    return this;
  }

  decimal(name: string, precision = 10, scale = 2): this {
    this.columns.push({ name, type: 'decimal', length: precision, scale } as any);
    return this;
  }

  boolean(name: string): this {
    this.columns.push({ name, type: 'boolean' });
    return this;
  }

  date(name: string): this {
    this.columns.push({ name, type: 'date' });
    return this;
  }

  datetime(name: string): this {
    this.columns.push({ name, type: 'datetime' });
    return this;
  }

  timestamp(name: string): this {
    this.columns.push({ name, type: 'timestamp' });
    return this;
  }

  timestamps(): this {
    this.columns.push({ name: 'created_at', type: 'timestamp', nullable: true });
    this.columns.push({ name: 'updated_at', type: 'timestamp', nullable: true });
    return this;
  }

  softDeletes(): this {
    this.columns.push({ name: 'deleted_at', type: 'timestamp', nullable: true });
    return this;
  }

  json(name: string): this {
    this.columns.push({ name, type: 'json' });
    return this;
  }

  binary(name: string): this {
    this.columns.push({ name, type: 'binary' });
    return this;
  }

  // Modifiers (apply to last column)
  nullable(): this {
    if (this.columns.length) this.columns[this.columns.length - 1].nullable = true;
    return this;
  }

  default(value: unknown): this {
    if (this.columns.length) this.columns[this.columns.length - 1].default = value;
    return this;
  }

  unique(): this {
    if (this.columns.length) this.columns[this.columns.length - 1].unique = true;
    return this;
  }

  primary(): this {
    if (this.columns.length) this.columns[this.columns.length - 1].primary = true;
    return this;
  }

  index(): this {
    if (this.columns.length) this.columns[this.columns.length - 1].index = true;
    return this;
  }

  unsigned(): this {
    if (this.columns.length) this.columns[this.columns.length - 1].unsigned = true;
    return this;
  }

  references(table: string, column = 'id'): this {
    if (this.columns.length) {
      this.columns[this.columns.length - 1].references = { table, column };
    }
    return this;
  }

  onDelete(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this {
    const lastCol = this.columns[this.columns.length - 1];
    if (lastCol?.references) lastCol.references.onDelete = action;
    return this;
  }

  // Build SQL
  toSQL(): string {
    const driver = getCurrentDriver();
    const isPg = driver === 'postgresql';
    const isSqlite = driver === 'sqlite';
    const q = (id: string) => quoteId(id, driver);

    const cols = this.columns.map(col => {
      let sql = `${q(col.name)} `;

      switch (col.type) {
        case 'id':
          if (isSqlite) sql += 'INTEGER PRIMARY KEY AUTOINCREMENT';
          else if (isPg) sql += 'BIGSERIAL PRIMARY KEY';
          else sql += 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
          break;
        case 'string': sql += `VARCHAR(${col.length || 255})`; break;
        case 'text': sql += 'TEXT'; break;
        case 'int': sql += isPg ? 'INTEGER' : (col.unsigned ? (isSqlite ? 'INTEGER' : 'INT UNSIGNED') : 'INT'); break;
        case 'bigint': sql += isPg ? 'BIGINT' : (col.unsigned ? (isSqlite ? 'INTEGER' : 'BIGINT UNSIGNED') : 'BIGINT'); break;
        case 'float': sql += isPg ? 'REAL' : 'FLOAT'; break;
        case 'decimal': sql += `DECIMAL(${col.length || 10}, ${(col as any).scale ?? 2})`; break;
        case 'boolean': sql += isSqlite ? 'INTEGER' : (isPg ? 'BOOLEAN' : 'TINYINT(1)'); break;
        case 'date': sql += 'DATE'; break;
        case 'datetime': sql += isPg ? 'TIMESTAMP' : 'DATETIME'; break;
        case 'timestamp': sql += 'TIMESTAMP'; break;
        case 'json': sql += isPg ? 'JSONB' : 'JSON'; break;
        case 'binary': sql += isPg ? 'BYTEA' : 'BLOB'; break;
      }

      if (col.type !== 'id') {
        // Emit NULL/NOT NULL explicitly. The explicit NULL matters for MySQL/
        // MariaDB TIMESTAMP columns: a bare second TIMESTAMP otherwise gets an
        // implicit '0000-00-00' default that strict mode rejects.
        if (!col.nullable) sql += ' NOT NULL';
        else sql += ' NULL';
        if (col.default !== undefined) {
          let def: string | number;
          if (typeof col.default === 'string') {
            def = `'${col.default.replace(/'/g, "''")}'`;   // escape quotes
          } else if (typeof col.default === 'boolean') {
            def = isPg ? (col.default ? 'TRUE' : 'FALSE') : (col.default ? 1 : 0);
          } else {
            def = col.default as any;
          }
          sql += ` DEFAULT ${def}`;
        }
        if (col.unique) sql += ' UNIQUE';
        if (col.primary) sql += ' PRIMARY KEY';
      }

      return sql;
    });

    // Foreign keys
    const fks = this.columns.filter(c => c.references).map(col => {
      const ref = col.references!;
      let fk = `FOREIGN KEY (${q(col.name)}) REFERENCES ${q(ref.table)}(${q(ref.column)})`;
      if (ref.onDelete) fk += ` ON DELETE ${ref.onDelete}`;
      if (ref.onUpdate) fk += ` ON UPDATE ${ref.onUpdate}`;
      return fk;
    });

    // Only MySQL uses ENGINE/CHARSET; SQLite and Postgres reject it.
    const suffix = driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';

    return `CREATE TABLE ${q(this.tableName)} (\n  ${[...cols, ...fks].join(',\n  ')}\n)${suffix}`;
  }

  /** Separate CREATE INDEX statements for columns marked with .index(). */
  toIndexSQL(): string[] {
    const driver = getCurrentDriver();
    const q = (id: string) => quoteId(id, driver);
    return this.columns
      .filter((c) => (c as any).index && !c.unique && !c.primary && c.type !== 'id')
      .map((c) => `CREATE INDEX ${q(`idx_${this.tableName}_${c.name}`)} ON ${q(this.tableName)} (${q(c.name)})`);
  }
}


// ============================================
// Schema Facade
// ============================================

export const Schema = {
  async create(table: string, callback: (builder: TableBuilder) => void): Promise<void> {
    const builder = new TableBuilder(table);
    callback(builder);
    await execute(builder.toSQL());
    // Emit any secondary indexes declared via .index()
    for (const idxSql of builder.toIndexSQL()) {
      await execute(idxSql);
    }
    console.log(`[Migration] Created table: ${table}`);
  },

  async drop(table: string): Promise<void> {
    await execute(`DROP TABLE IF EXISTS ${quoteId(table)}`);
    console.log(`[Migration] Dropped table: ${table}`);
  },

  async dropIfExists(table: string): Promise<void> {
    await this.drop(table);
  },

  async rename(from: string, to: string): Promise<void> {
    const driver = getCurrentDriver();
    // MySQL: RENAME TABLE; SQLite/Postgres: ALTER TABLE ... RENAME TO
    const sql = driver === 'mysql'
      ? `RENAME TABLE ${quoteId(from, driver)} TO ${quoteId(to, driver)}`
      : `ALTER TABLE ${quoteId(from, driver)} RENAME TO ${quoteId(to, driver)}`;
    await execute(sql);
    console.log(`[Migration] Renamed table: ${from} -> ${to}`);
  },

  async hasTable(table: string): Promise<boolean> {
    const driver = getCurrentDriver();
    if (driver === 'sqlite') {
      // sqlite_master lists tables; bind the name as a param.
      const result = await query<any>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
        [table]
      );
      return result.length > 0;
    }
    if (driver === 'postgresql') {
      const result = await query<any>(
        `SELECT 1 FROM information_schema.tables WHERE table_name = ? AND table_schema = 'public'`,
        [table]
      );
      return result.length > 0;
    }
    // MySQL: parameterized SHOW TABLES LIKE (no interpolation).
    const result = await query<any>(`SHOW TABLES LIKE ?`, [table]);
    return result.length > 0;
  },

  async hasColumn(table: string, column: string): Promise<boolean> {
    const driver = getCurrentDriver();
    if (driver === 'sqlite') {
      // PRAGMA can't take bound params, so interpolate the quoted/validated name.
      const result = await query(`PRAGMA table_info(${quoteId(table, driver)})`);
      return (result as any[]).some(c => c.name === column);
    }
    if (driver === 'postgresql') {
      const result = await query<any>(
        `SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ?`,
        [table, column]
      );
      return result.length > 0;
    }
    // MySQL: table name needs backtick quoting; the column match is bound.
    const result = await query<any>(`SHOW COLUMNS FROM ${quoteId(table, driver)} LIKE ?`, [column]);
    return result.length > 0;
  },
};

// ============================================
// Migration Runner
// ============================================

class Migrator {
  private migrations: Migration[] = [];

  async ensureTable(): Promise<void> {
    const exists = await Schema.hasTable('migrations');
    if (!exists) {
      await Schema.create('migrations', (table) => {
        table.id();
        table.string('name').unique();
        table.integer('batch');
        table.timestamp('executed_at');
      });
    }
  }

  register(migration: Migration): void {
    this.migrations.push(migration);
  }

  async getExecuted(): Promise<string[]> {
    await this.ensureTable();
    const records = await query<MigrationRecord>('SELECT name FROM migrations ORDER BY batch, id');
    return records.map(r => r.name);
  }

  async getNextBatch(): Promise<number> {
    const result = await query<{ batch: number }>('SELECT MAX(batch) as batch FROM migrations');
    return (result[0]?.batch || 0) + 1;
  }

  async run(): Promise<void> {
    await this.ensureTable();
    const executed = await this.getExecuted();
    const pending = this.migrations.filter(m => !executed.includes(m.name));

    if (pending.length === 0) {
      console.log('[Migration] Nothing to migrate.');
      return;
    }

    const batch = await this.getNextBatch();
    for (const migration of pending) {
      console.log(`[Migration] Running: ${migration.name}`);
      await migration.up();
      await execute(
        'INSERT INTO migrations (name, batch, executed_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [migration.name, batch]
      );
    }
    console.log(`[Migration] Completed ${pending.length} migrations.`);
  }

  async rollback(): Promise<void> {
    await this.ensureTable();
    const result = await query<{ batch: number }>('SELECT MAX(batch) as batch FROM migrations');
    const lastBatch = result[0]?.batch;
    if (!lastBatch) {
      console.log('[Migration] Nothing to rollback.');
      return;
    }

    const records = await query<MigrationRecord>(
      'SELECT name FROM migrations WHERE batch = ? ORDER BY id DESC',
      [lastBatch]
    );

    for (const record of records) {
      const migration = this.migrations.find(m => m.name === record.name);
      if (migration) {
        console.log(`[Migration] Rolling back: ${migration.name}`);
        await migration.down();
        await execute('DELETE FROM migrations WHERE name = ?', [migration.name]);
      }
    }
    console.log(`[Migration] Rolled back ${records.length} migrations.`);
  }

  async reset(): Promise<void> {
    const executed = await this.getExecuted();
    for (const name of executed.reverse()) {
      const migration = this.migrations.find(m => m.name === name);
      if (migration) {
        console.log(`[Migration] Rolling back: ${migration.name}`);
        await migration.down();
      }
    }
    // SQLite has no TRUNCATE; use DELETE. MySQL/Postgres keep TRUNCATE.
    const driver = getCurrentDriver();
    if (driver === 'sqlite') {
      await execute(`DELETE FROM ${quoteId('migrations', driver)}`);
    } else {
      await execute(`TRUNCATE TABLE ${quoteId('migrations', driver)}`);
    }
    console.log('[Migration] Reset complete.');
  }

  async fresh(): Promise<void> {
    await this.reset();
    await this.run();
  }

  async status(): Promise<{ name: string; ran: boolean }[]> {
    const executed = await this.getExecuted();
    return this.migrations.map(m => ({
      name: m.name,
      ran: executed.includes(m.name),
    }));
  }
}

// On globalThis so a migration file that imports `canxjs` (via the
// node_modules junction) and the CLI (which imports the real dist path) share
// ONE migrator — otherwise Windows path-casing/junction resolution loads two
// module copies and migrations register on an instance the CLI never runs.
// (Same dual-instance guard as the DB connection state.)
const MIGRATOR_KEY = Symbol.for('canxjs.database.migrator');
export const migrator: Migrator = ((globalThis as any)[MIGRATOR_KEY] ??= new Migrator());

export function defineMigration(name: string, up: () => Promise<void>, down: () => Promise<void>): Migration {
  const migration = { name, up, down };
  migrator.register(migration);
  return migration;
}

export default { Schema, migrator, defineMigration };
