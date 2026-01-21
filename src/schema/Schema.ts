import { ValidationException } from '../core/exceptions/ValidationException';

// ============================================
// Core Types
// ============================================

export type Infer<T extends Schema<any>> = T['_output'];

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: ValidationException;
}

export abstract class Schema<Output = any, Input = unknown> {
  readonly _output!: Output;
  readonly _input!: Input;
  protected description?: string;
  protected isOptional: boolean = false;

  abstract parse(value: unknown): Output;
  abstract getJsonSchema(): Record<string, any>;

  safeParse(value: unknown): ParseResult<Output> {
    try {
      const data = this.parse(value);
      return { success: true, data };
    } catch (error) {
       if (error instanceof ValidationException) {
        return { success: false, error };
       }
       throw error;
    }
  }

  optional(): Schema<Output | undefined, Input | undefined> {
    const newSchema = Object.create(this);
    newSchema.isOptional = true;
    return newSchema as any;
  }

  describe(description: string): this {
    this.description = description;
    return this;
  }
}

// ============================================
// String Schema
// ============================================

class StringSchema extends Schema<string> {
  private checks: Array<(v: string) => string | null> = [];

  constructor() {
    super();
  }

  min(length: number, message?: string): this {
    this.checks.push((v) => v.length >= length ? null : (message || `String must contain at least ${length} character(s)`));
    return this;
  }

  max(length: number, message?: string): this {
    this.checks.push((v) => v.length <= length ? null : (message || `String must contain at most ${length} character(s)`));
    return this;
  }

  email(message?: string): this {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.checks.push((v) => emailRegex.test(v) ? null : (message || 'Invalid email address'));
    return this;
  }

  parse(value: unknown): string {
    if (this.isOptional && (value === undefined || value === null)) {
      return value as any;
    }

    if (typeof value !== 'string') {
      throw new ValidationException({ _errors: ['Expected string, received ' + typeof value] });
    }

    for (const check of this.checks) {
      const error = check(value);
      if (error) {
        throw new ValidationException({ _errors: [error] });
      }
    }

    return value;
  }

  getJsonSchema(): Record<string, any> {
    return {
      type: 'string',
      description: this.description,
    };
  }
}

// ============================================
// Number Schema
// ============================================

class NumberSchema extends Schema<number> {
  private checks: Array<(v: number) => string | null> = [];

  min(min: number, message?: string): this {
    this.checks.push((v) => v >= min ? null : (message || `Number must be greater than or equal to ${min}`));
    return this;
  }

  max(max: number, message?: string): this {
    this.checks.push((v) => v <= max ? null : (message || `Number must be less than or equal to ${max}`));
    return this;
  }

  parse(value: unknown): number {
    if (this.isOptional && (value === undefined || value === null)) {
      return value as any;
    }

    if (typeof value !== 'number' || isNaN(value)) {
       // Try converting string number
       if (typeof value === 'string' && !isNaN(parseFloat(value))) {
         const num = parseFloat(value);
         return this.validateChecks(num);
       }
      throw new ValidationException({ _errors: ['Expected number, received ' + typeof value] });
    }

    return this.validateChecks(value);
  }

  private validateChecks(value: number): number {
    for (const check of this.checks) {
      const error = check(value);
      if (error) {
        throw new ValidationException({ _errors: [error] });
      }
    }
    return value;
  }

  getJsonSchema(): Record<string, any> {
    return {
      type: 'number',
      description: this.description,
    };
  }
}

// ============================================
// Boolean Schema
// ============================================

class BooleanSchema extends Schema<boolean> {
  parse(value: unknown): boolean {
    if (this.isOptional && (value === undefined || value === null)) {
      return value as any;
    }

    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new ValidationException({ _errors: ['Expected boolean, received ' + typeof value] });
  }

  getJsonSchema(): Record<string, any> {
    return {
      type: 'boolean',
      description: this.description,
    };
  }
}

// ============================================
// Object Schema
// ============================================

class ObjectSchema<T extends Record<string, Schema<any>>> extends Schema<{ [K in keyof T]: Infer<T[K]> }> {
  constructor(private shape: T) {
    super();
  }

  parse(value: unknown): { [K in keyof T]: Infer<T[K]> } {
    if (this.isOptional && (value === undefined || value === null)) {
      return value as any;
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationException({ _errors: ['Expected object, received ' + typeof value] });
    }

    const result: any = {};
    const errors = new Map<string, string[]>();

    for (const [key, schema] of Object.entries(this.shape)) {
      try {
        result[key] = schema.parse((value as any)[key]);
      } catch (err: unknown) {
        if (err instanceof ValidationException) {
           const fieldErrors = err.errors.get('_errors') || [];
            // If the child error has map errors (nested object), merge them
            if (err.errors.size > 0 && !err.errors.has('_errors')) {
               err.errors.forEach((msgs: string[], path: string) => {
                 errors.set(`${key}.${path}`, msgs);
               });
            } else {
               errors.set(key, fieldErrors);
            }
        } else {
          errors.set(key, ['Invalid value']);
        }
      }
    }

    if (errors.size > 0) {
      throw new ValidationException(errors);
    }

    return result;
  }

  getJsonSchema(): Record<string, any> {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, schema] of Object.entries(this.shape)) {
      properties[key] = schema.getJsonSchema();
      if (!(schema as any).isOptional) {
         // Actually we can check isOptional property
         if (!(schema as any).isOptional) {
           required.push(key);
         }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      description: this.description,
    };
  }
}

// ============================================
// Array Schema
// ============================================

class ArraySchema<T extends Schema<any>> extends Schema<Infer<T>[]> {
  constructor(private element: T) {
    super();
  }

  parse(value: unknown): Infer<T>[] {
    if (this.isOptional && (value === undefined || value === null)) {
      return value as any;
    }

    if (!Array.isArray(value)) {
      throw new ValidationException({ _errors: ['Expected array, received ' + typeof value] });
    }

    return value.map((item, index) => {
      try {
        return this.element.parse(item);
      } catch (err: unknown) {
        if (err instanceof ValidationException) {
           throw new ValidationException({ [index]: err.errors.get('_errors') || ['Invalid Item'] });
        }
        throw err;
      }
    });
  }

  getJsonSchema(): Record<string, any> {
    return {
      type: 'array',
      items: this.element.getJsonSchema(),
      description: this.description,
    };
  }
}

// ============================================
// Builder
// ============================================

export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  object: <T extends Record<string, Schema<any>>>(shape: T) => new ObjectSchema(shape),
  array: <T extends Schema<any>>(element: T) => new ArraySchema(element),
};
