/**
 * CanxJS Gate - Authorization Gates and Policies
 * Laravel-compatible authorization with TypeScript improvements
 */
import type { CanxRequest } from '../types';
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
declare class Gate {
    private abilities;
    private policies;
    private beforeCallbacks;
    private afterCallbacks;
    private options;
    /**
     * Configure gate options
     */
    configure(options: Partial<GateOptions>): this;
    /**
     * Define a new gate ability
     */
    define<T = unknown>(ability: Ability, callback: GateCallback<T>): this;
    /**
     * Register a policy for a model class
     */
    policy<T>(modelClass: Function, policyClass: PolicyClass<T>): this;
    /**
     * Register a before callback (runs before all checks)
     */
    before(callback: (user: unknown, ability: Ability) => boolean | null | Promise<boolean | null>): this;
    /**
     * Register an after callback (runs after all checks)
     */
    after(callback: (user: unknown, ability: Ability, result: boolean) => void): this;
    /**
     * Check if user has ability
     */
    allows<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean>;
    /**
     * Check if user is denied ability
     */
    denies<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean>;
    /**
     * Check multiple abilities (user must have all)
     */
    all(user: unknown, abilities: Ability[], resource?: unknown): Promise<boolean>;
    /**
     * Check multiple abilities (user must have any)
     */
    any(user: unknown, abilities: Ability[], resource?: unknown): Promise<boolean>;
    /**
     * Check if user is denied any abilities
     */
    none(user: unknown, abilities: Ability[], resource?: unknown): Promise<boolean>;
    /**
     * Authorize or throw exception
     */
    authorize<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<void>;
    /**
     * Get policy for a model
     */
    getPolicyFor<T>(model: T): Policy<T> | null;
    /**
     * Check policy for a model
     */
    private checkPolicy;
    /**
     * Run after callbacks
     */
    private runAfterCallbacks;
    /**
     * Create a Gate for a specific user (for chaining)
     */
    forUser(user: unknown): UserGate;
}
declare class UserGate {
    private gate;
    private user;
    constructor(gate: Gate, user: unknown);
    allows<T = unknown>(ability: Ability, resource?: T): Promise<boolean>;
    denies<T = unknown>(ability: Ability, resource?: T): Promise<boolean>;
    all(abilities: Ability[], resource?: unknown): Promise<boolean>;
    any(abilities: Ability[], resource?: unknown): Promise<boolean>;
    authorize<T = unknown>(ability: Ability, resource?: T): Promise<void>;
}
export declare class AuthorizationException extends Error {
    statusCode: number;
    constructor(message?: string);
}
import type { MiddlewareHandler } from '../types';
/**
 * Middleware to check authorization
 */
export declare function can(ability: Ability, resourceGetter?: (req: CanxRequest) => unknown): MiddlewareHandler;
/**
 * Middleware to deny if user has ability
 */
export declare function cannot(ability: Ability, resourceGetter?: (req: CanxRequest) => unknown): MiddlewareHandler;
/**
 * Middleware to check any of the abilities
 */
export declare function canAny(abilities: Ability[], resourceGetter?: (req: CanxRequest) => unknown): MiddlewareHandler;
export declare function RegisterPolicy(modelName: string): ClassDecorator;
export declare const gate: Gate;
/**
 * Define a gate ability
 */
export declare function defineGate<T = unknown>(ability: Ability, callback: GateCallback<T>): Gate;
/**
 * Register a policy
 */
export declare function registerPolicy<T>(modelClass: Function, policyClass: PolicyClass<T>): Gate;
/**
 * Define a policy inline (without class syntax)
 * Returns a policy object that can be used directly
 */
export declare function definePolicy<T = unknown>(methods: Partial<Policy<T>>): Policy<T>;
/**
 * Check if user can perform ability
 */
export declare function allows<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean>;
/**
 * Check if user is denied ability
 */
export declare function denies<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<boolean>;
/**
 * Authorize or throw
 */
export declare function authorize<T = unknown>(user: unknown, ability: Ability, resource?: T): Promise<void>;
export { Gate, UserGate };
export default gate;
