export interface Tracer {
    startSpan(name: string): Span;
}
export interface Span {
    end(): void;
    setAttribute(key: string, value: any): void;
    recordException(error: any): void;
}
export declare function Trace(name?: string): MethodDecorator;
export declare class TracingModule {
}
