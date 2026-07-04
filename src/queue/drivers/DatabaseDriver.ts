import type { QueueDriver, Job } from './types';
import { query, execute } from '../../mvc/Model';

/**
 * DatabaseDriver persists jobs to a database table (default `jobs`) via CanxJS's
 * own DB layer (`query`/`execute` raw SQL). Portable across MySQL / SQLite /
 * Postgres — only plain `?` placeholders and standard SQL are used.
 *
 * NOTE: the consumer must have created the backing table beforehand, e.g.:
 *
 *   CREATE TABLE jobs (
 *     id           VARCHAR(64) PRIMARY KEY,
 *     queue        VARCHAR(255),
 *     payload      TEXT,
 *     attempts     INTEGER DEFAULT 0,
 *     available_at BIGINT,
 *     created_at   BIGINT
 *   );
 *
 * `payload` holds the JSON-serialized job body (name/data/delay/maxAttempts/scheduledAt).
 * A row's mere presence with `available_at <= now` means it is pending; jobs are
 * deleted on pop() (reserve-by-delete) and re-inserted by release() for retries.
 */
export class DatabaseDriver implements QueueDriver {
  private queueName = 'default';

  constructor(private table: string = 'jobs') {}

  private newId(): string {
    return Math.random().toString(36).substring(7) + Date.now().toString(36);
  }

  private serialize(job: Job): string {
    return JSON.stringify({
      name: job.name,
      data: job.data,
      delay: job.delay,
      maxAttempts: job.maxAttempts,
      scheduledAt: job.scheduledAt,
    });
  }

  private rowToJob(row: any): Job {
    let body: any = {};
    try {
      body = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
    } catch {
      body = {};
    }
    return {
      id: String(row.id),
      name: body.name,
      data: body.data,
      attempts: Number(row.attempts) || 0,
      maxAttempts: body.maxAttempts ?? 3,
      delay: body.delay ?? 0,
      scheduledAt: body.scheduledAt ?? (Number(row.available_at) || 0),
      createdAt: Number(row.created_at) || 0,
      status: 'pending',
    };
  }

  private async insert(job: Job, availableAt: number): Promise<void> {
    await execute(
      `INSERT INTO ${this.table} (id, queue, payload, attempts, available_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [job.id, this.queueName, this.serialize(job), job.attempts, availableAt, job.createdAt]
    );
  }

  async push(payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    const now = Date.now();
    const job: Job = { ...payload, id: this.newId(), status: 'pending', attempts: 0, createdAt: now };
    await this.insert(job, now);
    return job.id;
  }

  async later(delay: number, payload: Omit<Job, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<string> {
    const now = Date.now();
    const job: Job = { ...payload, id: this.newId(), status: 'pending', attempts: 0, createdAt: now };
    await this.insert(job, now + delay);
    return job.id;
  }

  async pop(): Promise<Job | null> {
    const now = Date.now();
    const rows = await query<any>(
      `SELECT * FROM ${this.table} WHERE queue = ? AND available_at <= ? ORDER BY available_at ASC, created_at ASC LIMIT 1`,
      [this.queueName, now]
    );
    if (!rows.length) return null;

    const row = rows[0];
    // Reserve by deleting the row; release() re-inserts it for retries.
    const res = await execute(`DELETE FROM ${this.table} WHERE id = ?`, [String(row.id)]);
    if (!res.affectedRows) return null; // Lost the race to another worker.

    const job = this.rowToJob(row);
    job.status = 'processing';
    return job;
  }

  async complete(_job: Job): Promise<void> {
    // Row was already removed on pop(); nothing to persist.
  }

  async fail(_job: Job, _error: Error): Promise<void> {
    // Row was already removed on pop(). Failed-job archival is left to the
    // application (no dedicated failed_jobs table is assumed here).
  }

  async release(job: Job, delay: number): Promise<void> {
    job.attempts++;
    await this.insert(job, Date.now() + delay);
  }

  async clear(): Promise<void> {
    await execute(`DELETE FROM ${this.table} WHERE queue = ?`, [this.queueName]);
  }

  async size(): Promise<number> {
    const rows = await query<any>(
      `SELECT COUNT(*) AS count FROM ${this.table} WHERE queue = ?`,
      [this.queueName]
    );
    return Number(rows[0]?.count) || 0;
  }

  // Dashboard support
  async getFailed(_offset: number = 0, _limit: number = 20): Promise<Job[]> {
    // No failed-job archive in this minimal schema.
    return [];
  }

  async getPending(offset: number = 0, limit: number = 20): Promise<Job[]> {
    const rows = await query<any>(
      `SELECT * FROM ${this.table} WHERE queue = ? AND available_at <= ? ORDER BY available_at ASC, created_at ASC LIMIT ? OFFSET ?`,
      [this.queueName, Date.now(), limit, offset]
    );
    return rows.map(r => this.rowToJob(r));
  }

  async getStats(): Promise<{ pending: number; failed: number; processed: number }> {
    const pending = await this.size();
    return { pending, failed: 0, processed: 0 };
  }

  async retry(_jobId: string): Promise<void> {
    // Failed jobs are not archived, so there is nothing to requeue.
  }

  async remove(jobId: string): Promise<void> {
    await execute(`DELETE FROM ${this.table} WHERE id = ?`, [jobId]);
  }
}
