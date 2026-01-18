/**
 * CanxJS Gate - Authorization Gates and Policies
 * Laravel-compatible authorization with TypeScript improvements
 */

import type { CanxRequest } from '../types';

// ============================================
// Types
// ============================================

export type Ability = string;
export type GateCallback<T = unknown> = (user: unknown, resource?: T) => boolean | Promise<boolean>;
export type PolicyMethod<T = unknown> = (user: unknown, model?: T) => boolean | Promise<boolean>;

export interface PolicyClass<T = unknown> {
  new (): Policy<T>;
}

export interface Policy<T = unknown> {
  before?(user: unknown, ability: Ability): boolean | null | Promise<boolean | null>;
  view?(user: unknown, model?: T): boolean | Promise<boolean>;
  create?(user: unknown, model?: T): boolean | Promise<boolean>;
  update?(user: unknown, model?: T): boolean | Promise<boolean>;
  delete?(user: unknown, model?: T): boolean | Promise<boolean>;
  restore?(user: unknown, model?: T): boolean | Promise<boolean>;
  forceDelete?(user: unknown, model?: T): boolean | Promise<boolean>;
  // Allow any other method names
  [key: string]: PolicyMethod<T> | ((user: unknown, ability: Ability) => boolean | null | Promise<boolean | null>) | undefined;
}

export interface GateOptions {
  /**
   * Default response when no gate is defined
   */
  defaultDeny?: boolean;

  /**
   * Get the current user from request
   */
  userResolver?: (req: CanxRequest) => unknown | Promise<unknown>;
}

// ============================================
// Gate Class
// ============================================

class Gate {
  private abilities: Map<Ability, GateCallback> = new Map();
  private policies: Map<Function, PolicyClass> = new Map();
  private beforeCallbacks: Array<(user: unknown, ability: Ability) => boolean | null | Promise<boolean | null>> = [];
  private afterCallbacks: Array<(user: unknown, ability: Ability, result: boolean) => void> = [];
  private options: GateOptions = {
    defaultDeny: true,
  };

  /**
   * Configure gate options
   */
  configure(options: Partial<GateOptions>): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Define a new gate ability
   */
  define<T = unknown>(ability: Ability, callback: GateCallback<T>): this {
    this.abilities.set(ability, callback as GateCallback);
    return this;
  }

  /**
   * Register a policy for a model class
   */
  policy<T>(modelClass: Function, policyClass: PolicyClass<T>): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.policies.set(modelClass, policyClass as any);
    return this;
  }

  /**
   * Register a before callback (runs before all checks)
   */
  before(callback: (user: unknown, ability: Ability) => boolean | null | Promise<boolean | null>): this {
    this.beforeCallbacks.push(callback);
    return this;
  }

  /**
   * Register an after callback (runs after all checks)
   */
  after(callback: (user: unknown, ability: Ability, result: boolean) => void): this {
    this.afterCallbacks.push(callback);
    return this;
  }

  /**
   * Check if user has ability
   */
  async allows<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean> {
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
  async denies<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean> {
    return !(await this.allows(user, ability, resource));
  }

  /**
   * Check multiple abilities (user must have all)
   */
  async all(user: unknown, abilities: Ability[], resource?: unknown): Promise<boolean> {
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
  async any(user: unknown, abilities: Ability[], resource?: unknown): Promise<boolean> {
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
  async none(user: unknown, abilities: Ability[], resource?: unknown): Promise<boolean> {
    return !(await this.any(user, abilities, resource));
  }

  /**
   * Authorize or throw exception
   */
  async authorize<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<void> {
    if (!(await this.allows(user, ability, resource))) {
      throw new AuthorizationException(`This action is unauthorized: ${ability}`);
    }
  }

  /**
   * Get policy for a model
   */
  getPolicyFor<T>(model: T): Policy<T> | null {
    if (!model || typeof model !== 'object') return null;
    
    const constructor = (model as object).constructor;
    const PolicyClass = this.policies.get(constructor);
    
    if (PolicyClass) {
      return new PolicyClass() as Policy<T>;
    }
    
    return null;
  }

  /**
   * Check policy for a model
   */
  private async checkPolicy<T>(user: unknown, ability: Ability, model: T): Promise<boolean | null> {
    const policy = this.getPolicyFor(model);
    if (!policy) return null;

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
      return await (method as any).call(policy, user, model);
    }

    return null;
  }

  /**
   * Run after callbacks
   */
  private runAfterCallbacks(user: unknown, ability: Ability, result: boolean): void {
    for (const callback of this.afterCallbacks) {
      callback(user, ability, result);
    }
  }

  /**
   * Create a Gate for a specific user (for chaining)
   */
  forUser(user: unknown): UserGate {
    return new UserGate(this, user);
  }
}

// ============================================
// User Gate (Bound to a specific user)
// ============================================

class UserGate {
  constructor(private gate: Gate, private user: unknown) {}

  async allows<T = unknown>(ability: Ability, resource?: T): Promise<boolean> {
    return this.gate.allows(this.user, ability, resource);
  }

  async denies<T = unknown>(ability: Ability, resource?: T): Promise<boolean> {
    return this.gate.denies(this.user, ability, resource);
  }

  async all(abilities: Ability[], resource?: unknown): Promise<boolean> {
    return this.gate.all(this.user, abilities, resource);
  }

  async any(abilities: Ability[], resource?: unknown): Promise<boolean> {
    return this.gate.any(this.user, abilities, resource);
  }

  async authorize<T = unknown>(ability: Ability, resource?: T): Promise<void> {
    return this.gate.authorize(this.user, ability, resource);
  }
}

// ============================================
// Authorization Exception
// ============================================

export class AuthorizationException extends Error {
  public statusCode: number = 403;
  
  constructor(message: string = 'This action is unauthorized.') {
    super(message);
    this.name = 'AuthorizationException';
  }
}

// ============================================
// Gate Middleware
// ============================================

import type { MiddlewareHandler } from '../types';

/**
 * Middleware to check authorization
 */
export function can(ability: Ability, resourceGetter?: (req: CanxRequest) => unknown): MiddlewareHandler {
  return async (req, res, next) => {
    const user = req.user || req.context?.get('user');
    const resource = resourceGetter ? resourceGetter(req) : undefined;

    if (!(await gate.allows(user, ability, resource))) {
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
export function cannot(ability: Ability, resourceGetter?: (req: CanxRequest) => unknown): MiddlewareHandler {
  return async (req, res, next) => {
    const user = req.user || req.context?.get('user');
    const resource = resourceGetter ? resourceGetter(req) : undefined;

    if (await gate.allows(user, ability, resource)) {
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
export function canAny(abilities: Ability[], resourceGetter?: (req: CanxRequest) => unknown): MiddlewareHandler {
  return async (req, res, next) => {
    const user = req.user || req.context?.get('user');
    const resource = resourceGetter ? resourceGetter(req) : undefined;

    if (!(await gate.any(user, abilities, resource))) {
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

const policyRegistry = new Map<string, PolicyClass>();

export function RegisterPolicy(modelName: string): ClassDecorator {
  return (target) => {
    policyRegistry.set(modelName, target as unknown as PolicyClass);
    return target;
  };
}

// ============================================
// Global Gate Instance & Helpers
// ============================================

export const gate = new Gate();

/**
 * Define a gate ability
 */
export function defineGate<T = unknown>(ability: Ability, callback: GateCallback<T>): Gate {
  return gate.define(ability, callback);
}

/**
 * Register a policy
 */
export function registerPolicy<T>(modelClass: Function, policyClass: PolicyClass<T>): Gate {
  return gate.policy(modelClass, policyClass);
}

/**
 * Define a policy inline (without class syntax)
 * Returns a policy object that can be used directly
 */
export function definePolicy<T = unknown>(methods: Partial<Policy<T>>): Policy<T> {
  return methods as Policy<T>;
}

/**
 * Check if user can perform ability
 */
export async function allows<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean> {
  return gate.allows(user, ability, resource);
}

/**
 * Check if user is denied ability
 */
export async function denies<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean> {
  return gate.denies(user, ability, resource);
}

/**
 * Authorize or throw
 */
export async function authorize<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<void> {
  return gate.authorize(user, ability, resource);
}

export { Gate, UserGate };
export default gate;
