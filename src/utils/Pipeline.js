"use strict";
/**
 * CanxJS Pipeline
 * Laravel-style pipeline pattern for processing data through stages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pipeline = void 0;
exports.pipeline = pipeline;
exports.createPipe = createPipe;
exports.tap = tap;
exports.when = when;
exports.unless = unless;
exports.transform = transform;
// ============================================
// Pipeline Class
// ============================================
class Pipeline {
    passable;
    pipes = [];
    constructor(passable) {
        this.passable = passable;
    }
    /**
     * Set the data to pass through pipeline
     */
    send(passable) {
        this.passable = passable;
        return this;
    }
    /**
     * Add pipes to the pipeline
     */
    through(pipes) {
        this.pipes = pipes.map(pipe => {
            // Instantiate class if needed
            if (typeof pipe === 'function' && pipe.prototype?.handle) {
                return new pipe();
            }
            return pipe;
        });
        return this;
    }
    /**
     * Add a single pipe
     */
    pipe(handler) {
        this.pipes.push(handler);
        return this;
    }
    /**
     * Execute the pipeline and get the result
     */
    async then(destination) {
        const pipeline = this.pipes.reduceRight((next, pipe) => {
            return async (data) => {
                if (typeof pipe === 'function') {
                    // PipeHandler with 2 params
                    return pipe(data, next);
                }
                else if (pipe && typeof pipe === 'object' && 'handle' in pipe) {
                    // PipeStage object
                    return pipe.handle(data, next);
                }
                return next(data);
            };
        }, async (data) => data);
        const result = await pipeline(this.passable);
        if (destination) {
            return destination(result);
        }
        return result;
    }
    /**
     * Execute the pipeline (alias for then without destination)
     */
    async run() {
        return this.then();
    }
    /**
     * Execute and return result
     */
    async thenReturn() {
        return this.then();
    }
}
exports.Pipeline = Pipeline;
// ============================================
// Factory Functions
// ============================================
/**
 * Create a new pipeline
 */
function pipeline(passable) {
    return new Pipeline(passable);
}
/**
 * Create a pipe stage class
 */
function createPipe(handler) {
    return { handle: handler };
}
// ============================================
// Common Pipe Helpers
// ============================================
/**
 * Tap - perform action without modifying data
 */
function tap(action) {
    return async (data, next) => {
        await action(data);
        return next(data);
    };
}
/**
 * When - conditionally apply transformation
 */
function when(condition, handler) {
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
function unless(condition, handler) {
    return when((data) => !(typeof condition === 'function' ? condition(data) : condition), handler);
}
/**
 * Transform - apply transformation to data
 */
function transform(transformer) {
    return async (data, next) => {
        const transformed = await transformer(data);
        return next(transformed);
    };
}
exports.default = Pipeline;
