/**
 * CanxJS Circuit Breaker - Fault tolerance for external services
 * @description Prevents cascading failures by detecting failures and short-circuiting requests
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Name for logging/metrics */
  name?: string;
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Number of successes in half-open to close circuit */
  successThreshold?: number;
  /** Time in ms before attempting half-open */
  timeout?: number;
  /** Sliding window size in ms for failure counting */
  windowSize?: number;
  /** Custom failure detector */
  isFailure?: (error: unknown) => boolean;
  /** Fallback function when circuit is open */
  fallback?: <T>() => T | Promise<T>;
  /** Enable metrics collection */
  metrics?: boolean;
}

interface CircuitMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChanges: { state: CircuitState; timestamp: Date }[];
}

interface FailureRecord {
  timestamp: number;
  error?: unknown;
}

/**
 * Circuit Breaker implementation
 * Implements the circuit breaker pattern for fault tolerance
 */
export class CircuitBreaker {
  private config: Required<Omit<CircuitBreakerConfig, 'fallback'>> & { fallback?: CircuitBreakerConfig['fallback'] };
  private state: CircuitState = 'CLOSED';
  private failures: FailureRecord[] = [];
  private successCount = 0;
  private lastStateChange: Date = new Date();
  private metrics: CircuitMetrics;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      name: config.name ?? 'default',
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 30000,
      windowSize: config.windowSize ?? 60000,
      isFailure: config.isFailure ?? (() => true),
      metrics: config.metrics ?? true,
      fallback: config.fallback,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: [{ state: 'CLOSED', timestamp: new Date() }],
    };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit metrics
   */
  getMetrics(): CircuitMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if circuit is allowing requests
   */
  isAllowed(): boolean {
    this.cleanupOldFailures();

    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (Date.now() - this.lastStateChange.getTime() >= this.config.timeout) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return true;
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    if (!this.isAllowed()) {
      this.metrics.rejectedRequests++;
      
      if (this.config.fallback) {
        return this.config.fallback() as T;
      }
      
      throw new CircuitBreakerError(
        `Circuit breaker '${this.config.name}' is OPEN`,
        this.config.name,
        this.state
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (this.config.isFailure(error)) {
        this.onFailure(error);
      } else {
        this.onSuccess();
      }
      throw error;
    }
  }

  /**
   * Record a successful call
   */
  private onSuccess(): void {
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessTime = new Date();

    switch (this.state) {
      case 'HALF_OPEN':
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo('CLOSED');
        }
        break;
      case 'CLOSED':
        // Reset failure count on success in closed state
        this.failures = [];
        break;
    }
  }

  /**
   * Record a failed call
   */
  private onFailure(error: unknown): void {
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = new Date();
    
    this.failures.push({
      timestamp: Date.now(),
      error,
    });

    this.cleanupOldFailures();

    switch (this.state) {
      case 'CLOSED':
        if (this.failures.length >= this.config.failureThreshold) {
          this.transitionTo('OPEN');
        }
        break;
      case 'HALF_OPEN':
        this.transitionTo('OPEN');
        break;
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    console.log(`[CircuitBreaker:${this.config.name}] ${this.state} → ${newState}`);
    
    this.state = newState;
    this.lastStateChange = new Date();
    this.metrics.stateChanges.push({ state: newState, timestamp: this.lastStateChange });

    if (newState === 'CLOSED') {
      this.failures = [];
      this.successCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successCount = 0;
    }
  }

  /**
   * Remove failures outside the sliding window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.windowSize;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Force circuit to open
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
  }

  /**
   * Force circuit to close
   */
  forceClose(): void {
    this.transitionTo('CLOSED');
  }

  /**
   * Reset circuit to initial state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.successCount = 0;
    this.lastStateChange = new Date();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: [{ state: 'CLOSED', timestamp: new Date() }],
    };
  }
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly circuitState: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// ============================================
// Circuit Breaker Registry
// ============================================

const circuitRegistry = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker
 */
export function getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
  if (!circuitRegistry.has(name)) {
    circuitRegistry.set(name, new CircuitBreaker({ ...config, name }));
  }
  return circuitRegistry.get(name)!;
}

/**
 * Create a new circuit breaker
 */
export function createCircuitBreaker(config: CircuitBreakerConfig = {}): CircuitBreaker {
  const breaker = new CircuitBreaker(config);
  if (config.name) {
    circuitRegistry.set(config.name, breaker);
  }
  return breaker;
}

/**
 * Get all circuit breaker statuses
 */
export function getCircuitBreakerStatus(): Record<string, { state: CircuitState; metrics: CircuitMetrics }> {
  const status: Record<string, { state: CircuitState; metrics: CircuitMetrics }> = {};
  for (const [name, breaker] of circuitRegistry) {
    status[name] = {
      state: breaker.getState(),
      metrics: breaker.getMetrics(),
    };
  }
  return status;
}

/**
 * Decorator for circuit breaker
 */
export function WithCircuitBreaker(nameOrConfig: string | CircuitBreakerConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const config = typeof nameOrConfig === 'string' ? { name: nameOrConfig } : nameOrConfig;
    
    descriptor.value = async function (...args: any[]) {
      const breaker = getCircuitBreaker(config.name ?? propertyKey, config);
      return breaker.execute(() => originalMethod.apply(this, args));
    };
    
    return descriptor;
  };
}

export default CircuitBreaker;
