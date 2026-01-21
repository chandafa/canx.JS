/**
 * CanxJS Parameter Decorators
 * NestJS-compatible parameter decorators for request handling
 */

import type { CanxRequest, CanxResponse } from '../types';

// ============================================
// Metadata Storage
// ============================================

// Parameter metadata storage
const paramMetadataStore = new Map<string, ParamMetadata[]>();

export interface ParamMetadata {
  index: number;
  type: ParamType;
  data?: string;
  pipes?: PipeTransform[];
}

export type ParamType = 
  | 'body' 
  | 'param' 
  | 'query' 
  | 'headers' 
  | 'request' 
  | 'response' 
  | 'user' 
  | 'ip'
  | 'session'
  | 'files'
  | 'file'
  | 'custom';

export interface PipeTransform<T = unknown, R = unknown> {
  transform(value: T, metadata?: ParamMetadataContext): R | Promise<R>;
}

export interface ParamMetadataContext {
  type: ParamType;
  data?: string;
  metatype?: any;
}

// ============================================
// Helper Functions
// ============================================

function getParamKey(target: object, propertyKey: string | symbol): string {
  return `${target.constructor.name}:${String(propertyKey)}`;
}

function createParamDecorator(type: ParamType, data?: string, ...pipes: PipeTransform[]): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    
    const key = getParamKey(target, propertyKey);
    const existing = paramMetadataStore.get(key) || [];
    
    existing.push({
      index: parameterIndex,
      type,
      data,
      pipes,
    });
    
    paramMetadataStore.set(key, existing);
  };
}

// ============================================
// Parameter Decorators
// ============================================

/**
 * Extract request body
 * @param property - Optional property name to extract
 * @example
 * async create(@Body() dto: CreateUserDto) { }
 * async update(@Body('name') name: string) { }
 */
export function Body(property?: string, ...pipes: PipeTransform[]): ParameterDecorator {
  return createParamDecorator('body', property, ...pipes);
}

/**
 * Extract route parameter
 * @param param - Parameter name from route
 * @example
 * async findOne(@Param('id') id: string) { }
 * async findOne(@Param() params: { id: string }) { }
 */
export function Param(param?: string, ...pipes: PipeTransform[]): ParameterDecorator {
  return createParamDecorator('param', param, ...pipes);
}

/**
 * Extract query parameter
 * @param key - Query parameter name
 * @example
 * async list(@Query('page') page: string) { }
 * async search(@Query() query: SearchDto) { }
 */
export function Query(key?: string, ...pipes: PipeTransform[]): ParameterDecorator {
  return createParamDecorator('query', key, ...pipes);
}

/**
 * Extract request header
 * @param name - Header name
 * @example
 * async handle(@Headers('authorization') auth: string) { }
 * async handle(@Headers() headers: Record<string, string>) { }
 */
export function Headers(name?: string): ParameterDecorator {
  return createParamDecorator('headers', name);
}

/**
 * Inject full request object
 * @example
 * async handle(@Req() req: CanxRequest) { }
 */
export function Req(): ParameterDecorator {
  return createParamDecorator('request');
}

/**
 * Alias for @Req()
 */
export const Request = Req;

/**
 * Inject response builder
 * @example
 * async handle(@Res() res: CanxResponse) { }
 */
export function Res(): ParameterDecorator {
  return createParamDecorator('response');
}

/**
 * Alias for @Res()
 */
export const Response = Res;

/**
 * Inject authenticated user
 * @param property - Optional property to extract from user
 * @example
 * async profile(@User() user: User) { }
 * async profile(@User('id') userId: number) { }
 */
export function User(property?: string): ParameterDecorator {
  return createParamDecorator('user', property);
}

/**
 * Extract client IP address
 * @example
 * async log(@Ip() ip: string) { }
 */
export function Ip(): ParameterDecorator {
  return createParamDecorator('ip');
}

/**
 * Inject session object
 * @param property - Optional property to extract from session
 * @example
 * async getCart(@Session('cart') cart: Cart) { }
 */
export function Session(property?: string): ParameterDecorator {
  return createParamDecorator('session', property);
}

/**
 * Extract uploaded files
 * @example
 * async upload(@UploadedFiles() files: File[]) { }
 */
export function UploadedFiles(): ParameterDecorator {
  return createParamDecorator('files');
}

/**
 * Extract single uploaded file
 * @param fieldName - Form field name
 * @example
 * async upload(@UploadedFile('avatar') file: File) { }
 */
export function UploadedFile(fieldName?: string): ParameterDecorator {
  return createParamDecorator('file', fieldName);
}

// ============================================
// Custom Parameter Decorator Factory
// ============================================

/**
 * Create a custom parameter decorator
 * @param factory - Function to extract value from request
 * @example
 * const CurrentTenant = createParamDecorator((req) => req.tenant);
 * 
 * // Usage:
 * async handle(@CurrentTenant() tenant: Tenant) { }
 */
export function createCustomParamDecorator<T = unknown>(
  factory: (req: CanxRequest, res: CanxResponse, data?: string) => T | Promise<T>
): (data?: string) => ParameterDecorator {
  // Store factory in a map for later resolution
  const factoryId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  customParamFactories.set(factoryId, factory);
  
  return (data?: string) => {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
      if (propertyKey === undefined) return;
      
      const key = getParamKey(target, propertyKey);
      const existing = paramMetadataStore.get(key) || [];
      
      existing.push({
        index: parameterIndex,
        type: 'custom',
        data: `${factoryId}:${data || ''}`,
      });
      
      paramMetadataStore.set(key, existing);
    };
  };
}

// Storage for custom param factories
const customParamFactories = new Map<string, Function>();

// ============================================
// Parameter Resolution
// ============================================

/**
 * Get parameter metadata for a method
 */
export function getParamMetadata(target: object, propertyKey: string | symbol): ParamMetadata[] {
  const key = getParamKey(target, propertyKey);
  return paramMetadataStore.get(key) || [];
}

/**
 * Resolve parameter value from request
 */
export async function resolveParam(
  metadata: ParamMetadata,
  req: CanxRequest,
  res: CanxResponse
): Promise<unknown> {
  let value: unknown;
  
  switch (metadata.type) {
    case 'body':
      const body = await req.body();
      value = metadata.data ? (body as any)?.[metadata.data] : body;
      break;
      
    case 'param':
      value = metadata.data ? req.params[metadata.data] : req.params;
      break;
      
    case 'query':
      value = metadata.data ? req.query[metadata.data] : req.query;
      break;
      
    case 'headers':
      if (metadata.data) {
        value = req.headers.get(metadata.data);
      } else {
        // Convert Headers to object
        const headers: Record<string, string> = {};
        req.headers.forEach((v, k) => { headers[k] = v; });
        value = headers;
      }
      break;
      
    case 'request':
      value = req;
      break;
      
    case 'response':
      value = res;
      break;
      
    case 'user':
      const user = (req as any).user;
      value = metadata.data ? user?.[metadata.data] : user;
      break;
      
    case 'ip':
      value = req.headers.get('x-forwarded-for') || 
              req.headers.get('x-real-ip') || 
              (req as any).ip || 
              '127.0.0.1';
      break;
      
    case 'session':
      const session = (req as any).session;
      value = metadata.data ? session?.[metadata.data] : session;
      break;
      
    case 'files':
      value = await req.files();
      break;
      
    case 'file':
      const files = await req.files();
      value = metadata.data ? files.get(metadata.data) : files.values().next().value;
      break;
      
    case 'custom':
      if (metadata.data) {
        const [factoryId, data] = metadata.data.split(':');
        const factory = customParamFactories.get(factoryId);
        if (factory) {
          value = await factory(req, res, data || undefined);
        }
      }
      break;
      
    default:
      value = undefined;
  }
  
  // Apply pipes if any
  if (metadata.pipes && metadata.pipes.length > 0) {
    for (const pipe of metadata.pipes) {
      value = await pipe.transform(value, {
        type: metadata.type,
        data: metadata.data,
      });
    }
  }
  
  return value;
}

/**
 * Resolve all parameters for a method
 */
export async function resolveParams(
  target: object,
  propertyKey: string | symbol,
  req: CanxRequest,
  res: CanxResponse,
  additionalArgs: unknown[] = []
): Promise<unknown[]> {
  const metadata = getParamMetadata(target, propertyKey);
  
  if (metadata.length === 0) {
    // No decorators used, fall back to (req, res) pattern
    return [req, res, ...additionalArgs];
  }
  
  // Sort by index
  const sorted = [...metadata].sort((a, b) => a.index - b.index);
  
  // Determine max param index
  const maxIndex = Math.max(...sorted.map(m => m.index));
  
  // Resolve all params
  const args: unknown[] = new Array(maxIndex + 1);
  
  for (const meta of sorted) {
    args[meta.index] = await resolveParam(meta, req, res);
  }
  
  return args;
}

// ============================================
// Built-in Pipes
// ============================================

/**
 * Parse string to integer
 */
export const ParseIntPipe: PipeTransform<string, number> = {
  transform(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Validation failed: "${value}" is not a valid integer`);
    }
    return parsed;
  }
};

/**
 * Parse string to float
 */
export const ParseFloatPipe: PipeTransform<string, number> = {
  transform(value: string): number {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`Validation failed: "${value}" is not a valid number`);
    }
    return parsed;
  }
};

/**
 * Parse string to boolean
 */
export const ParseBoolPipe: PipeTransform<string, boolean> = {
  transform(value: string): boolean {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new Error(`Validation failed: "${value}" is not a valid boolean`);
  }
};

/**
 * Parse string to UUID (validates format)
 */
export const ParseUUIDPipe: PipeTransform<string, string> = {
  transform(value: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`Validation failed: "${value}" is not a valid UUID`);
    }
    return value;
  }
};

/**
 * Parse JSON string to object
 */
export const ParseJsonPipe: PipeTransform<string, unknown> = {
  transform(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Validation failed: "${value}" is not valid JSON`);
    }
  }
};

/**
 * Trim whitespace from string
 */
export const TrimPipe: PipeTransform<string, string> = {
  transform(value: string): string {
    return typeof value === 'string' ? value.trim() : value;
  }
};

/**
 * Convert string to lowercase
 */
export const LowerCasePipe: PipeTransform<string, string> = {
  transform(value: string): string {
    return typeof value === 'string' ? value.toLowerCase() : value;
  }
};

/**
 * Convert string to uppercase
 */
export const UpperCasePipe: PipeTransform<string, string> = {
  transform(value: string): string {
    return typeof value === 'string' ? value.toUpperCase() : value;
  }
};

/**
 * Provide default value if undefined/null
 */
export function DefaultValuePipe<T>(defaultValue: T): PipeTransform<T | undefined | null, T> {
  return {
    transform(value: T | undefined | null): T {
      return value ?? defaultValue;
    }
  };
}

/**
 * Parse comma-separated string to array
 */
export const ParseArrayPipe: PipeTransform<string, string[]> = {
  transform(value: string): string[] {
    if (Array.isArray(value)) return value;
    return typeof value === 'string' ? value.split(',').map(s => s.trim()) : [];
  }
};

/**
 * Validate with Zod schema
 */
export function ZodValidationPipe<T>(schema: { parse: (data: unknown) => T }): PipeTransform<unknown, T> {
  return {
    transform(value: unknown): T {
      return schema.parse(value);
    }
  };
}

// ============================================
// Exports
// ============================================

export {
  paramMetadataStore,
  customParamFactories,
};
