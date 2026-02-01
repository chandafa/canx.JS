"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TracingModule = void 0;
exports.Trace = Trace;
const Module_1 = require("../core/Module");
// Default Noop Implementation
class NoopSpan {
    end() { }
    setAttribute() { }
    recordException() { }
}
class ConsoleTracer {
    startSpan(name) {
        const start = performance.now();
        console.log(`[Trace] Start: ${name}`);
        return {
            end: () => console.log(`[Trace] End: ${name} (${(performance.now() - start).toFixed(2)}ms)`),
            setAttribute: (k, v) => console.log(`[Trace] [${name}] ${k}=${v}`),
            recordException: (err) => console.error(`[Trace] [${name}] Error:`, err),
        };
    }
}
// Decorator to trace methods
function Trace(name) {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        const spanName = name || String(propertyKey);
        descriptor.value = async function (...args) {
            // In a real implementation, we'd get the Tracer from a global context or storage
            // For now we just log to console or use a global singleton if available
            const tracer = globalThis.__CANX_TRACER__ || new ConsoleTracer();
            const span = tracer.startSpan(spanName);
            try {
                const result = await originalMethod.apply(this, args);
                span.end();
                return result;
            }
            catch (error) {
                span.recordException(error);
                span.end();
                throw error;
            }
        };
        return descriptor;
    };
}
let TracingModule = class TracingModule {
};
exports.TracingModule = TracingModule;
exports.TracingModule = TracingModule = __decorate([
    (0, Module_1.Global)(),
    (0, Module_1.CanxModule)({
        providers: [
            {
                provide: 'TRACER',
                useValue: new ConsoleTracer(),
            },
        ],
        exports: ['TRACER'],
    })
], TracingModule);
