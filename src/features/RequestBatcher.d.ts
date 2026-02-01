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
export declare class RequestBatcher {
    private pending;
    private batchWindow;
    private maxBatchSize;
    private dedupeEnabled;
    constructor(options?: {
        batchWindow?: number;
        maxBatchSize?: number;
        dedupe?: boolean;
    });
    /**
     * Add request to current batch
     */
    add(request: Omit<BatchedRequest, 'id'>): Promise<BatchedResponse>;
    /**
     * Execute all pending requests
     */
    private flush;
    /**
     * Process batch endpoint handler
     */
    processBatch(requests: BatchedRequest[], handler: (req: BatchedRequest) => Promise<BatchedResponse>): Promise<BatchedResponse[]>;
}
export declare function createBatcher(options?: {
    batchWindow?: number;
    maxBatchSize?: number;
    dedupe?: boolean;
}): RequestBatcher;
export default RequestBatcher;
