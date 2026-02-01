"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryDriver = void 0;
class MemoryDriver {
    jobs = new Map();
    pending = []; // Queue of IDs
    delayed = [];
    async push(payload) {
        const id = Math.random().toString(36).substring(7);
        const job = {
            ...payload,
            id,
            status: 'pending',
            attempts: 0,
            createdAt: Date.now(),
        };
        this.jobs.set(id, job);
        this.pending.push(id);
        return id;
    }
    async later(delay, payload) {
        const id = Math.random().toString(36).substring(7);
        const job = {
            ...payload,
            id,
            status: 'pending',
            attempts: 0,
            createdAt: Date.now(),
        };
        this.jobs.set(id, job);
        this.delayed.push({ id, runAt: Date.now() + delay });
        return id;
    }
    async pop() {
        // Check delayed jobs
        const now = Date.now();
        const ready = this.delayed.filter(d => d.runAt <= now);
        for (const d of ready) {
            this.pending.push(d.id);
            this.delayed = this.delayed.filter(x => x.id !== d.id);
        }
        const id = this.pending.shift();
        if (!id)
            return null;
        const job = this.jobs.get(id);
        if (!job)
            return null;
        job.status = 'processing';
        return job;
    }
    async complete(job) {
        const existing = this.jobs.get(job.id);
        if (existing) {
            existing.status = 'completed';
        }
    }
    async fail(job, error) {
        const existing = this.jobs.get(job.id);
        if (existing) {
            existing.status = 'failed';
            existing.error = error.message;
        }
    }
    async release(job, delay) {
        const existing = this.jobs.get(job.id);
        if (existing) {
            existing.status = 'pending';
            existing.attempts++;
            this.delayed.push({ id: job.id, runAt: Date.now() + delay });
        }
    }
    async clear() {
        this.jobs.clear();
        this.pending = [];
        this.delayed = [];
    }
    async size() {
        return this.pending.length + this.delayed.length;
    }
    // Dashboard Methods
    async getFailed(offset = 0, limit = 20) {
        const failed = Array.from(this.jobs.values())
            .filter(job => job.status === 'failed')
            .sort((a, b) => b.createdAt - a.createdAt);
        return failed.slice(offset, offset + limit);
    }
    async getPending(offset = 0, limit = 20) {
        const pending = Array.from(this.jobs.values())
            .filter(job => job.status === 'pending')
            .sort((a, b) => a.createdAt - b.createdAt);
        return pending.slice(offset, offset + limit);
    }
    async getStats() {
        let pending = 0;
        let failed = 0;
        let processed = 0;
        for (const job of this.jobs.values()) {
            if (job.status === 'pending')
                pending++;
            if (job.status === 'failed')
                failed++;
            if (job.status === 'completed')
                processed++;
        }
        return { pending, failed, processed };
    }
    async retry(jobId) {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'failed')
            return;
        // Reset to pending
        job.status = 'pending';
        job.error = undefined;
        job.createdAt = Date.now(); // Optional: reset time or keep original
        // Add back to pending queue
        this.pending.push(job.id);
    }
    async remove(jobId) {
        this.jobs.delete(jobId);
        this.pending = this.pending.filter(id => id !== jobId);
        this.delayed = this.delayed.filter(d => d.id !== jobId);
    }
}
exports.MemoryDriver = MemoryDriver;
