"use strict";
/**
 * Database Session Driver
 * Stores sessions in a database table 'sessions'
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseSessionDriver = void 0;
const Model_1 = require("../../mvc/Model");
// Internal model for Session interaction
class SessionModel extends Model_1.Model {
    static tableName = 'sessions';
    static primaryKey = 'id';
    static timestamps = false; // We handle timestamps manually if needed
}
class DatabaseSessionDriver {
    generateId() {
        return `sess_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '')}`;
    }
    async create(userId, data, maxAge) {
        const id = this.generateId();
        const expiresAt = Date.now() + maxAge;
        // Convert data to JSON string for storage
        const payload = JSON.stringify(data);
        await SessionModel.create({
            id,
            user_id: userId,
            payload,
            last_activity: new Date(Date.now()).toISOString().slice(0, 19).replace('T', ' '),
            expires_at: expiresAt
        }); // We need expires_at column in DB to query efficient cleanup
        return {
            id,
            userId,
            data,
            expiresAt
        };
    }
    async get(id) {
        const record = await SessionModel.find(id);
        if (!record)
            return null;
        const now = Date.now();
        // Check expiration
        if (record.expires_at < now) {
            this.destroy(id);
            return null;
        }
        // Parse payload
        let data = {};
        try {
            data = JSON.parse(record.payload);
        }
        catch (e) { }
        return {
            id,
            userId: record.user_id,
            data,
            expiresAt: record.expires_at
        };
    }
    async destroy(id) {
        const deleted = await SessionModel.deleteById(id);
        return deleted > 0;
    }
    async cleanup() {
        const now = Date.now();
        // DELETE FROM sessions WHERE expires_at < now
        await SessionModel.query().where('expires_at', '<', now).delete();
    }
}
exports.DatabaseSessionDriver = DatabaseSessionDriver;
