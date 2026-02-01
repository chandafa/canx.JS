import { ValidationException } from '../core/exceptions/ValidationException';
export type Infer<T extends Schema<any>> = T['_output'];
export interface ParseResult<T> {
    success: boolean;
    data?: T;
    error?: ValidationException;
}
export declare abstract class Schema<Output = any, Input = unknown> {
    readonly _output: Output;
    readonly _input: Input;
    protected description?: string;
    protected isOptional: boolean;
    abstract parse(value: unknown): Output;
    abstract getJsonSchema(): Record<string, any>;
    safeParse(value: unknown): ParseResult<Output>;
    optional(): Schema<Output | undefined, Input | undefined>;
    describe(description: string): this;
}
declare class StringSchema extends Schema<string> {
    private checks;
    constructor();
    min(length: number, message?: string): this;
    max(length: number, message?: string): this;
    email(message?: string): this;
    parse(value: unknown): string;
    getJsonSchema(): Record<string, any>;
}
declare class NumberSchema extends Schema<number> {
    private checks;
    min(min: number, message?: string): this;
    max(max: number, message?: string): this;
    parse(value: unknown): number;
    private validateChecks;
    getJsonSchema(): Record<string, any>;
}
declare class BooleanSchema extends Schema<boolean> {
    parse(value: unknown): boolean;
    getJsonSchema(): Record<string, any>;
}
declare class ObjectSchema<T extends Record<string, Schema<any>>> extends Schema<{
    [K in keyof T]: Infer<T[K]>;
}> {
    private shape;
    constructor(shape: T);
    parse(value: unknown): {
        [K in keyof T]: Infer<T[K]>;
    };
    getJsonSchema(): Record<string, any>;
}
declare class ArraySchema<T extends Schema<any>> extends Schema<Infer<T>[]> {
    private element;
    constructor(element: T);
    parse(value: unknown): Infer<T>[];
    getJsonSchema(): Record<string, any>;
}
export declare const z: {
    string: () => StringSchema;
    number: () => NumberSchema;
    boolean: () => BooleanSchema;
    object: <T extends Record<string, Schema<any>>>(shape: T) => ObjectSchema<T>;
    array: <T extends Schema<any>>(element: T) => ArraySchema<T>;
};
export {};
