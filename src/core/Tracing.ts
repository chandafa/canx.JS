import { CanxModule, Global } from '../core/Module';

// Simple Tracer Interface compatible with OTel
export interface Tracer {
  startSpan(name: string): Span;
}

export interface Span {
  end(): void;
  setAttribute(key: string, value: any): void;
  recordException(error: any): void;
}

// Default Noop Implementation
class NoopSpan implements Span {
  end() {}
  setAttribute() {}
  recordException() {}
}

class ConsoleTracer implements Tracer {
  startSpan(name: string) {
    const start = performance.now();
    console.log(`[Trace] Start: ${name}`);
    return {
      end: () => console.log(`[Trace] End: ${name} (${(performance.now() - start).toFixed(2)}ms)`),
      setAttribute: (k: string, v: any) => console.log(`[Trace] [${name}] ${k}=${v}`),
      recordException: (err: any) => console.error(`[Trace] [${name}] Error:`, err),
    };
  }
}

// Decorator to trace methods
export function Trace(name?: string): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const spanName = name || String(propertyKey);

    descriptor.value = async function (...args: any[]) {
      // In a real implementation, we'd get the Tracer from a global context or storage
      // For now we just log to console or use a global singleton if available
      const tracer = (globalThis as any).__CANX_TRACER__ || new ConsoleTracer();
      const span = tracer.startSpan(spanName);

      try {
        const result = await originalMethod.apply(this, args);
        span.end();
        return result;
      } catch (error) {
        span.recordException(error);
        span.end();
        throw error;
      }
    };
    return descriptor;
  };
}

@Global()
@CanxModule({
  providers: [
    {
      provide: 'TRACER',
      useValue: new ConsoleTracer(),
    },
  ],
  exports: ['TRACER'],
})
export class TracingModule {}
