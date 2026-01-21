/**
 * CanxJS Swagger/OpenAPI Decorators
 * NestJS-compatible API documentation decorators
 */

// ============================================
// Metadata Storage
// ============================================

const apiMetadataStore = new Map<string, ApiMetadata>();
const apiSchemaStore = new Map<string, SchemaDefinition>();

// ============================================
// Types & Interfaces
// ============================================

export interface ApiMetadata {
  controller?: ControllerApiMeta;
  methods: Map<string, MethodApiMeta>;
}

export interface ControllerApiMeta {
  tags?: string[];
  description?: string;
  security?: SecurityRequirement[];
}

export interface MethodApiMeta {
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  operationId?: string;
  security?: SecurityRequirement[];
  parameters: ParameterMeta[];
  requestBody?: RequestBodyMeta;
  responses: Map<number | string, ResponseMeta>;
}

export interface ParameterMeta {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

export interface RequestBodyMeta {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeMeta>;
}

export interface ResponseMeta {
  description: string;
  content?: Record<string, MediaTypeMeta>;
  headers?: Record<string, HeaderMeta>;
}

export interface MediaTypeMeta {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleMeta>;
}

export interface HeaderMeta {
  description?: string;
  schema?: SchemaObject;
}

export interface ExampleMeta {
  summary?: string;
  description?: string;
  value: unknown;
}

export interface SchemaObject {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  description?: string;
  example?: unknown;
  enum?: unknown[];
  default?: unknown;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  $ref?: string;
}

export interface SecurityRequirement {
  [name: string]: string[];
}

export interface SchemaDefinition {
  type: 'object';
  properties: Record<string, SchemaObject>;
  required?: string[];
  description?: string;
}

// ============================================
// Helper Functions
// ============================================

function getApiMetaKey(target: object): string {
  return target.constructor.name;
}

function ensureApiMeta(target: object): ApiMetadata {
  const key = getApiMetaKey(target);
  if (!apiMetadataStore.has(key)) {
    apiMetadataStore.set(key, { methods: new Map() });
  }
  return apiMetadataStore.get(key)!;
}

function ensureMethodMeta(target: object, methodName: string): MethodApiMeta {
  const meta = ensureApiMeta(target);
  if (!meta.methods.has(methodName)) {
    meta.methods.set(methodName, { parameters: [], responses: new Map() });
  }
  return meta.methods.get(methodName)!;
}

// ============================================
// Class Decorators
// ============================================

/**
 * Add tags to all endpoints in a controller
 * @example
 * @ApiTags('users', 'admin')
 * @Controller('/users')
 * class UserController { }
 */
export function ApiTags(...tags: string[]): ClassDecorator {
  return (target: object) => {
    const meta = ensureApiMeta((target as any).prototype);
    meta.controller = meta.controller || {};
    meta.controller.tags = tags;
  };
}

/**
 * Add security requirement to all endpoints in a controller
 * @example
 * @ApiBearerAuth()
 * @Controller('/users')
 * class UserController { }
 */
export function ApiBearerAuth(name: string = 'bearer'): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    const securityRequirement = { [name]: [] };
    
    if (propertyKey) {
      // Method decorator
      const meta = ensureMethodMeta(target, String(propertyKey));
      meta.security = meta.security || [];
      meta.security.push(securityRequirement);
    } else {
      // Class decorator
      const meta = ensureApiMeta(target.prototype);
      meta.controller = meta.controller || {};
      meta.controller.security = meta.controller.security || [];
      meta.controller.security.push(securityRequirement);
    }
  };
}

/**
 * Add API key authentication requirement
 * @example
 * @ApiKeyAuth('X-API-Key')
 * @Controller('/api')
 */
export function ApiKeyAuth(name: string = 'apiKey', inHeader: boolean = true): ClassDecorator & MethodDecorator {
  return ApiBearerAuth(name);
}

/**
 * Add basic authentication requirement
 */
export function ApiBasicAuth(name: string = 'basic'): ClassDecorator & MethodDecorator {
  return ApiBearerAuth(name);
}

/**
 * Add OAuth2 authentication requirement
 */
export function ApiOAuth2(scopes: string[] = [], name: string = 'oauth2'): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    const securityRequirement = { [name]: scopes };
    
    if (propertyKey) {
      const meta = ensureMethodMeta(target, String(propertyKey));
      meta.security = meta.security || [];
      meta.security.push(securityRequirement);
    } else {
      const meta = ensureApiMeta(target.prototype);
      meta.controller = meta.controller || {};
      meta.controller.security = meta.controller.security || [];
      meta.controller.security.push(securityRequirement);
    }
  };
}

// ============================================
// Method Decorators
// ============================================

export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  operationId?: string;
  deprecated?: boolean;
  tags?: string[];
}

/**
 * Describe an API operation
 * @example
 * @ApiOperation({ summary: 'Get user by ID', description: 'Returns a user' })
 * @Get(':id')
 * findOne(@Param('id') id: string) { }
 */
export function ApiOperation(options: ApiOperationOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    Object.assign(meta, options);
  };
}

export interface ApiResponseOptions {
  status?: number;
  description: string;
  type?: any;
  schema?: SchemaObject;
  isArray?: boolean;
  headers?: Record<string, HeaderMeta>;
  example?: unknown;
}

/**
 * Describe a possible API response
 * @example
 * @ApiResponse({ status: 200, description: 'User found', type: UserDto })
 * @ApiResponse({ status: 404, description: 'User not found' })
 */
export function ApiResponse(options: ApiResponseOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    const status = options.status || 200;
    
    let schema: SchemaObject | undefined = options.schema;
    
    // Build schema from type if provided
    if (options.type && !schema) {
      schema = buildSchemaFromType(options.type, options.isArray);
    }
    
    meta.responses.set(status, {
      description: options.description,
      content: schema ? {
        'application/json': { 
          schema,
          example: options.example,
        }
      } : undefined,
      headers: options.headers,
    });
  };
}

// Shorthand response decorators
export function ApiOkResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 200 });
}

export function ApiCreatedResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 201 });
}

export function ApiAcceptedResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 202 });
}

export function ApiNoContentResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 204 });
}

export function ApiBadRequestResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 400 });
}

export function ApiUnauthorizedResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 401 });
}

export function ApiForbiddenResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 403 });
}

export function ApiNotFoundResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 404 });
}

export function ApiConflictResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 409 });
}

export function ApiUnprocessableEntityResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 422 });
}

export function ApiInternalServerErrorResponse(options: Omit<ApiResponseOptions, 'status'>) {
  return ApiResponse({ ...options, status: 500 });
}

// ============================================
// Parameter Decorators (for documentation)
// ============================================

export interface ApiParamOptions {
  name: string;
  description?: string;
  required?: boolean;
  type?: 'string' | 'number' | 'integer' | 'boolean';
  enum?: unknown[];
  example?: unknown;
}

/**
 * Document a path parameter
 * @example
 * @ApiParam({ name: 'id', description: 'User ID', type: 'string' })
 */
export function ApiParam(options: ApiParamOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    meta.parameters.push({
      name: options.name,
      in: 'path',
      description: options.description,
      required: options.required ?? true,
      schema: {
        type: options.type || 'string',
        enum: options.enum,
      },
      example: options.example,
    });
  };
}

export interface ApiQueryOptions {
  name: string;
  description?: string;
  required?: boolean;
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  enum?: unknown[];
  example?: unknown;
  isArray?: boolean;
}

/**
 * Document a query parameter
 * @example
 * @ApiQuery({ name: 'page', type: 'integer', required: false })
 */
export function ApiQuery(options: ApiQueryOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    
    let schema: SchemaObject = { type: options.type || 'string' };
    if (options.isArray || options.type === 'array') {
      schema = { type: 'array', items: { type: 'string' } };
    }
    if (options.enum) {
      schema.enum = options.enum;
    }
    
    meta.parameters.push({
      name: options.name,
      in: 'query',
      description: options.description,
      required: options.required ?? false,
      schema,
      example: options.example,
    });
  };
}

export interface ApiHeaderOptions {
  name: string;
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
}

/**
 * Document a header parameter
 */
export function ApiHeader(options: ApiHeaderOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    meta.parameters.push({
      name: options.name,
      in: 'header',
      description: options.description,
      required: options.required ?? false,
      schema: options.schema || { type: 'string' },
    });
  };
}

export interface ApiBodyOptions {
  description?: string;
  required?: boolean;
  type?: any;
  schema?: SchemaObject;
  isArray?: boolean;
  examples?: Record<string, ExampleMeta>;
}

/**
 * Document request body
 * @example
 * @ApiBody({ type: CreateUserDto, description: 'User data' })
 */
export function ApiBody(options: ApiBodyOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    
    let schema: SchemaObject | undefined = options.schema;
    if (options.type && !schema) {
      schema = buildSchemaFromType(options.type, options.isArray);
    }
    
    meta.requestBody = {
      description: options.description,
      required: options.required ?? true,
      content: {
        'application/json': {
          schema: schema || { type: 'object' },
          examples: options.examples,
        },
      },
    };
  };
}

// ============================================
// Property Decorator (for DTOs)
// ============================================

const propertyMetadataStore = new Map<string, Map<string, PropertyMeta>>();

export interface PropertyMeta {
  type?: string;
  description?: string;
  required?: boolean;
  example?: unknown;
  enum?: unknown[];
  default?: unknown;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  isArray?: boolean;
  items?: any;
}

export interface ApiPropertyOptions extends PropertyMeta {}

/**
 * Document a DTO property
 * @example
 * class CreateUserDto {
 *   @ApiProperty({ description: 'User email', example: 'user@example.com' })
 *   email: string;
 * 
 *   @ApiProperty({ required: false, default: 'user' })
 *   role?: string;
 * }
 */
export function ApiProperty(options: ApiPropertyOptions = {}): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const className = target.constructor.name;
    
    if (!propertyMetadataStore.has(className)) {
      propertyMetadataStore.set(className, new Map());
    }
    
    const properties = propertyMetadataStore.get(className)!;
    properties.set(String(propertyKey), {
      required: true,
      ...options,
    });
  };
}

/**
 * Mark property as optional in documentation
 */
export function ApiPropertyOptional(options: ApiPropertyOptions = {}): PropertyDecorator {
  return ApiProperty({ ...options, required: false });
}

/**
 * Hide property from documentation
 */
export function ApiHideProperty(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const className = target.constructor.name;
    if (propertyMetadataStore.has(className)) {
      propertyMetadataStore.get(className)!.delete(String(propertyKey));
    }
  };
}

// ============================================
// Schema Building Utilities
// ============================================

/**
 * Build OpenAPI schema from a class type
 */
export function buildSchemaFromType(type: any, isArray: boolean = false): SchemaObject {
  if (!type) return { type: 'object' };
  
  // Primitive types
  if (type === String) return isArray ? { type: 'array', items: { type: 'string' } } : { type: 'string' };
  if (type === Number) return isArray ? { type: 'array', items: { type: 'number' } } : { type: 'number' };
  if (type === Boolean) return isArray ? { type: 'array', items: { type: 'boolean' } } : { type: 'boolean' };
  
  // Check for registered schema
  const className = type.name;
  if (propertyMetadataStore.has(className)) {
    const properties = propertyMetadataStore.get(className)!;
    const schema: SchemaObject = {
      type: 'object',
      properties: {},
      required: [],
    };
    
    for (const [propName, propMeta] of properties) {
      const propSchema: SchemaObject = {
        type: propMeta.type as any || 'string',
        description: propMeta.description,
        example: propMeta.example,
        enum: propMeta.enum,
        default: propMeta.default,
        nullable: propMeta.nullable,
        minimum: propMeta.minimum,
        maximum: propMeta.maximum,
        minLength: propMeta.minLength,
        maxLength: propMeta.maxLength,
        pattern: propMeta.pattern,
      };
      
      // Handle arrays
      if (propMeta.isArray) {
        schema.properties![propName] = {
          type: 'array',
          items: propMeta.items ? buildSchemaFromType(propMeta.items) : propSchema,
        };
      } else {
        schema.properties![propName] = propSchema;
      }
      
      if (propMeta.required) {
        schema.required!.push(propName);
      }
    }
    
    // Store as reusable schema
    apiSchemaStore.set(className, schema as SchemaDefinition);
    
    if (isArray) {
      return { type: 'array', items: { $ref: `#/components/schemas/${className}` } };
    }
    return { $ref: `#/components/schemas/${className}` };
  }
  
  // Fallback to object
  const baseSchema: SchemaObject = { type: 'object' };
  return isArray ? { type: 'array', items: baseSchema } : baseSchema;
}

// ============================================
// Metadata Retrieval
// ============================================

export function getApiMetadata(target: object): ApiMetadata | undefined {
  return apiMetadataStore.get(getApiMetaKey(target));
}

export function getApiMetadataByName(className: string): ApiMetadata | undefined {
  return apiMetadataStore.get(className);
}

export function getAllApiMetadata(): Map<string, ApiMetadata> {
  return apiMetadataStore;
}

export function getSchemaDefinitions(): Map<string, SchemaDefinition> {
  return apiSchemaStore;
}

export function getPropertyMetadata(className: string): Map<string, PropertyMeta> | undefined {
  return propertyMetadataStore.get(className);
}

// ============================================
// Additional Decorators
// ============================================

/**
 * Exclude endpoint from documentation
 */
export function ApiExcludeEndpoint(): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    (meta as any).excluded = true;
  };
}

/**
 * Exclude controller from documentation
 */
export function ApiExcludeController(): ClassDecorator {
  return (target: object) => {
    const meta = ensureApiMeta((target as any).prototype);
    (meta as any).excluded = true;
  };
}

/**
 * Add produces media types
 */
export function ApiProduces(...mimeTypes: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    (meta as any).produces = mimeTypes;
  };
}

/**
 * Add consumes media types
 */
export function ApiConsumes(...mimeTypes: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const meta = ensureMethodMeta(target, String(propertyKey));
    (meta as any).consumes = mimeTypes;
  };
}
