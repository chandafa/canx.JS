"use strict";
/**
 * CanxJS Gate - Authorization Gates and Policies
 * Laravel-compatible authorization with TypeScript improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGate = exports.Gate = exports.gate = exports.AuthorizationException = void 0;
exports.can = can;
exports.cannot = cannot;
exports.canAny = canAny;
exports.RegisterPolicy = RegisterPolicy;
exports.defineGate = defineGate;
exports.registerPolicy = registerPolicy;
exports.definePolicy = definePolicy;
exports.allows = allows;
exports.denies = denies;
exports.authorize = authorize;
// ============================================
// Gate Class
// ============================================
class Gate {
    abilities = new Map();
    policies = new Map();
    beforeCallbacks = [];
    afterCallbacks = [];
    options = {
        defaultDeny: true,
    };
    /**
     * Configure gate options
     */
    configure(options) {
        this.options = { ...this.options, ...options };
        return this;
    }
    /**
     * Define a new gate ability
     */
    define(ability, callback) {
        this.abilities.set(ability, callback);
        return this;
    }
    /**
     * Register a policy for a model class
     */
    policy(modelClass, policyClass) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.policies.set(modelClass, policyClass);
        return this;
    }
    /**
     * Register a before callback (runs before all checks)
     */
    before(callback) {
        this.beforeCallbacks.push(callback);
        return this;
    }
    /**
     * Register an after callback (runs after all checks)
     */
    after(callback) {
        this.afterCallbacks.push(callback);
        return this;
    }
    /**
     * Check if user has ability
     */
    async allows(user, ability, resource) {
        // Run before callbacks
        for (const callback of this.beforeCallbacks) {
            const result = await callback(user, ability);
            if (result !== null) {
                this.runAfterCallbacks(user, ability, result);
                return result;
            }
        }
        // Check policy first if resource is provided
        if (resource !== undefined && resource !== null) {
            const policyResult = await this.checkPolicy(user, ability, resource);
            if (policyResult !== null) {
                this.runAfterCallbacks(user, ability, policyResult);
                return policyResult;
            }
        }
        // Check gate ability
        const gateCallback = this.abilities.get(ability);
        if (gateCallback) {
            const result = await gateCallback(user, resource);
            this.runAfterCallbacks(user, ability, result);
            return result;
        }
        // Default deny
        const result = !this.options.defaultDeny;
        this.runAfterCallbacks(user, ability, result);
        return result;
    }
    /**
     * Check if user is denied ability
     */
    async denies(user, ability, resource) {
        return !(await this.allows(user, ability, resource));
    }
    /**
     * Check multiple abilities (user must have all)
     */
    async all(user, abilities, resource) {
        for (const ability of abilities) {
            if (!(await this.allows(user, ability, resource))) {
                return false;
            }
        }
        return true;
    }
    /**
     * Check multiple abilities (user must have any)
     */
    async any(user, abilities, resource) {
        for (const ability of abilities) {
            if (await this.allows(user, ability, resource)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if user is denied any abilities
     */
    async none(user, abilities, resource) {
        return !(await this.any(user, abilities, resource));
    }
    /**
     * Authorize or throw exception
     */
    async authorize(user, ability, resource) {
        if (!(await this.allows(user, ability, resource))) {
            throw new AuthorizationException(`This action is unauthorized: ${ability}`);
        }
    }
    /**
     * Get policy for a model
     */
    getPolicyFor(model) {
        if (!model || typeof model !== 'object')
            return null;
        const constructor = model.constructor;
        const PolicyClass = this.policies.get(constructor);
        if (PolicyClass) {
            return new PolicyClass();
        }
        return null;
    }
    /**
     * Check policy for a model
     */
    async checkPolicy(user, ability, model) {
        const policy = this.getPolicyFor(model);
        if (!policy)
            return null;
        // Check policy's before method
        if (policy.before) {
            const beforeResult = await policy.before(user, ability);
            if (beforeResult !== null) {
                return beforeResult;
            }
        }
        // Check the specific ability method
        const method = policy[ability];
        if (typeof method === 'function' && ability !== 'before') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await method.call(policy, user, model);
        }
        return null;
    }
    /**
     * Run after callbacks
     */
    runAfterCallbacks(user, ability, result) {
        for (const callback of this.afterCallbacks) {
            callback(user, ability, result);
        }
    }
    /**
     * Create a Gate for a specific user (for chaining)
     */
    forUser(user) {
        return new UserGate(this, user);
    }
}
exports.Gate = Gate;
// ============================================
// User Gate (Bound to a specific user)
// ============================================
class UserGate {
    gate;
    user;
    constructor(gate, user) {
        this.gate = gate;
        this.user = user;
    }
    async allows(ability, resource) {
        return this.gate.allows(this.user, ability, resource);
    }
    async denies(ability, resource) {
        return this.gate.denies(this.user, ability, resource);
    }
    async all(abilities, resource) {
        return this.gate.all(this.user, abilities, resource);
    }
    async any(abilities, resource) {
        return this.gate.any(this.user, abilities, resource);
    }
    async authorize(ability, resource) {
        return this.gate.authorize(this.user, ability, resource);
    }
}
exports.UserGate = UserGate;
// ============================================
// Authorization Exception
// ============================================
class AuthorizationException extends Error {
    statusCode = 403;
    constructor(message = 'This action is unauthorized.') {
        super(message);
        this.name = 'AuthorizationException';
    }
}
exports.AuthorizationException = AuthorizationException;
/**
 * Middleware to check authorization
 */
function can(ability, resourceGetter) {
    return async (req, res, next) => {
        const user = req.user || req.context?.get('user');
        const resource = resourceGetter ? resourceGetter(req) : undefined;
        if (!(await exports.gate.allows(user, ability, resource))) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: `You are not authorized to perform this action: ${ability}`,
            });
        }
        return next();
    };
}
/**
 * Middleware to deny if user has ability
 */
function cannot(ability, resourceGetter) {
    return async (req, res, next) => {
        const user = req.user || req.context?.get('user');
        const resource = resourceGetter ? resourceGetter(req) : undefined;
        if (await exports.gate.allows(user, ability, resource)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: `This action is forbidden`,
            });
        }
        return next();
    };
}
/**
 * Middleware to check any of the abilities
 */
function canAny(abilities, resourceGetter) {
    return async (req, res, next) => {
        const user = req.user || req.context?.get('user');
        const resource = resourceGetter ? resourceGetter(req) : undefined;
        if (!(await exports.gate.any(user, abilities, resource))) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: `You are not authorized to perform any of these actions`,
            });
        }
        return next();
    };
}
// ============================================
// Policy Decorator
// ============================================
const policyRegistry = new Map();
function RegisterPolicy(modelName) {
    return (target) => {
        policyRegistry.set(modelName, target);
        return target;
    };
}
// ============================================
// Global Gate Instance & Helpers
// ============================================
exports.gate = new Gate();
/**
 * Define a gate ability
 */
function defineGate(ability, callback) {
    return exports.gate.define(ability, callback);
}
/**
 * Register a policy
 */
function registerPolicy(modelClass, policyClass) {
    return exports.gate.policy(modelClass, policyClass);
}
/**
 * Define a policy inline (without class syntax)
 * Returns a policy object that can be used directly
 */
function definePolicy(methods) {
    return methods;
}
/**
 * Check if user can perform ability
 */
async function allows(user, ability, resource) {
    return exports.gate.allows(user, ability, resource);
}
/**
 * Check if user is denied ability
 */
async function denies(user, ability, resource) {
    return exports.gate.denies(user, ability, resource);
}
/**
 * Authorize or throw
 */
async function authorize(user, ability, resource) {
    return exports.gate.authorize(user, ability, resource);
}
exports.default = exports.gate;
