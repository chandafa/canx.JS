"use strict";
/**
 * CanxJS Migrations - Database schema management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrator = exports.Schema = void 0;
exports.defineMigration = defineMigration;
const Model_1 = require("../mvc/Model");
class TableBuilder {
    columns = [];
    tableName;
    indices = [];
    uniques = [];
    constructor(name) {
        this.tableName = name;
    }
    id(name = 'id') {
        this.columns.push({ name, type: 'id', primary: true, autoIncrement: true, unsigned: true });
        return this;
    }
    string(name, length = 255) {
        this.columns.push({ name, type: 'string', length });
        return this;
    }
    text(name) {
        this.columns.push({ name, type: 'text' });
        return this;
    }
    integer(name) {
        this.columns.push({ name, type: 'int' });
        return this;
    }
    bigInteger(name) {
        this.columns.push({ name, type: 'bigint' });
        return this;
    }
    float(name) {
        this.columns.push({ name, type: 'float' });
        return this;
    }
    decimal(name, precision = 10, scale = 2) {
        this.columns.push({ name, type: 'decimal', length: precision });
        return this;
    }
    boolean(name) {
        this.columns.push({ name, type: 'boolean' });
        return this;
    }
    date(name) {
        this.columns.push({ name, type: 'date' });
        return this;
    }
    datetime(name) {
        this.columns.push({ name, type: 'datetime' });
        return this;
    }
    timestamp(name) {
        this.columns.push({ name, type: 'timestamp' });
        return this;
    }
    timestamps() {
        this.columns.push({ name: 'created_at', type: 'timestamp', nullable: true });
        this.columns.push({ name: 'updated_at', type: 'timestamp', nullable: true });
        return this;
    }
    softDeletes() {
        this.columns.push({ name: 'deleted_at', type: 'timestamp', nullable: true });
        return this;
    }
    json(name) {
        this.columns.push({ name, type: 'json' });
        return this;
    }
    binary(name) {
        this.columns.push({ name, type: 'binary' });
        return this;
    }
    // Modifiers (apply to last column)
    nullable() {
        if (this.columns.length)
            this.columns[this.columns.length - 1].nullable = true;
        return this;
    }
    default(value) {
        if (this.columns.length)
            this.columns[this.columns.length - 1].default = value;
        return this;
    }
    unique() {
        if (this.columns.length)
            this.columns[this.columns.length - 1].unique = true;
        return this;
    }
    primary() {
        if (this.columns.length)
            this.columns[this.columns.length - 1].primary = true;
        return this;
    }
    index() {
        if (this.columns.length)
            this.columns[this.columns.length - 1].index = true;
        return this;
    }
    unsigned() {
        if (this.columns.length)
            this.columns[this.columns.length - 1].unsigned = true;
        return this;
    }
    references(table, column = 'id') {
        if (this.columns.length) {
            this.columns[this.columns.length - 1].references = { table, column };
        }
        return this;
    }
    onDelete(action) {
        const lastCol = this.columns[this.columns.length - 1];
        if (lastCol?.references)
            lastCol.references.onDelete = action;
        return this;
    }
    // Build SQL
    toSQL() {
        const driver = (0, Model_1.getCurrentDriver)();
        const cols = this.columns.map(col => {
            let sql = `\`${col.name}\` `;
            switch (col.type) {
                case 'id':
                    if (driver === 'sqlite') {
                        sql += 'INTEGER PRIMARY KEY AUTOINCREMENT';
                    }
                    else {
                        sql += 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
                    }
                    break;
                case 'string':
                    sql += `VARCHAR(${col.length || 255})`;
                    break;
                case 'text':
                    sql += 'TEXT';
                    break;
                case 'int':
                    sql += col.unsigned ? (driver === 'sqlite' ? 'INTEGER' : 'INT UNSIGNED') : 'INT';
                    break;
                case 'bigint':
                    sql += col.unsigned ? (driver === 'sqlite' ? 'INTEGER' : 'BIGINT UNSIGNED') : 'BIGINT';
                    break;
                case 'float':
                    sql += 'FLOAT';
                    break;
                case 'decimal':
                    sql += `DECIMAL(${col.length || 10}, 2)`;
                    break;
                case 'boolean':
                    sql += driver === 'sqlite' ? 'INTEGER' : 'TINYINT(1)';
                    break;
                case 'date':
                    sql += 'DATE';
                    break;
                case 'datetime':
                    sql += 'DATETIME';
                    break;
                case 'timestamp':
                    sql += 'TIMESTAMP';
                    break;
                case 'json':
                    sql += 'JSON';
                    break;
                case 'binary':
                    sql += 'BLOB';
                    break;
            }
            if (col.type !== 'id') {
                if (!col.nullable)
                    sql += ' NOT NULL';
                if (col.default !== undefined) {
                    const def = typeof col.default === 'string' ? `'${col.default}'` : col.default;
                    sql += ` DEFAULT ${def}`;
                }
                if (col.unique)
                    sql += ' UNIQUE';
                if (col.primary)
                    sql += ' PRIMARY KEY';
            }
            return sql;
        });
        // Foreign keys
        const fks = this.columns.filter(c => c.references).map(col => {
            const ref = col.references;
            let fk = `FOREIGN KEY (\`${col.name}\`) REFERENCES \`${ref.table}\`(\`${ref.column}\`)`;
            if (ref.onDelete)
                fk += ` ON DELETE ${ref.onDelete}`;
            if (ref.onUpdate)
                fk += ` ON UPDATE ${ref.onUpdate}`;
            return fk;
        });
        // SQLite doesn't support engine configuration
        const suffix = driver === 'sqlite' ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
        return `CREATE TABLE \`${this.tableName}\` (\n  ${[...cols, ...fks].join(',\n  ')}\n)${suffix}`;
    }
}
// ============================================
// Schema Facade
// ============================================
exports.Schema = {
    async create(table, callback) {
        const builder = new TableBuilder(table);
        callback(builder);
        await (0, Model_1.execute)(builder.toSQL());
        console.log(`[Migration] Created table: ${table}`);
    },
    async drop(table) {
        await (0, Model_1.execute)(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`[Migration] Dropped table: ${table}`);
    },
    async dropIfExists(table) {
        await this.drop(table);
    },
    async rename(from, to) {
        await (0, Model_1.execute)(`RENAME TABLE \`${from}\` TO \`${to}\``);
        console.log(`[Migration] Renamed table: ${from} -> ${to}`);
    },
    async hasTable(table) {
        const driver = (0, Model_1.getCurrentDriver)();
        if (driver === 'sqlite') {
            const result = await (0, Model_1.query)(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='${table}'`);
            // @ts-ignore
            return (result[0]?.count || result[0]?.['count(*)']) > 0;
        }
        const result = await (0, Model_1.query)(`SHOW TABLES LIKE '${table}'`);
        return result.length > 0;
    },
    async hasColumn(table, column) {
        const driver = (0, Model_1.getCurrentDriver)();
        if (driver === 'sqlite') {
            const result = await (0, Model_1.query)(`PRAGMA table_info(${table})`);
            return result.some(c => c.name === column);
        }
        const result = await (0, Model_1.query)(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
        return result.length > 0;
    },
};
// ============================================
// Migration Runner
// ============================================
class Migrator {
    migrations = [];
    async ensureTable() {
        const exists = await exports.Schema.hasTable('migrations');
        if (!exists) {
            await exports.Schema.create('migrations', (table) => {
                table.id();
                table.string('name').unique();
                table.integer('batch');
                table.timestamp('executed_at');
            });
        }
    }
    register(migration) {
        this.migrations.push(migration);
    }
    async getExecuted() {
        await this.ensureTable();
        const records = await (0, Model_1.query)('SELECT name FROM migrations ORDER BY batch, id');
        return records.map(r => r.name);
    }
    async getNextBatch() {
        const result = await (0, Model_1.query)('SELECT MAX(batch) as batch FROM migrations');
        return (result[0]?.batch || 0) + 1;
    }
    async run() {
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
            await (0, Model_1.execute)('INSERT INTO migrations (name, batch, executed_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [migration.name, batch]);
        }
        console.log(`[Migration] Completed ${pending.length} migrations.`);
    }
    async rollback() {
        await this.ensureTable();
        const result = await (0, Model_1.query)('SELECT MAX(batch) as batch FROM migrations');
        const lastBatch = result[0]?.batch;
        if (!lastBatch) {
            console.log('[Migration] Nothing to rollback.');
            return;
        }
        const records = await (0, Model_1.query)('SELECT name FROM migrations WHERE batch = ? ORDER BY id DESC', [lastBatch]);
        for (const record of records) {
            const migration = this.migrations.find(m => m.name === record.name);
            if (migration) {
                console.log(`[Migration] Rolling back: ${migration.name}`);
                await migration.down();
                await (0, Model_1.execute)('DELETE FROM migrations WHERE name = ?', [migration.name]);
            }
        }
        console.log(`[Migration] Rolled back ${records.length} migrations.`);
    }
    async reset() {
        const executed = await this.getExecuted();
        for (const name of executed.reverse()) {
            const migration = this.migrations.find(m => m.name === name);
            if (migration) {
                console.log(`[Migration] Rolling back: ${migration.name}`);
                await migration.down();
            }
        }
        await (0, Model_1.execute)('TRUNCATE TABLE migrations');
        console.log('[Migration] Reset complete.');
    }
    async fresh() {
        await this.reset();
        await this.run();
    }
    async status() {
        const executed = await this.getExecuted();
        return this.migrations.map(m => ({
            name: m.name,
            ran: executed.includes(m.name),
        }));
    }
}
exports.migrator = new Migrator();
function defineMigration(name, up, down) {
    const migration = { name, up, down };
    exports.migrator.register(migration);
    return migration;
}
exports.default = { Schema: exports.Schema, migrator: exports.migrator, defineMigration };
