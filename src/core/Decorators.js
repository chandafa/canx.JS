"use strict";
/**
 * CanxJS Parameter Decorators
 * NestJS-compatible parameter decorators for request handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.customParamFactories = exports.paramMetadataStore = exports.ParseArrayPipe = exports.UpperCasePipe = exports.LowerCasePipe = exports.TrimPipe = exports.ParseJsonPipe = exports.ParseUUIDPipe = exports.ParseBoolPipe = exports.ParseFloatPipe = exports.ParseIntPipe = exports.Response = exports.Request = void 0;
exports.Body = Body;
exports.Param = Param;
exports.Query = Query;
exports.Headers = Headers;
exports.Req = Req;
exports.Res = Res;
exports.User = User;
exports.Ip = Ip;
exports.Session = Session;
exports.UploadedFiles = UploadedFiles;
exports.UploadedFile = UploadedFile;
exports.createCustomParamDecorator = createCustomParamDecorator;
exports.getParamMetadata = getParamMetadata;
exports.resolveParam = resolveParam;
exports.resolveParams = resolveParams;
exports.DefaultValuePipe = DefaultValuePipe;
exports.ZodValidationPipe = ZodValidationPipe;
// ============================================
// Metadata Storage
// ============================================
// Parameter metadata storage
const paramMetadataStore = new Map();
exports.paramMetadataStore = paramMetadataStore;
// ============================================
// Helper Functions
// ============================================
function getParamKey(target, propertyKey) {
    return `${target.constructor.name}:${String(propertyKey)}`;
}
function createParamDecorator(type, data, ...pipes) {
    return (target, propertyKey, parameterIndex) => {
        if (propertyKey === undefined)
            return;
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
function Body(property, ...pipes) {
    return createParamDecorator('body', property, ...pipes);
}
/**
 * Extract route parameter
 * @param param - Parameter name from route
 * @example
 * async findOne(@Param('id') id: string) { }
 * async findOne(@Param() params: { id: string }) { }
 */
function Param(param, ...pipes) {
    return createParamDecorator('param', param, ...pipes);
}
/**
 * Extract query parameter
 * @param key - Query parameter name
 * @example
 * async list(@Query('page') page: string) { }
 * async search(@Query() query: SearchDto) { }
 */
function Query(key, ...pipes) {
    return createParamDecorator('query', key, ...pipes);
}
/**
 * Extract request header
 * @param name - Header name
 * @example
 * async handle(@Headers('authorization') auth: string) { }
 * async handle(@Headers() headers: Record<string, string>) { }
 */
function Headers(name) {
    return createParamDecorator('headers', name);
}
/**
 * Inject full request object
 * @example
 * async handle(@Req() req: CanxRequest) { }
 */
function Req() {
    return createParamDecorator('request');
}
/**
 * Alias for @Req()
 */
exports.Request = Req;
/**
 * Inject response builder
 * @example
 * async handle(@Res() res: CanxResponse) { }
 */
function Res() {
    return createParamDecorator('response');
}
/**
 * Alias for @Res()
 */
exports.Response = Res;
/**
 * Inject authenticated user
 * @param property - Optional property to extract from user
 * @example
 * async profile(@User() user: User) { }
 * async profile(@User('id') userId: number) { }
 */
function User(property) {
    return createParamDecorator('user', property);
}
/**
 * Extract client IP address
 * @example
 * async log(@Ip() ip: string) { }
 */
function Ip() {
    return createParamDecorator('ip');
}
/**
 * Inject session object
 * @param property - Optional property to extract from session
 * @example
 * async getCart(@Session('cart') cart: Cart) { }
 */
function Session(property) {
    return createParamDecorator('session', property);
}
/**
 * Extract uploaded files
 * @example
 * async upload(@UploadedFiles() files: File[]) { }
 */
function UploadedFiles() {
    return createParamDecorator('files');
}
/**
 * Extract single uploaded file
 * @param fieldName - Form field name
 * @example
 * async upload(@UploadedFile('avatar') file: File) { }
 */
function UploadedFile(fieldName) {
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
function createCustomParamDecorator(factory) {
    // Store factory in a map for later resolution
    const factoryId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    customParamFactories.set(factoryId, factory);
    return (data) => {
        return (target, propertyKey, parameterIndex) => {
            if (propertyKey === undefined)
                return;
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
const customParamFactories = new Map();
exports.customParamFactories = customParamFactories;
// ============================================
// Parameter Resolution
// ============================================
/**
 * Get parameter metadata for a method
 */
function getParamMetadata(target, propertyKey) {
    const key = getParamKey(target, propertyKey);
    return paramMetadataStore.get(key) || [];
}
/**
 * Resolve parameter value from request
 */
async function resolveParam(metadata, req, res) {
    let value;
    switch (metadata.type) {
        case 'body':
            const body = await req.body();
            value = metadata.data ? body?.[metadata.data] : body;
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
            }
            else {
                // Convert Headers to object
                const headers = {};
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
            const user = req.user;
            value = metadata.data ? user?.[metadata.data] : user;
            break;
        case 'ip':
            value = req.headers.get('x-forwarded-for') ||
                req.headers.get('x-real-ip') ||
                req.ip ||
                '127.0.0.1';
            break;
        case 'session':
            const session = req.session;
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
async function resolveParams(target, propertyKey, req, res, additionalArgs = []) {
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
    const args = new Array(maxIndex + 1);
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
exports.ParseIntPipe = {
    transform(value) {
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
exports.ParseFloatPipe = {
    transform(value) {
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
exports.ParseBoolPipe = {
    transform(value) {
        if (value === 'true' || value === '1')
            return true;
        if (value === 'false' || value === '0')
            return false;
        throw new Error(`Validation failed: "${value}" is not a valid boolean`);
    }
};
/**
 * Parse string to UUID (validates format)
 */
exports.ParseUUIDPipe = {
    transform(value) {
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
exports.ParseJsonPipe = {
    transform(value) {
        try {
            return JSON.parse(value);
        }
        catch {
            throw new Error(`Validation failed: "${value}" is not valid JSON`);
        }
    }
};
/**
 * Trim whitespace from string
 */
exports.TrimPipe = {
    transform(value) {
        return typeof value === 'string' ? value.trim() : value;
    }
};
/**
 * Convert string to lowercase
 */
exports.LowerCasePipe = {
    transform(value) {
        return typeof value === 'string' ? value.toLowerCase() : value;
    }
};
/**
 * Convert string to uppercase
 */
exports.UpperCasePipe = {
    transform(value) {
        return typeof value === 'string' ? value.toUpperCase() : value;
    }
};
/**
 * Provide default value if undefined/null
 */
function DefaultValuePipe(defaultValue) {
    return {
        transform(value) {
            return value ?? defaultValue;
        }
    };
}
/**
 * Parse comma-separated string to array
 */
exports.ParseArrayPipe = {
    transform(value) {
        if (Array.isArray(value))
            return value;
        return typeof value === 'string' ? value.split(',').map(s => s.trim()) : [];
    }
};
/**
 * Validate with Zod schema
 */
function ZodValidationPipe(schema) {
    return {
        transform(value) {
            return schema.parse(value);
        }
    };
}
