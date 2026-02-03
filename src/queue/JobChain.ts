/**
 * CanxJS Job Chaining
 * 
 * Laravel-style job chaining - run multiple jobs in sequence,
 * where each job runs only after the previous one completes successfully.
 */

import { queue } from './Queue';

// ============================================
// Types
// ============================================

export interface ChainableJob {
  name: string;
  data: unknown;
  delay?: number;
}

export interface ChainOptions {
  /** Name prefix for chain identification */
  name?: string;
  /** Queue to dispatch chain to */
  queue?: string;
  /** Connection to use */
  connection?: string;
  /** Delay before starting first job (ms) */
  delay?: number;
  /** Callback when chain completes successfully */
  onComplete?: () => void | Promise<void>;
  /** Callback when any job in chain fails */
  onError?: (error: Error, job: ChainableJob) => void | Promise<void>;
}

export interface PendingChain {
  /** Add a job to the chain */
  then<T = unknown>(name: string, data: T, delay?: number): PendingChain;
  /** Set callback for successful completion */
  onComplete(callback: () => void | Promise<void>): PendingChain;
  /** Set callback for failure */
  catch(callback: (error: Error, job: ChainableJob) => void | Promise<void>): PendingChain;
  /** Dispatch the chain */
  dispatch(): Promise<string>;
}

// ============================================
// Job Chain Class
// ============================================

export class JobChain implements PendingChain {
  private jobs: ChainableJob[] = [];
  private chainId: string;
  private options: ChainOptions;
  private completeCallback?: () => void | Promise<void>;
  private errorCallback?: (error: Error, job: ChainableJob) => void | Promise<void>;

  constructor(options: ChainOptions = {}) {
    this.chainId = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.options = options;
    this.completeCallback = options.onComplete;
    this.errorCallback = options.onError;
  }

  /**
   * Add a job to the chain
   */
  then<T = unknown>(name: string, data: T, delay?: number): PendingChain {
    this.jobs.push({
      name,
      data,
      delay,
    });
    return this;
  }

  /**
   * Set callback for successful completion
   */
  onComplete(callback: () => void | Promise<void>): PendingChain {
    this.completeCallback = callback;
    return this;
  }

  /**
   * Set callback for failure
   */
  catch(callback: (error: Error, job: ChainableJob) => void | Promise<void>): PendingChain {
    this.errorCallback = callback;
    return this;
  }

  /**
   * Dispatch the chain
   */
  async dispatch(): Promise<string> {
    if (this.jobs.length === 0) {
      throw new Error('Cannot dispatch empty job chain');
    }

    // Store chain metadata for tracking
    const chainMeta = {
      id: this.chainId,
      jobs: this.jobs.map((j, i) => ({ ...j, index: i })),
      currentIndex: 0,
      startedAt: Date.now(),
      options: this.options,
    };

    // Store callbacks in memory (for same-process chains)
    chainCallbacks.set(this.chainId, {
      onComplete: this.completeCallback,
      onError: this.errorCallback,
    });

    // Dispatch first job with chain metadata
    const firstJob = this.jobs[0];
    await queue.dispatch(firstJob.name, {
      ...firstJob.data as object,
      __chain: {
        id: this.chainId,
        index: 0,
        total: this.jobs.length,
        jobs: this.jobs,
      },
    }, {
      delay: this.options.delay || firstJob.delay,
      queue: this.options.queue,
    });

    return this.chainId;
  }

  /**
   * Get the chain ID
   */
  getId(): string {
    return this.chainId;
  }

  /**
   * Get jobs in the chain
   */
  getJobs(): ChainableJob[] {
    return [...this.jobs];
  }
}

// ============================================
// Chain Callbacks Storage
// ============================================

const chainCallbacks = new Map<string, {
  onComplete?: () => void | Promise<void>;
  onError?: (error: Error, job: ChainableJob) => void | Promise<void>;
}>();

// ============================================
// Chain Continuation Handler
// ============================================

/**
 * Continue to next job in chain after current job completes.
 * Call this at the end of your job handler if dealing with chained jobs.
 */
export async function continueChain(jobData: any): Promise<void> {
  const chainMeta = jobData?.__chain;
  if (!chainMeta) return;

  const { id, index, total, jobs } = chainMeta;
  const nextIndex = index + 1;

  // Check if there are more jobs
  if (nextIndex >= total) {
    // Chain complete!
    const callbacks = chainCallbacks.get(id);
    if (callbacks?.onComplete) {
      try {
        await callbacks.onComplete();
      } catch (error) {
        console.error('Chain onComplete callback error:', error);
      }
    }
    chainCallbacks.delete(id);
    return;
  }

  // Dispatch next job in chain
  const nextJob = jobs[nextIndex];
  await queue.dispatch(nextJob.name, {
    ...nextJob.data as object,
    __chain: {
      id,
      index: nextIndex,
      total,
      jobs,
    },
  }, {
    delay: nextJob.delay,
  });
}

/**
 * Handle chain failure
 */
export async function failChain(jobData: any, error: Error): Promise<void> {
  const chainMeta = jobData?.__chain;
  if (!chainMeta) return;

  const { id, index, jobs } = chainMeta;
  const failedJob = jobs[index];

  const callbacks = chainCallbacks.get(id);
  if (callbacks?.onError) {
    try {
      await callbacks.onError(error, failedJob);
    } catch (callbackError) {
      console.error('Chain onError callback error:', callbackError);
    }
  }
  chainCallbacks.delete(id);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a new job chain
 * 
 * @example
 * await chain()
 *   .then('ProcessPayment', { orderId: 123 })
 *   .then('SendReceipt', { orderId: 123 })
 *   .then('UpdateInventory', { orderId: 123 })
 *   .onComplete(() => console.log('Order complete!'))
 *   .catch((error, job) => console.error(`Failed at ${job.name}`))
 *   .dispatch();
 */
export function chain(options: ChainOptions = {}): PendingChain {
  return new JobChain(options);
}

/**
 * Create a chain from an array of jobs
 * 
 * @example
 * await chainJobs([
 *   { name: 'Job1', data: { a: 1 } },
 *   { name: 'Job2', data: { b: 2 } },
 *   { name: 'Job3', data: { c: 3 } },
 * ]).dispatch();
 */
export function chainJobs(jobs: ChainableJob[], options: ChainOptions = {}): PendingChain {
  const jobChain = new JobChain(options);
  for (const job of jobs) {
    jobChain.then(job.name, job.data, job.delay);
  }
  return jobChain;
}

/**
 * Check if job data contains chain metadata
 */
export function isChainedJob(jobData: any): boolean {
  return Boolean(jobData?.__chain);
}

/**
 * Get chain info from job data
 */
export function getChainInfo(jobData: any): { id: string; index: number; total: number } | null {
  const meta = jobData?.__chain;
  if (!meta) return null;
  return {
    id: meta.id,
    index: meta.index,
    total: meta.total,
  };
}
