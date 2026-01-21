/**
 * CanxJS Pipeline
 * Laravel-style pipeline pattern for processing data through stages
 */

// ============================================
// Types
// ============================================

export type PipeHandler<T> = (data: T, next: (data: T) => Promise<T>) => Promise<T> | T;
export type PipeFunction<T> = (data: T) => Promise<T> | T;

export interface PipeStage<T> {
  handle: PipeHandler<T>;
}

// ============================================
// Pipeline Class
// ============================================

export class Pipeline<T> {
  private passable: T;
  private pipes: Array<PipeHandler<T> | PipeStage<T>> = [];

  constructor(passable?: T) {
    this.passable = passable as T;
  }

  /**
   * Set the data to pass through pipeline
   */
  send(passable: T): this {
    this.passable = passable;
    return this;
  }

  /**
   * Add pipes to the pipeline
   */
  through(pipes: Array<PipeHandler<T> | PipeStage<T> | (new () => PipeStage<T>)>): this {
    this.pipes = pipes.map(pipe => {
      // Instantiate class if needed
      if (typeof pipe === 'function' && pipe.prototype?.handle) {
        return new (pipe as new () => PipeStage<T>)();
      }
      return pipe as PipeHandler<T> | PipeStage<T>;
    });
    return this;
  }

  /**
   * Add a single pipe
   */
  pipe(handler: PipeHandler<T> | PipeStage<T>): this {
    this.pipes.push(handler);
    return this;
  }

  /**
   * Execute the pipeline and get the result
   */
  async then<R = T>(destination?: (data: T) => R | Promise<R>): Promise<R> {
    const pipeline = this.pipes.reduceRight<(data: T) => Promise<T>>(
      (next, pipe) => {
        return async (data: T): Promise<T> => {
          if (typeof pipe === 'function') {
            // PipeHandler with 2 params
            return (pipe as PipeHandler<T>)(data, next);
          } else if (pipe && typeof pipe === 'object' && 'handle' in pipe) {
            // PipeStage object
            return (pipe as PipeStage<T>).handle(data, next);
          }
          return next(data);
        };
      },
      async (data: T) => data
    );

    const result = await pipeline(this.passable);
    
    if (destination) {
      return destination(result);
    }
    
    return result as unknown as R;
  }

  /**
   * Execute the pipeline (alias for then without destination)
   */
  async run(): Promise<T> {
    return this.then<T>();
  }

  /**
   * Execute and return result
   */
  async thenReturn(): Promise<T> {
    return this.then<T>();
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new pipeline
 */
export function pipeline<T>(passable?: T): Pipeline<T> {
  return new Pipeline<T>(passable);
}

/**
 * Create a pipe stage class
 */
export function createPipe<T>(handler: PipeHandler<T>): PipeStage<T> {
  return { handle: handler };
}

// ============================================
// Common Pipe Helpers
// ============================================

/**
 * Tap - perform action without modifying data
 */
export function tap<T>(action: (data: T) => void | Promise<void>): PipeHandler<T> {
  return async (data, next) => {
    await action(data);
    return next(data);
  };
}

/**
 * When - conditionally apply transformation
 */
export function when<T>(
  condition: boolean | ((data: T) => boolean),
  handler: PipeHandler<T>
): PipeHandler<T> {
  return async (data, next) => {
    const shouldApply = typeof condition === 'function' ? condition(data) : condition;
    if (shouldApply) {
      return handler(data, next);
    }
    return next(data);
  };
}

/**
 * Unless - inverse of when
 */
export function unless<T>(
  condition: boolean | ((data: T) => boolean),
  handler: PipeHandler<T>
): PipeHandler<T> {
  return when(
    (data) => !(typeof condition === 'function' ? condition(data) : condition),
    handler
  );
}

/**
 * Transform - apply transformation to data
 */
export function transform<T>(transformer: (data: T) => T | Promise<T>): PipeHandler<T> {
  return async (data, next) => {
    const transformed = await transformer(data);
    return next(transformed);
  };
}

export default Pipeline;
