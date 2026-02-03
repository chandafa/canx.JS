/**
 * CanxJS Batched Jobs
 * 
 * Laravel-style job batching - process multiple jobs as a group
 * with progress tracking and completion callbacks.
 */

import { queue } from './Queue';

// ============================================
// Types
// ============================================

export interface BatchableJob {
  name: string;
  data: unknown;
}

export interface BatchProgress {
  total: number;
  pending: number;
  processed: number;
  failed: number;
  percentage: number;
}

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BatchInfo {
  id: string;
  name?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: BatchStatus;
  progress: BatchProgress;
  failedJobIds: string[];
}

export interface BatchOptions {
  /** Batch name for identification */
  name?: string;
  /** Queue to dispatch jobs to */
  queue?: string;
  /** Allow partial failures */
  allowPartialFailure?: boolean;
  /** Max number of failed jobs before cancelling batch */
  maxFailures?: number;
}

export interface PendingBatch {
  /** Add jobs to the batch */
  add(jobs: BatchableJob | BatchableJob[]): PendingBatch;
  /** Callback when all jobs complete successfully */
  then(callback: (batch: BatchInfo) => void | Promise<void>): PendingBatch;
  /** Callback when any job fails */
  catch(callback: (error: Error, batch: BatchInfo) => void | Promise<void>): PendingBatch;
  /** Callback that always runs after completion or failure */
  finally(callback: (batch: BatchInfo) => void | Promise<void>): PendingBatch;
  /** Callback for progress updates */
  progress(callback: (batch: BatchInfo) => void | Promise<void>): PendingBatch;
  /** Dispatch the batch */
  dispatch(): Promise<string>;
}

// ============================================
// Batch Storage (In-memory for now)
// ============================================

const batchStore = new Map<string, BatchInfo>();
const batchCallbacks = new Map<string, {
  then?: (batch: BatchInfo) => void | Promise<void>;
  catch?: (error: Error, batch: BatchInfo) => void | Promise<void>;
  finally?: (batch: BatchInfo) => void | Promise<void>;
  progress?: (batch: BatchInfo) => void | Promise<void>;
}>();

// ============================================
// Job Batch Class
// ============================================

export class JobBatch implements PendingBatch {
  private jobs: BatchableJob[] = [];
  private batchId: string;
  private options: BatchOptions;
  private thenCallback?: (batch: BatchInfo) => void | Promise<void>;
  private catchCallback?: (error: Error, batch: BatchInfo) => void | Promise<void>;
  private finallyCallback?: (batch: BatchInfo) => void | Promise<void>;
  private progressCallback?: (batch: BatchInfo) => void | Promise<void>;

  constructor(options: BatchOptions = {}) {
    this.batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.options = options;
  }

  /**
   * Add jobs to the batch
   */
  add(jobs: BatchableJob | BatchableJob[]): PendingBatch {
    const jobArray = Array.isArray(jobs) ? jobs : [jobs];
    this.jobs.push(...jobArray);
    return this;
  }

  /**
   * Callback when all jobs complete successfully
   */
  then(callback: (batch: BatchInfo) => void | Promise<void>): PendingBatch {
    this.thenCallback = callback;
    return this;
  }

  /**
   * Callback when any job fails
   */
  catch(callback: (error: Error, batch: BatchInfo) => void | Promise<void>): PendingBatch {
    this.catchCallback = callback;
    return this;
  }

  /**
   * Callback that always runs
   */
  finally(callback: (batch: BatchInfo) => void | Promise<void>): PendingBatch {
    this.finallyCallback = callback;
    return this;
  }

  /**
   * Callback for progress updates
   */
  progress(callback: (batch: BatchInfo) => void | Promise<void>): PendingBatch {
    this.progressCallback = callback;
    return this;
  }

  /**
   * Dispatch the batch
   */
  async dispatch(): Promise<string> {
    if (this.jobs.length === 0) {
      throw new Error('Cannot dispatch empty job batch');
    }

    // Create batch info
    const batchInfo: BatchInfo = {
      id: this.batchId,
      name: this.options.name,
      createdAt: Date.now(),
      status: 'pending',
      progress: {
        total: this.jobs.length,
        pending: this.jobs.length,
        processed: 0,
        failed: 0,
        percentage: 0,
      },
      failedJobIds: [],
    };

    // Store batch
    batchStore.set(this.batchId, batchInfo);
    batchCallbacks.set(this.batchId, {
      then: this.thenCallback,
      catch: this.catchCallback,
      finally: this.finallyCallback,
      progress: this.progressCallback,
    });

    // Dispatch all jobs with batch metadata
    const dispatchPromises = this.jobs.map(async (job, index) => {
      const jobId = `${this.batchId}_job_${index}`;
      await queue.dispatch(job.name, {
        ...job.data as object,
        __batch: {
          id: this.batchId,
          jobId,
          index,
          total: this.jobs.length,
          allowPartialFailure: this.options.allowPartialFailure ?? true,
          maxFailures: this.options.maxFailures,
        },
      }, {
        queue: this.options.queue,
      });
    });

    await Promise.all(dispatchPromises);

    // Update status
    batchInfo.status = 'processing';
    batchInfo.startedAt = Date.now();

    return this.batchId;
  }

  /**
   * Get the batch ID
   */
  getId(): string {
    return this.batchId;
  }
}

// ============================================
// Batch Progress Handler
// ============================================

/**
 * Mark a batched job as complete.
 * Call this at the end of your job handler.
 */
export async function completeBatchJob(jobData: any): Promise<void> {
  const batchMeta = jobData?.__batch;
  if (!batchMeta) return;

  const { id: batchId, jobId } = batchMeta;
  const batch = batchStore.get(batchId);
  if (!batch) return;

  // Update progress
  batch.progress.processed++;
  batch.progress.pending--;
  batch.progress.percentage = Math.round((batch.progress.processed / batch.progress.total) * 100);

  // Notify progress
  const callbacks = batchCallbacks.get(batchId);
  if (callbacks?.progress) {
    try {
      await callbacks.progress(batch);
    } catch (error) {
      console.error('Batch progress callback error:', error);
    }
  }

  // Check if batch is complete
  await checkBatchCompletion(batchId);
}

/**
 * Mark a batched job as failed.
 */
export async function failBatchJob(jobData: any, error: Error): Promise<void> {
  const batchMeta = jobData?.__batch;
  if (!batchMeta) return;

  const { id: batchId, jobId, allowPartialFailure, maxFailures } = batchMeta;
  const batch = batchStore.get(batchId);
  if (!batch) return;

  // Update progress
  batch.progress.failed++;
  batch.progress.pending--;
  batch.failedJobIds.push(jobId);
  batch.progress.percentage = Math.round(
    ((batch.progress.processed + batch.progress.failed) / batch.progress.total) * 100
  );

  // Check max failures
  if (maxFailures !== undefined && batch.progress.failed >= maxFailures) {
    batch.status = 'cancelled';
  }

  // Callback
  const callbacks = batchCallbacks.get(batchId);
  if (callbacks?.catch) {
    try {
      await callbacks.catch(error, batch);
    } catch (callbackError) {
      console.error('Batch catch callback error:', callbackError);
    }
  }

  // Check completion
  await checkBatchCompletion(batchId);
}

/**
 * Check if batch is complete and trigger callbacks
 */
async function checkBatchCompletion(batchId: string): Promise<void> {
  const batch = batchStore.get(batchId);
  if (!batch || batch.progress.pending > 0) return;

  // Batch is complete
  batch.finishedAt = Date.now();
  batch.status = batch.progress.failed > 0 
    ? (batch.progress.processed === 0 ? 'failed' : 'completed') 
    : 'completed';

  const callbacks = batchCallbacks.get(batchId);

  // Then callback (only if all succeeded)
  if (batch.progress.failed === 0 && callbacks?.then) {
    try {
      await callbacks.then(batch);
    } catch (error) {
      console.error('Batch then callback error:', error);
    }
  }

  // Finally callback (always)
  if (callbacks?.finally) {
    try {
      await callbacks.finally(batch);
    } catch (error) {
      console.error('Batch finally callback error:', error);
    }
  }

  // Cleanup
  batchCallbacks.delete(batchId);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a new job batch
 * 
 * @example
 * await batch()
 *   .add([
 *     { name: 'ProcessImage', data: { id: 1 } },
 *     { name: 'ProcessImage', data: { id: 2 } },
 *     { name: 'ProcessImage', data: { id: 3 } },
 *   ])
 *   .then((batch) => console.log(`Processed ${batch.progress.processed} images`))
 *   .catch((error, batch) => console.error(`${batch.progress.failed} failed`))
 *   .finally((batch) => console.log('Batch complete'))
 *   .progress((batch) => console.log(`Progress: ${batch.progress.percentage}%`))
 *   .dispatch();
 */
export function batch(options: BatchOptions = {}): PendingBatch {
  return new JobBatch(options);
}

/**
 * Get batch info by ID
 */
export function getBatch(batchId: string): BatchInfo | undefined {
  return batchStore.get(batchId);
}

/**
 * Cancel a batch
 */
export function cancelBatch(batchId: string): boolean {
  const batch = batchStore.get(batchId);
  if (!batch) return false;
  
  batch.status = 'cancelled';
  batch.finishedAt = Date.now();
  return true;
}

/**
 * Check if job data contains batch metadata
 */
export function isBatchedJob(jobData: any): boolean {
  return Boolean(jobData?.__batch);
}

/**
 * Get batch info from job data
 */
export function getBatchInfo(jobData: any): { id: string; jobId: string; index: number; total: number } | null {
  const meta = jobData?.__batch;
  if (!meta) return null;
  return {
    id: meta.id,
    jobId: meta.jobId,
    index: meta.index,
    total: meta.total,
  };
}

/**
 * List all active batches
 */
export function listBatches(): BatchInfo[] {
  return Array.from(batchStore.values());
}

/**
 * Clear completed batches (for cleanup)
 */
export function clearCompletedBatches(): number {
  let cleared = 0;
  for (const [id, batch] of batchStore) {
    if (batch.status === 'completed' || batch.status === 'failed' || batch.status === 'cancelled') {
      batchStore.delete(id);
      cleared++;
    }
  }
  return cleared;
}
