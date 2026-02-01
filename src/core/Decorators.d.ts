/**
 * CanxJS Parameter Decorators
 * NestJS-compatible parameter decorators for request handling
 */
import type { CanxRequest, CanxResponse } from '../types';
declare const paramMetadataStore: Map<string, ParamMetadata[]>;
export interface ParamMetadata {
    index: number;
    type: ParamType;
    data?: string;
    pipes?: PipeTransform[];
}
export type ParamType = 'body' | 'param' | 'query' | 'headers' | 'request' | 'response' | 'user' | 'ip' | 'session' | 'files' | 'file' | 'custom';
export interface PipeTransform<T = unknown, R = unknown> {
    transform(value: T, metadata?: ParamMetadataContext): R | Promise<R>;
}
export interface ParamMetadataContext {
    type: ParamType;
    data?: string;
    metatype?: any;
}
/**
 * Extract request body
 * @param property - Optional property name to extract
 * @example
 * async create(@Body() dto: CreateUserDto) { }
 * async update(@Body('name') name: string) { }
 */
export declare function Body(property?: string, ...pipes: PipeTransform[]): ParameterDecorator;
/**
 * Extract route parameter
 * @param param - Parameter name from route
 * @example
 * async findOne(@Param('id') id: string) { }
 * async findOne(@Param() params: { id: string }) { }
 */
export declare function Param(param?: string, ...pipes: PipeTransform[]): ParameterDecorator;
/**
 * Extract query parameter
 * @param key - Query parameter name
 * @example
 * async list(@Query('page') page: string) { }
 * async search(@Query() query: SearchDto) { }
 */
export declare function Query(key?: string, ...pipes: PipeTransform[]): ParameterDecorator;
/**
 * Extract request header
 * @param name - Header name
 * @example
 * async handle(@Headers('authorization') auth: string) { }
 * async handle(@Headers() headers: Record<string, string>) { }
 */
export declare function Headers(name?: string): ParameterDecorator;
/**
 * Inject full request object
 * @example
 * async handle(@Req() req: CanxRequest) { }
 */
export declare function Req(): ParameterDecorator;
/**
 * Alias for @Req()
 */
export declare const Request: typeof Req;
/**
 * Inject response builder
 * @example
 * async handle(@Res() res: CanxResponse) { }
 */
export declare function Res(): ParameterDecorator;
/**
 * Alias for @Res()
 */
export declare const Response: typeof Res;
/**
 * Inject authenticated user
 * @param property - Optional property to extract from user
 * @example
 * async profile(@User() user: User) { }
 * async profile(@User('id') userId: number) { }
 */
export declare function User(property?: string): ParameterDecorator;
/**
 * Extract client IP address
 * @example
 * async log(@Ip() ip: string) { }
 */
export declare function Ip(): ParameterDecorator;
/**
 * Inject session object
 * @param property - Optional property to extract from session
 * @example
 * async getCart(@Session('cart') cart: Cart) { }
 */
export declare function Session(property?: string): ParameterDecorator;
/**
 * Extract uploaded files
 * @example
 * async upload(@UploadedFiles() files: File[]) { }
 */
export declare function UploadedFiles(): ParameterDecorator;
/**
 * Extract single uploaded file
 * @param fieldName - Form field name
 * @example
 * async upload(@UploadedFile('avatar') file: File) { }
 */
export declare function UploadedFile(fieldName?: string): ParameterDecorator;
/**
 * Create a custom parameter decorator
 * @param factory - Function to extract value from request
 * @example
 * const CurrentTenant = createParamDecorator((req) => req.tenant);
 *
 * // Usage:
 * async handle(@CurrentTenant() tenant: Tenant) { }
 */
export declare function createCustomParamDecorator<T = unknown>(factory: (req: CanxRequest, res: CanxResponse, data?: string) => T | Promise<T>): (data?: string) => ParameterDecorator;
declare const customParamFactories: Map<string, Function>;
/**
 * Get parameter metadata for a method
 */
export declare function getParamMetadata(target: object, propertyKey: string | symbol): ParamMetadata[];
/**
 * Resolve parameter value from request
 */
export declare function resolveParam(metadata: ParamMetadata, req: CanxRequest, res: CanxResponse): Promise<unknown>;
/**
 * Resolve all parameters for a method
 */
export declare function resolveParams(target: object, propertyKey: string | symbol, req: CanxRequest, res: CanxResponse, additionalArgs?: unknown[]): Promise<unknown[]>;
/**
 * Parse string to integer
 */
export declare const ParseIntPipe: PipeTransform<string, number>;
/**
 * Parse string to float
 */
export declare const ParseFloatPipe: PipeTransform<string, number>;
/**
 * Parse string to boolean
 */
export declare const ParseBoolPipe: PipeTransform<string, boolean>;
/**
 * Parse string to UUID (validates format)
 */
export declare const ParseUUIDPipe: PipeTransform<string, string>;
/**
 * Parse JSON string to object
 */
export declare const ParseJsonPipe: PipeTransform<string, unknown>;
/**
 * Trim whitespace from string
 */
export declare const TrimPipe: PipeTransform<string, string>;
/**
 * Convert string to lowercase
 */
export declare const LowerCasePipe: PipeTransform<string, string>;
/**
 * Convert string to uppercase
 */
export declare const UpperCasePipe: PipeTransform<string, string>;
/**
 * Provide default value if undefined/null
 */
export declare function DefaultValuePipe<T>(defaultValue: T): PipeTransform<T | undefined | null, T>;
/**
 * Parse comma-separated string to array
 */
export declare const ParseArrayPipe: PipeTransform<string, string[]>;
/**
 * Validate with Zod schema
 */
export declare function ZodValidationPipe<T>(schema: {
    parse: (data: unknown) => T;
}): PipeTransform<unknown, T>;
export { paramMetadataStore, customParamFactories, };
