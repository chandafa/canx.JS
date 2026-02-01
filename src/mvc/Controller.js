"use strict";
/**
 * CanxJS Controller - Base class with decorators and dependency injection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = exports.Head = exports.Options = exports.Delete = exports.Patch = exports.Put = exports.Post = exports.Get = void 0;
exports.getControllerMeta = getControllerMeta;
exports.Controller = Controller;
exports.Middleware = Middleware;
exports.wrapWithParamResolution = wrapWithParamResolution;
exports.Validate = Validate;
const Decorators_1 = require("../core/Decorators");
const View_1 = require("./View");
// Controller metadata storage
const controllerMeta = new WeakMap();
function getControllerMeta(target) {
    if (!controllerMeta.has(target)) {
        controllerMeta.set(target, { prefix: '', middlewares: [], routes: new Map() });
    }
    return controllerMeta.get(target);
}
// Decorators
function Controller(prefix = '') {
    return (target) => {
        const meta = getControllerMeta(target.prototype);
        meta.prefix = prefix.startsWith('/') ? prefix : '/' + prefix;
    };
}
function Middleware(...middlewares) {
    return (target, propertyKey, descriptor) => {
        if (propertyKey !== undefined) {
            const meta = getControllerMeta(target);
            const existing = meta.routes.get(String(propertyKey)) || { method: 'GET', path: '', middlewares: [] };
            existing.middlewares.push(...middlewares);
            meta.routes.set(String(propertyKey), existing);
        }
        else {
            const meta = getControllerMeta(target.prototype);
            meta.middlewares.push(...middlewares);
        }
    };
}
function createMethodDecorator(method) {
    return (path = '') => {
        return (target, propertyKey, descriptor) => {
            const meta = getControllerMeta(target);
            const existing = meta.routes.get(String(propertyKey)) || { method, path: '', middlewares: [] };
            existing.method = method;
            existing.path = path.startsWith('/') ? path : '/' + path;
            meta.routes.set(String(propertyKey), existing);
        };
    };
}
exports.Get = createMethodDecorator('GET');
exports.Post = createMethodDecorator('POST');
exports.Put = createMethodDecorator('PUT');
exports.Patch = createMethodDecorator('PATCH');
exports.Delete = createMethodDecorator('DELETE');
exports.Options = createMethodDecorator('OPTIONS');
exports.Head = createMethodDecorator('HEAD');
/**
 * Wrap a controller method to automatically resolve parameter decorators
 * This is called by the Router when registering controller routes
 */
function wrapWithParamResolution(controller, methodName, originalMethod) {
    return async (req, res) => {
        // Check if method uses parameter decorators
        const paramMetadata = (0, Decorators_1.getParamMetadata)(controller, methodName);
        if (paramMetadata.length > 0) {
            // Resolve all parameters using decorators
            const args = await (0, Decorators_1.resolveParams)(controller, methodName, req, res);
            return originalMethod.apply(controller, args);
        }
        else {
            // Fall back to traditional (req, res) pattern
            return originalMethod.call(controller, req, res);
        }
    };
}
/**
 * Validate decorator - validates request body against a schema
 * @param schema - Zod-like schema with parse/safeParse method
 */
function Validate(schema) {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        descriptor.value = async function (req, res) {
            try {
                const body = await req.body();
                // Support both parse and safeParse
                if (schema.safeParse) {
                    const result = schema.safeParse(body);
                    if (!result.success) {
                        return res.status(422).json({
                            error: 'Validation failed',
                            details: result.error?.issues || result.error,
                        });
                    }
                    // Attach validated data to request
                    req.validated = result.data;
                }
                else if (schema.parse) {
                    try {
                        const validated = schema.parse(body);
                        req.validated = validated;
                    }
                    catch (e) {
                        return res.status(422).json({
                            error: 'Validation failed',
                            details: e.errors || e.message,
                        });
                    }
                }
                return originalMethod.call(this, req, res);
            }
            catch (e) {
                return res.status(400).json({ error: 'Invalid request body' });
            }
        };
        return descriptor;
    };
}
// Base Controller class
class BaseController {
    request;
    response;
    setContext(req, res) {
        this.request = req;
        this.response = res;
    }
    json(data, status = 200) {
        return this.response.status(status).json(data);
    }
    html(content, status = 200) {
        return this.response.status(status).html(content);
    }
    async render(viewName, data = {}, status = 200) {
        return this.html(await (0, View_1.view)(viewName, data), status);
    }
    redirect(url, status = 302) {
        return this.response.redirect(url, status);
    }
    param(key) {
        return this.request.params[key];
    }
    query(key) {
        return this.request.query[key];
    }
    async body() {
        return this.request.body();
    }
    header(name) {
        return this.request.header(name);
    }
    cookie(name) {
        return this.request.cookie(name);
    }
    setCookie(name, value, options) {
        this.response.cookie(name, value, options);
    }
    // Additional response helpers
    created(data) {
        return this.response.status(201).json(data);
    }
    noContent() {
        return this.response.empty(204);
    }
    accepted(data) {
        return data ? this.response.status(202).json(data) : this.response.empty(202);
    }
    notFound(message = 'Not Found') {
        return this.response.status(404).json({ error: message });
    }
    badRequest(message = 'Bad Request') {
        return this.response.status(400).json({ error: message });
    }
    unauthorized(message = 'Unauthorized') {
        return this.response.status(401).json({ error: message });
    }
    forbidden(message = 'Forbidden') {
        return this.response.status(403).json({ error: message });
    }
    async validate(schema) {
        const body = await this.body();
        if ('safeParse' in schema) {
            const result = schema.safeParse(body);
            if (!result.success) {
                throw { status: 422, message: 'Validation failed', details: result.error };
            }
            return result.data;
        }
        else if ('parse' in schema) {
            return schema.parse(body);
        }
        throw new Error('Invalid schema provided');
    }
    session() {
        return this.request.session;
    }
    async validated() {
        return this.request.validated;
    }
}
exports.BaseController = BaseController;
exports.default = BaseController;
