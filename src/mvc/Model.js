"use strict";
/**
 * CanxJS Model - Zero-config ORM with MySQL primary, PostgreSQL secondary
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Model = exports.QueryBuilderImpl = void 0;
exports.initDatabase = initDatabase;
exports.closeDatabase = closeDatabase;
exports.getCurrentDriver = getCurrentDriver;
exports.query = query;
exports.execute = execute;
// Database connection pool
let mysqlPool = null;
let pgPool = null;
let sqliteDb = null;
let currentDriver = 'mysql';
let dbConfig = null;
async function initDatabase(config) {
    dbConfig = config;
    currentDriver = config.driver;
    if (config.driver === 'mysql') {
        const mysql = await Promise.resolve().then(() => __importStar(require('mysql2/promise')));
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
    }
    else if (config.driver === 'postgresql') {
        const { Pool } = await Promise.resolve().then(() => __importStar(require('pg')));
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
    else if (config.driver === 'sqlite') {
        const { Database } = await Promise.resolve().then(() => __importStar(require('bun:sqlite')));
        sqliteDb = new Database(config.database);
        console.log('[CanxJS] SQLite database connected');
    }
}
async function closeDatabase() {
    if (mysqlPool) {
        await mysqlPool.end();
        mysqlPool = null;
    }
    if (pgPool) {
        await pgPool.end();
        pgPool = null;
    }
    if (sqliteDb) {
        sqliteDb.close();
        sqliteDb = null;
    }
}
function getCurrentDriver() {
    return currentDriver;
}
async function query(sql, params = []) {
    if (dbConfig?.logging)
        console.log('[SQL]', sql, params);
    if (currentDriver === 'mysql' && mysqlPool) {
        const [rows] = await mysqlPool.execute(sql, params);
        return rows;
    }
    else if (currentDriver === 'postgresql' && pgPool) {
        // Convert ? placeholders to $1, $2 for PostgreSQL
        let idx = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
        const result = await pgPool.query(pgSql, params);
        return result.rows;
    }
    else if (currentDriver === 'sqlite' && sqliteDb) {
        const query = sqliteDb.query(sql);
        // bun:sqlite uses $1, $2 or named params, but handle simple ? for compatibility?
        // Bun sqlite actually supports ? binding since recent versions or via .all(...params)
        // Let's try direct binding.
        return query.all(...params);
    }
    throw new Error('No database connection');
}
async function execute(sql, params = []) {
    if (dbConfig?.logging)
        console.log('[SQL]', sql, params);
    if (currentDriver === 'mysql' && mysqlPool) {
        const [result] = await mysqlPool.execute(sql, params);
        return { affectedRows: result.affectedRows, insertId: result.insertId };
    }
    else if (currentDriver === 'postgresql' && pgPool) {
        let idx = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
        const result = await pgPool.query(pgSql + ' RETURNING *', params);
        return { affectedRows: result.rowCount || 0, insertId: result.rows[0]?.id || 0 };
    }
    else if (currentDriver === 'sqlite' && sqliteDb) {
        const query = sqliteDb.query(sql);
        const result = query.run(...params);
        return { affectedRows: result.changes, insertId: result.lastInsertRowid };
    }
    throw new Error('No database connection');
}
// Cast Types definition moved to types/index.ts
// Query Builder implementation
class QueryBuilderImpl {
    table;
    selectCols = ['*'];
    whereClauses = [];
    orderClauses = [];
    limitVal;
    offsetVal;
    joinClauses = [];
    groupClauses = [];
    havingClauses = [];
    bindings = [];
    // Model mapping
    modelClass;
    withTrashed = false;
    // Eager Loading
    withRelations = [];
    // Internal relation info attached by relationship methods
    _relationInfo;
    constructor(table, modelClass) {
        this.table = table;
        this.modelClass = modelClass;
    }
    // ... existing methods ...
    select(...cols) { this.selectCols = cols.length ? cols : ['*']; return this; }
    where(col, op, val) {
        // Security: Validate column name
        if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col)) {
            throw new Error(`Invalid column name: ${col}`);
        }
        this.whereClauses.push(`${String(col)} ${op} ?`);
        this.bindings.push(val);
        return this;
    }
    whereIn(col, vals) {
        if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col)) {
            throw new Error(`Invalid column name: ${col}`);
        }
        if (vals.length === 0) {
            this.whereClauses.push('1 = 0'); // False condition if empty
            return this;
        }
        this.whereClauses.push(`${String(col)} IN (${vals.map(() => '?').join(',')})`);
        this.bindings.push(...vals);
        return this;
    }
    whereNull(col) {
        if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col))
            throw new Error(`Invalid column name: ${col}`);
        this.whereClauses.push(`${String(col)} IS NULL`);
        return this;
    }
    whereNotNull(col) {
        if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col))
            throw new Error(`Invalid column name: ${col}`);
        this.whereClauses.push(`${String(col)} IS NOT NULL`);
        return this;
    }
    orWhere(col, op, val) {
        if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col))
            throw new Error(`Invalid column name: ${col}`);
        if (this.whereClauses.length) {
            const last = this.whereClauses.pop();
            this.whereClauses.push(`(${last} OR ${String(col)} ${op} ?)`);
        }
        else {
            this.whereClauses.push(`${String(col)} ${op} ?`);
        }
        this.bindings.push(val);
        return this;
    }
    orderBy(col, dir = 'asc') {
        if (typeof col === 'string' && !/^[a-zA-Z0-9_\.]+$/.test(col))
            throw new Error(`Invalid column name: ${col}`);
        this.orderClauses.push(`${String(col)} ${dir.toUpperCase()}`);
        return this;
    }
    limit(n) { this.limitVal = n; return this; }
    offset(n) { this.offsetVal = n; return this; }
    join(table, first, op, second) {
        if (!/^[a-zA-Z0-9_]+$/.test(table))
            throw new Error(`Invalid table name: ${table}`);
        if (!/^[a-zA-Z0-9_\.]+$/.test(first))
            throw new Error(`Invalid identifier: ${first}`);
        if (!/^[a-zA-Z0-9_\.]+$/.test(second))
            throw new Error(`Invalid identifier: ${second}`);
        this.joinClauses.push(`INNER JOIN ${table} ON ${first} ${op} ${second}`);
        return this;
    }
    leftJoin(table, first, op, second) {
        this.joinClauses.push(`LEFT JOIN ${table} ON ${first} ${op} ${second}`);
        return this;
    }
    groupBy(...cols) { this.groupClauses = cols.map(String); return this; }
    having(col, op, val) {
        this.havingClauses.push(`${String(col)} ${op} ?`);
        this.bindings.push(val);
        return this;
    }
    whereRaw(sql, bindings = []) {
        this.whereClauses.push(sql);
        this.bindings.push(...bindings);
        return this;
    }
    // Eager Loading
    with(...relations) {
        this.withRelations.push(...relations);
        return this;
    }
    buildSelect() {
        let sql = `SELECT ${this.selectCols.join(', ')} FROM ${this.table}`;
        if (this.joinClauses.length)
            sql += ' ' + this.joinClauses.join(' ');
        if (this.whereClauses.length)
            sql += ' WHERE ' + this.whereClauses.join(' AND ');
        // Soft Deletes Scope
        if (this.modelClass && this.modelClass.softDeletes && !this.withTrashed) {
            const deletedAtCol = this.modelClass.deletedAtColumn || 'deleted_at';
            // Check if we already have a wrapper for deleted_at
            const hasDeletedClause = this.whereClauses.some(c => c.includes(deletedAtCol));
            if (!hasDeletedClause) {
                const prefix = this.whereClauses.length ? ' AND ' : ' WHERE ';
                sql += `${prefix}${this.table}.${deletedAtCol} IS NULL`;
            }
        }
        if (this.groupClauses.length)
            sql += ' GROUP BY ' + this.groupClauses.join(', ');
        if (this.havingClauses.length)
            sql += ' HAVING ' + this.havingClauses.join(' AND ');
        if (this.orderClauses.length)
            sql += ' ORDER BY ' + this.orderClauses.join(', ');
        if (this.limitVal !== undefined)
            sql += ` LIMIT ${this.limitVal}`;
        if (this.offsetVal !== undefined)
            sql += ` OFFSET ${this.offsetVal}`;
        return sql;
    }
    async get() {
        const rows = await query(this.buildSelect(), this.bindings);
        let results = rows;
        if (this.modelClass) {
            results = rows.map(r => new this.modelClass().fill(r));
        }
        // Process Eager Loading
        if (this.withRelations.length > 0 && this.modelClass && results.length > 0) {
            await this.eagerLoad(results);
        }
        return results;
    }
    async eagerLoad(results) {
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
            const info = relationQuery._relationInfo;
            if (!info) {
                console.warn(`[Model] Method '${relationName}' did not return a valid relation QueryBuilder`);
                continue;
            }
            if (info.type === 'hasMany' || info.type === 'hasOne') {
                const localKey = info.localKey || 'id';
                const foreignKey = info.foreignKey;
                const parentIds = results.map(r => r[localKey]).filter(id => id !== undefined && id !== null);
                if (parentIds.length === 0)
                    continue;
                // Ensure unique IDs
                const uniqueIds = [...new Set(parentIds)];
                // Fetch related
                const relatedResults = await info.relatedClass.query().whereIn(foreignKey, uniqueIds).get();
                // Map back
                for (const parent of results) {
                    const parentId = parent[localKey];
                    if (info.type === 'hasMany') {
                        parent.startRelation(relationName);
                        parent.relations[relationName] = relatedResults.filter((r) => r[foreignKey] == parentId);
                    }
                    else {
                        // hasOne
                        parent.startRelation(relationName);
                        parent.relations[relationName] = relatedResults.find((r) => r[foreignKey] == parentId) || null;
                    }
                }
            }
            else if (info.type === 'belongsTo') {
                const foreignKey = info.foreignKey; // e.g. user_id on Post
                const ownerKey = info.ownerKey || 'id'; // e.g. id on User
                const relatedIds = results.map(r => r[foreignKey]).filter(id => id !== undefined && id !== null);
                if (relatedIds.length === 0)
                    continue;
                const uniqueIds = [...new Set(relatedIds)];
                const relatedResults = await info.relatedClass.query().whereIn(ownerKey, uniqueIds).get();
                for (const parent of results) {
                    const relatedId = parent[foreignKey];
                    parent.startRelation(relationName);
                    parent.relations[relationName] = relatedResults.find((r) => r[ownerKey] == relatedId) || null;
                }
            }
            else if (info.type === 'belongsToMany') {
                // Pivot logic
                const localKey = 'id';
                const parentIds = results.map(r => r[localKey]).filter(id => id !== undefined && id !== null);
                if (parentIds.length === 0)
                    continue;
                const uniqueIds = [...new Set(parentIds)];
                // 1. Get pivot rows
                // SELECT * FROM pivot WHERE foreignPivotKey IN (ids)
                const pivotSql = `SELECT * FROM ${info.pivotTable} WHERE ${info.foreignPivotKey} IN (${uniqueIds.map(() => '?').join(',')})`;
                const pivotRows = await query(pivotSql, uniqueIds);
                if (pivotRows.length === 0) {
                    for (const parent of results) {
                        parent.startRelation(relationName);
                        parent.relations[relationName] = [];
                    }
                    continue;
                }
                // 2. Get related rows
                const relatedIds = pivotRows.map(r => r[info.relatedPivotKey]);
                const uniqueRelatedIds = [...new Set(relatedIds)];
                const relatedResults = await info.relatedClass.query().whereIn('id', uniqueRelatedIds).get();
                // 3. Map back
                for (const parent of results) {
                    parent.startRelation(relationName);
                    const myPivotRows = pivotRows.filter(r => r[info.foreignPivotKey] == parent[localKey]);
                    const myRelatedIds = myPivotRows.map(r => r[info.relatedPivotKey]);
                    parent.relations[relationName] = relatedResults.filter((r) => myRelatedIds.includes(r.id));
                }
            }
            else if (info.type === 'morphOne' || info.type === 'morphMany') {
                // Polymorphic relation loading
                const localKey = info.localKey || 'id';
                const morphId = info.morphId; // e.g. imageable_id
                const morphType = info.morphType; // e.g. imageable_type
                const morphTypeName = this.modelClass.name; // e.g. 'User'
                const parentIds = results.map(r => r[localKey]).filter(id => id !== undefined && id !== null);
                if (parentIds.length === 0)
                    continue;
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
                        parent.relations[relationName] = relatedResults.find((r) => r[morphId] == parentId) || null;
                    }
                    else {
                        parent.relations[relationName] = relatedResults.filter((r) => r[morphId] == parentId);
                    }
                }
            }
        }
    }
    async first() {
        this.limitVal = 1;
        const rows = await this.get();
        return rows[0] || null;
    }
    async count() { this.selectCols = ['COUNT(*) as count']; const r = await query(this.buildSelect(), this.bindings); return r[0]?.count || 0; }
    async sum(col) { this.selectCols = [`SUM(${String(col)}) as sum`]; const r = await query(this.buildSelect(), this.bindings); return r[0]?.sum || 0; }
    async avg(col) { this.selectCols = [`AVG(${String(col)}) as avg`]; const r = await query(this.buildSelect(), this.bindings); return r[0]?.avg || 0; }
    async insert(data) {
        let items = Array.isArray(data) ? data : [data];
        // Auto-timestamps
        if (this.modelClass && this.modelClass.timestamps) {
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const createdAt = this.modelClass.createdAtColumn || 'created_at';
            const updatedAt = this.modelClass.updatedAtColumn || 'updated_at';
            items = items.map(item => ({
                ...item,
                [createdAt]: item[createdAt] || now,
                [updatedAt]: item[updatedAt] || now,
            }));
        }
        const keys = Object.keys(items[0]);
        const values = items.map(item => keys.map(k => item[k]));
        const placeholders = values.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
        const sql = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders}`;
        const result = await execute(sql, values.flat());
        if (this.modelClass) {
            return new this.modelClass().fill({ ...items[0], id: result.insertId });
        }
        return { ...items[0], id: result.insertId };
    }
    async update(data) {
        const updateData = { ...data };
        // Auto-timestamps
        if (this.modelClass && this.modelClass.timestamps) {
            const updatedAt = this.modelClass.updatedAtColumn || 'updated_at';
            if (!updateData[updatedAt]) {
                updateData[updatedAt] = new Date().toISOString().slice(0, 19).replace('T', ' ');
            }
        }
        const keys = Object.keys(updateData);
        const sets = keys.map(k => `${k} = ?`).join(', ');
        const vals = keys.map(k => updateData[k]);
        let sql = `UPDATE ${this.table} SET ${sets}`;
        if (this.whereClauses.length)
            sql += ' WHERE ' + this.whereClauses.join(' AND ');
        const result = await execute(sql, [...vals, ...this.bindings]);
        return result.affectedRows;
    }
    async delete() {
        if (this.modelClass && this.modelClass.softDeletes && !this.withTrashed) { // Allow force delete logic if explicit
            const deletedAtCol = this.modelClass.deletedAtColumn || 'deleted_at';
            return this.update({ [deletedAtCol]: new Date().toISOString().slice(0, 19).replace('T', ' ') });
        }
        let sql = `DELETE FROM ${this.table}`;
        if (this.whereClauses.length)
            sql += ' WHERE ' + this.whereClauses.join(' AND ');
        const result = await execute(sql, this.bindings);
        return result.affectedRows;
    }
    async forceDelete() {
        let sql = `DELETE FROM ${this.table}`;
        if (this.whereClauses.length)
            sql += ' WHERE ' + this.whereClauses.join(' AND ');
        const result = await execute(sql, this.bindings);
        return result.affectedRows;
    }
    withTrashedResults() {
        this.withTrashed = true;
        return this;
    }
    async raw(sql, bindings = []) { return query(sql, bindings); }
    /**
     * Paginate results
     * @param page - Current page (1-indexed)
     * @param perPage - Items per page
     */
    async paginate(page = 1, perPage = 15) {
        // Get total count
        const countBuilder = new QueryBuilderImpl(this.table, this.modelClass);
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
exports.QueryBuilderImpl = QueryBuilderImpl;
// Base Model class
class Model {
    static tableName;
    static primaryKey = 'id';
    static timestamps = true;
    static softDeletes = false;
    static deletedAtColumn = 'deleted_at';
    // Observers
    static observers = [];
    // Casting
    casts = {};
    // Relations storage
    relations = {};
    constructor(data) {
        if (data)
            this.fill(data);
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
    static observe(observer) {
        this.observers.push(observer);
    }
    async fireEvent(event) {
        for (const observer of this.constructor.observers) {
            const handler = observer[event];
            if (typeof handler === 'function') {
                await handler(this);
            }
        }
    }
    // ============================
    // Attribute Casting & Accessors
    // ============================
    // Helper to cast value based on type
    castAttribute(key, value) {
        if (value === null || value === undefined)
            return value;
        const type = this.casts[key];
        if (!type)
            return value;
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
    prepareAttributeForStorage(key, value) {
        const type = this.casts[key];
        if (!type)
            return value;
        switch (type) {
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
    // Override fill to handle casting
    fill(data) {
        for (const key in data) {
            this[key] = this.castAttribute(key, data[key]);
        }
        return this;
    }
    /**
     * Define hasOne relationship
     */
    hasOne(relatedClass, foreignKey, localKey = 'id') {
        const fk = foreignKey || `${this.constructor.name.toLowerCase()}_id`;
        const qb = relatedClass.query().where(fk, '=', this[localKey]).limit(1);
        qb._relationInfo = {
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
    hasMany(relatedClass, foreignKey, localKey = 'id') {
        const fk = foreignKey || `${this.constructor.name.toLowerCase()}_id`;
        const qb = relatedClass.query().where(fk, '=', this[localKey]);
        qb._relationInfo = {
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
    belongsTo(relatedClass, foreignKey, ownerKey = 'id') {
        const fk = foreignKey || `${relatedClass.name.toLowerCase()}_id`;
        let qb;
        if (!this[fk]) {
            // Return empty query if FK is missing
            qb = relatedClass.query().where(ownerKey, '=', null).limit(1);
        }
        else {
            qb = relatedClass.query().where(ownerKey, '=', this[fk]).limit(1);
        }
        qb._relationInfo = {
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
    belongsToMany(relatedClass, pivotTable, foreignPivotKey, relatedPivotKey) {
        const relatedName = relatedClass.name.toLowerCase();
        const thisName = this.constructor.name.toLowerCase();
        // Default pivot table name: alphabetical order (e.g., role_user)
        const table = pivotTable || [relatedName, thisName].sort().join('_');
        // Keys
        const fk = foreignPivotKey || `${thisName}_id`;
        const rk = relatedPivotKey || `${relatedName}_id`;
        const builder = relatedClass.query();
        // subquery for whereIn
        const sql = `id IN (SELECT ${rk} FROM ${table} WHERE ${fk} = ?)`;
        const qb = builder.whereRaw(sql, [this['id']]);
        qb._relationInfo = {
            type: 'belongsToMany',
            relatedClass: relatedClass,
            pivotTable: table,
            foreignPivotKey: fk,
            relatedPivotKey: rk
        };
        return qb;
    }
    /**
     * Define morphTo relationship
     */
    morphTo(name, type, id, ownerKey = 'id') {
        const n = name || 'morphable'; // fallback name
        const typeCol = type || `${n}_type`;
        const idCol = id || `${n}_id`;
        const qb = new QueryBuilderImpl('__dummy__');
        qb._relationInfo = {
            type: 'morphTo',
            morphName: n,
            morphType: typeCol,
            morphId: idCol,
            ownerKey
        };
        return qb;
    }
    /**
     * Define morphOne relationship
     */
    morphOne(relatedClass, name, type, id, localKey = 'id') {
        const typeCol = type || `${name}_type`;
        const idCol = id || `${name}_id`;
        const myClass = this.constructor.name;
        const qb = relatedClass.query()
            .where(idCol, '=', this[localKey])
            .where(typeCol, '=', myClass)
            .limit(1);
        qb._relationInfo = {
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
    morphMany(relatedClass, name, type, id, localKey = 'id') {
        const typeCol = type || `${name}_type`;
        const idCol = id || `${name}_id`;
        const myClass = this.constructor.name;
        const qb = relatedClass.query()
            .where(idCol, '=', this[localKey])
            .where(typeCol, '=', myClass);
        qb._relationInfo = {
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
    hasManyThrough(relatedClass, throughClass, firstKey, // Foreign key on through table
    secondKey, // Foreign key on related table
    localKey = 'id', // Local key on this model
    secondLocalKey = 'id' // Local key on through model
    ) {
        const fk1 = firstKey || `${this.constructor.name.toLowerCase()}_id`;
        const fk2 = secondKey || `${throughClass.name.toLowerCase()}_id`;
        const relatedTable = relatedClass.tableName;
        const throughTable = throughClass.tableName;
        const qb = relatedClass.query();
        // Join
        qb.join(throughTable, `${throughTable}.${secondLocalKey}`, '=', `${relatedTable}.${fk2}`)
            .where(`${throughTable}.${fk1}`, '=', this[localKey])
            .select(`${relatedTable}.*`);
        qb._relationInfo = {
            type: 'hasManyThrough',
            relatedClass,
            throughClass,
            firstKey: fk1,
            secondKey: fk2,
            localKey,
        };
        return qb;
    }
    static table() {
        return new QueryBuilderImpl(this.tableName, this);
    }
    // Find by ID - returns Instance
    static async find(id) {
        return this.table().where(this.primaryKey, '=', id).first();
    }
    // Chainable query builder
    static query() {
        return new QueryBuilderImpl(this.tableName, this);
    }
    static async all() {
        return this.query().get();
    }
    // Init relation storage
    startRelation(name) {
        if (!this.relations)
            this.relations = {};
    }
    // Lazy load relations
    async load(...relations) {
        // Create a builder just to use its eagerLoad ability
        const builder = new QueryBuilderImpl(this.constructor.tableName, this.constructor);
        builder.with(...relations);
        await builder.eagerLoad([this]);
        return this;
    }
    // Start Eager Loading
    static with(...relations) {
        return this.query().with(...relations);
    }
    // Override save/update/insert logic with hooks
    async save() {
        const isNew = !this[this.constructor.primaryKey];
        await this.fireEvent('saving');
        if (isNew) {
            await this.fireEvent('creating');
            // Prepare data
            const data = {};
            for (const key of Object.keys(this)) {
                if (key === 'relations' || key === 'casts' || typeof this[key] === 'function')
                    continue;
                data[key] = this.prepareAttributeForStorage(key, this[key]);
            }
            // Add timestamps if enabled
            const ModelClass = this.constructor;
            if (ModelClass.timestamps) {
                const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                data.created_at = now;
                data.updated_at = now;
            }
            // Use direct insert instead of create() to avoid recursion
            const created = await ModelClass.query().insert(data);
            Object.assign(this, created); // Sync ID and timestamps
            await this.fireEvent('created');
        }
        else {
            await this.fireEvent('updating');
            const data = {};
            // We should only update what's changed, but for now update explicit props
            for (const key of Object.keys(this)) {
                if (key === 'relations' || key === 'casts' || typeof this[key] === 'function')
                    continue;
                data[key] = this.prepareAttributeForStorage(key, this[key]);
            }
            // Exclude ID from update
            const pk = this.constructor.primaryKey;
            delete data[pk];
            await this.constructor.query()
                .where(pk, '=', this[pk])
                .update(data);
            await this.fireEvent('updated');
        }
        await this.fireEvent('saved');
        return this;
    }
    // Delete with hooks
    async delete() {
        await this.fireEvent('deleting');
        const pk = this.constructor.primaryKey;
        await this.constructor.query().where(pk, '=', this[pk]).delete();
        await this.fireEvent('deleted');
        return true;
    }
    // Restore (Soft Deletes)
    async restore() {
        if (!this.constructor.softDeletes)
            return false;
        await this.fireEvent('restoring');
        const pk = this.constructor.primaryKey;
        const deletedAtCol = this.constructor.deletedAtColumn;
        await this.constructor.query()
            .where(pk, '=', this[pk])
            .update({ [deletedAtCol]: null });
        this[deletedAtCol] = null;
        await this.fireEvent('restored');
        return true;
    }
    // Create - returns Instance
    static async create(data) {
        const instance = new this();
        instance.fill(data);
        await instance.save();
        return instance;
    }
    static async updateById(id, data) {
        if (this.timestamps) {
            data.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        return new QueryBuilderImpl(this.tableName).where(this.primaryKey, '=', id).update(data);
    }
    static async deleteById(id) {
        return new QueryBuilderImpl(this.tableName).where(this.primaryKey, '=', id).delete();
    }
    static where(col, op, val) {
        const qb = this.query();
        if (val === undefined) {
            return qb.where(col, '=', op);
        }
        return qb.where(col, op, val);
    }
}
exports.Model = Model;
exports.default = Model;
