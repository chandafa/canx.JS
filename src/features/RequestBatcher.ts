/**
 * CanxJS RequestBatcher - Combine multiple API calls into single request
 * Unique feature: Automatic deduplication and parallel execution
 */

interface BatchedRequest {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface BatchedResponse {
  id: string;
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

interface PendingBatch {
  requests: BatchedRequest[];
  resolvers: Map<string, { resolve: (r: BatchedResponse) => void; reject: (e: Error) => void }>;
  timeout: Timer;
}

export class RequestBatcher {
  private pending: PendingBatch | null = null;
  private batchWindow: number;
  private maxBatchSize: number;
  private dedupeEnabled: boolean;

  constructor(options: { batchWindow?: number; maxBatchSize?: number; dedupe?: boolean } = {}) {
    this.batchWindow = options.batchWindow || 10; // ms
    this.maxBatchSize = options.maxBatchSize || 50;
    this.dedupeEnabled = options.dedupe ?? true;
  }

  /**
   * Add request to current batch
   */
  async add(request: Omit<BatchedRequest, 'id'>): Promise<BatchedResponse> {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const fullRequest: BatchedRequest = { ...request, id };

    // Check for duplicate (same method + path + body)
    if (this.dedupeEnabled && this.pending) {
      const duplicate = this.pending.requests.find(
        (r) => r.method === request.method && r.path === request.path && JSON.stringify(r.body) === JSON.stringify(request.body)
      );
      if (duplicate) {
        return new Promise((resolve, reject) => {
          const existing = this.pending!.resolvers.get(duplicate.id);
          if (existing) {
            const originalResolve = existing.resolve;
            existing.resolve = (r) => { originalResolve(r); resolve(r); };
          }
        });
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.pending) {
        this.pending = {
          requests: [],
          resolvers: new Map(),
          timeout: setTimeout(() => this.flush(), this.batchWindow),
        };
      }

      this.pending.requests.push(fullRequest);
      this.pending.resolvers.set(id, { resolve, reject });

      if (this.pending.requests.length >= this.maxBatchSize) {
        this.flush();
      }
    });
  }

  /**
   * Execute all pending requests
   */
  private async flush(): Promise<void> {
    if (!this.pending) return;

    const batch = this.pending;
    this.pending = null;
    clearTimeout(batch.timeout);

    try {
      // Group by independent (no dependencies) vs dependent requests
      // Execute all in parallel for maximum performance
      const results = await Promise.allSettled(
        batch.requests.map(async (req) => {
          // In real implementation, this would call the actual route handlers
          // For now, return a placeholder
          return { id: req.id, status: 200, body: null, headers: {} } as BatchedResponse;
        })
      );

      results.forEach((result, index) => {
        const req = batch.requests[index];
        const resolver = batch.resolvers.get(req.id);
        if (!resolver) return;

        if (result.status === 'fulfilled') {
          resolver.resolve(result.value);
        } else {
          resolver.reject(result.reason);
        }
      });
    } catch (error) {
      batch.resolvers.forEach(({ reject }) => reject(error as Error));
    }
  }

  /**
   * Process batch endpoint handler
   */
  async processBatch(requests: BatchedRequest[], handler: (req: BatchedRequest) => Promise<BatchedResponse>): Promise<BatchedResponse[]> {
    // Analyze dependencies and optimize execution order
    const independent: BatchedRequest[] = [];
    const dependent: Map<string, BatchedRequest[]> = new Map();

    requests.forEach((req) => {
      // Simple heuristic: POST/PUT/DELETE might depend on previous results
      if (req.method === 'GET') {
        independent.push(req);
      } else {
        const key = req.path.split('/')[1] || 'default';
        if (!dependent.has(key)) dependent.set(key, []);
        dependent.get(key)!.push(req);
      }
    });

    const results: BatchedResponse[] = [];

    // Execute independent requests in parallel
    const independentResults = await Promise.all(independent.map(handler));
    results.push(...independentResults);

    // Execute dependent requests sequentially by group
    for (const [, reqs] of dependent) {
      for (const req of reqs) {
        results.push(await handler(req));
      }
    }

    // Sort back to original order
    return requests.map((req) => results.find((r) => r.id === req.id)!);
  }
}

export function createBatcher(options?: { batchWindow?: number; maxBatchSize?: number; dedupe?: boolean }): RequestBatcher {
  return new RequestBatcher(options);
}

export default RequestBatcher;
