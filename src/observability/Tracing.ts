/**
 * CanxJS Tracing - OpenTelemetry wrapper for distributed tracing
 * @description Abstraction layer for distributed tracing
 */

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

export interface Span {
  context(): SpanContext;
  setAttribute(key: string, value: string | number | boolean): this;
  setAttributes(attributes: Record<string, string | number | boolean>): this;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  setStatus(status: { code: number; message?: string }): this;
  end(): void;
  recordException(exception: Error): void;
  isRecording(): boolean;
}

export interface Tracer {
  startSpan(name: string, options?: SpanOptions): Span;
  startActiveSpan<T>(name: string, fn: (span: Span) => T): T;
  startActiveSpan<T>(name: string, options: SpanOptions, fn: (span: Span) => T): T;
}

export interface SpanOptions {
  kind?: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  attributes?: Record<string, string | number | boolean>;
  root?: boolean;
}

/**
 * No-op Span implementation (when tracing is disabled or SDK not present)
 */
export class NoopSpan implements Span {
  context(): SpanContext {
    return { traceId: '00000000000000000000000000000000', spanId: '0000000000000000', traceFlags: 0 };
  }
  setAttribute(): this { return this; }
  setAttributes(): this { return this; }
  addEvent(): this { return this; }
  setStatus(): this { return this; }
  end(): void {}
  recordException(): void {}
  isRecording(): boolean { return false; }
}

/**
 * No-op Tracer implementation
 */
export class NoopTracer implements Tracer {
  startSpan(): Span {
    return new NoopSpan();
  }
  startActiveSpan<T>(name: string, optionsOrFn: SpanOptions | ((span: Span) => T), fn?: (span: Span) => T): T {
    const callback = typeof optionsOrFn === 'function' ? optionsOrFn : fn!;
    return callback(new NoopSpan());
  }
}

/**
 * Tracing Manager
 */
export class Tracing {
  private tracer: Tracer;
  private enabled: boolean;

  constructor(tracer?: Tracer) {
    this.tracer = tracer ?? new NoopTracer();
    this.enabled = !!tracer;
  }

  /**
   * Initialize with OpenTelemetry SDK
   * @param otelTracer - The OpenTelemetry tracer instance
   */
  init(otelTracer: Tracer): void {
    this.tracer = otelTracer;
    this.enabled = true;
  }

  /**
   * Start a span
   */
  startSpan(name: string, options?: SpanOptions): Span {
    return this.tracer.startSpan(name, options);
  }

  /**
   * Start an active span (with context propagation)
   */
  startActiveSpan<T>(name: string, fn: (span: Span) => T): T;
  startActiveSpan<T>(name: string, options: SpanOptions, fn: (span: Span) => T): T;
  startActiveSpan<T>(name: string, optionsOrFn: any, fn?: any): T {
    return this.tracer.startActiveSpan(name, optionsOrFn, fn);
  }

  /**
   * Middleware for HTTP tracing
   */
  middleware(options: { 
    filters?: ((req: any) => boolean)[];
    spanName?: (req: any) => string;
  } = {}) {
    return async (req: any, res: any, next: () => Promise<Response | void>): Promise<Response | void> => {
      if (!this.enabled) return next();

      if (options.filters?.some(filter => !filter(req))) {
        return next();
      }

      const name = options.spanName ? options.spanName(req) : `${req.method} ${req.route?.path || req.path}`;
      
      return this.startActiveSpan(name, {
        kind: 'SERVER',
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.route': req.route?.path || req.path,
          'http.host': req.headers.get('host'),
        },
      }, async (span) => {
        try {
          const response = await next();
          
          if (response) {
            span.setAttribute('http.status_code', response.status);
            if (response.status >= 500) {
              span.setStatus({ code: 2, message: 'Server Error' }); // 2 = ERROR
            }
          }
          
          return response;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: 2, message: (error as Error).message });
          throw error;
        } finally {
          span.end();
        }
      });
    };
  }
}

// ============================================
// Factory & Decorators
// ============================================

let tracingInstance: Tracing | null = null;

export function initTracing(tracer?: Tracer): Tracing {
  tracingInstance = new Tracing(tracer);
  return tracingInstance;
}

export function trace(): Tracing {
  if (!tracingInstance) {
    tracingInstance = new Tracing();
  }
  return tracingInstance;
}

/**
 * Decorator to trace a method
 */
export function Trace(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const tracer = trace();
      const spanName = name || `${target.constructor.name}.${propertyKey}`;
      
      return tracer.startActiveSpan(spanName, (span) => {
        try {
          const result = originalMethod.apply(this, args);
          
          if (result instanceof Promise) {
            return result
              .then((res) => {
                span.end();
                return res;
              })
              .catch((err) => {
                span.recordException(err);
                span.setStatus({ code: 2, message: err.message });
                span.end();
                throw err;
              });
          }
          
          span.end();
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: 2, message: (error as Error).message });
          span.end();
          throw error;
        }
      });
    };
    
    return descriptor;
  };
}

export default Tracing;
