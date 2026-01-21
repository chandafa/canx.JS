/**
 * CanxJS GraphQL Code-First Module
 * Build GraphQL schemas using TypeScript decorators
 */

// ============================================
// Types & Interfaces
// ============================================

export interface FieldOptions {
  type?: GraphQLType;
  nullable?: boolean;
  description?: string;
  deprecationReason?: string;
  defaultValue?: unknown;
}

export interface ObjectTypeOptions {
  description?: string;
  implements?: Function[];
}

export interface InputTypeOptions {
  description?: string;
}

export interface ArgsOptions {
  name?: string;
  type?: GraphQLType;
  nullable?: boolean;
  defaultValue?: unknown;
}

export interface ResolverMethodOptions {
  name?: string;
  type?: GraphQLType;
  nullable?: boolean;
  description?: string;
}

export type GraphQLType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'ID'
  | '[String]'
  | '[Int]'
  | '[Float]'
  | '[Boolean]'
  | '[ID]'
  | Function
  | { list: GraphQLType }
  | { nullable: GraphQLType };

// ============================================
// Metadata Storage
// ============================================

interface TypeMetadata {
  name: string;
  kind: 'object' | 'input' | 'interface' | 'enum' | 'union';
  description?: string;
  fields: Map<string, FieldMetadata>;
  implements?: Function[];
}

interface FieldMetadata {
  name: string;
  type: GraphQLType;
  nullable: boolean;
  description?: string;
  deprecationReason?: string;
  defaultValue?: unknown;
  args?: Map<string, ArgMetadata>;
}

interface ArgMetadata {
  name: string;
  type: GraphQLType;
  nullable: boolean;
  defaultValue?: unknown;
}

interface ResolverMetadata {
  target: Function;
  resolverOf?: Function;
  queries: Map<string, ResolverFieldMetadata>;
  mutations: Map<string, ResolverFieldMetadata>;
  subscriptions: Map<string, SubscriptionMetadata>;
  fieldResolvers: Map<string, ResolverFieldMetadata>;
}

interface ResolverFieldMetadata {
  name: string;
  methodName: string;
  type: GraphQLType;
  nullable: boolean;
  description?: string;
  args: Map<string, ArgMetadata>;
}

interface SubscriptionMetadata extends ResolverFieldMetadata {
  topics: string[];
  filter?: (payload: any, variables: any, context: any) => boolean | Promise<boolean>;
}

const typeMetadataStore = new Map<Function, TypeMetadata>();
const resolverMetadataStore = new Map<Function, ResolverMetadata>();
const enumMetadataStore = new Map<Function, { name: string; values: string[] }>();

// ============================================
// Type Decorators
// ============================================

/**
 * Define a GraphQL Object Type
 */
export function ObjectType(options: ObjectTypeOptions = {}): ClassDecorator {
  return (target: Function) => {
    const existing = typeMetadataStore.get(target) || {
      name: target.name,
      kind: 'object' as const,
      fields: new Map(),
    };
    typeMetadataStore.set(target, {
      ...existing,
      kind: 'object',
      description: options.description,
      implements: options.implements,
    });
  };
}

/**
 * Define a GraphQL Input Type
 */
export function InputType(options: InputTypeOptions = {}): ClassDecorator {
  return (target: Function) => {
    const existing = typeMetadataStore.get(target) || {
      name: target.name,
      kind: 'input' as const,
      fields: new Map(),
    };
    typeMetadataStore.set(target, {
      ...existing,
      kind: 'input',
      description: options.description,
    });
  };
}

/**
 * Define a GraphQL Interface Type
 */
export function InterfaceType(options: ObjectTypeOptions = {}): ClassDecorator {
  return (target: Function) => {
    const existing = typeMetadataStore.get(target) || {
      name: target.name,
      kind: 'interface' as const,
      fields: new Map(),
    };
    typeMetadataStore.set(target, {
      ...existing,
      kind: 'interface',
      description: options.description,
    });
  };
}

/**
 * Register an enum type
 */
export function registerEnumType(
  enumObj: object,
  options: { name: string; description?: string }
): void {
  const values = Object.values(enumObj).filter(v => typeof v === 'string') as string[];
  enumMetadataStore.set(enumObj as any, { name: options.name, values });
}

// ============================================
// Field Decorators
// ============================================

/**
 * Define a field on an Object/Input/Interface type
 */
export function Field(options: FieldOptions = {}): PropertyDecorator & MethodDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const constructor = target.constructor as Function;
    const existing = typeMetadataStore.get(constructor) || {
      name: constructor.name,
      kind: 'object' as const,
      fields: new Map(),
    };

    const fieldMetadata: FieldMetadata = {
      name: String(propertyKey),
      type: options.type || 'String',
      nullable: options.nullable ?? false,
      description: options.description,
      deprecationReason: options.deprecationReason,
      defaultValue: options.defaultValue,
    };

    existing.fields.set(String(propertyKey), fieldMetadata);
    typeMetadataStore.set(constructor, existing);
  };
}

// ============================================
// Resolver Decorators
// ============================================

/**
 * Define a resolver class
 */
export function Resolver(typeFunc?: () => Function): ClassDecorator {
  return (target: Function) => {
    const existing = resolverMetadataStore.get(target) || {
      target,
      resolverOf: typeFunc?.(),
      queries: new Map(),
      mutations: new Map(),
      subscriptions: new Map(),
      fieldResolvers: new Map(),
    };
    if (typeFunc) {
      existing.resolverOf = typeFunc();
    }
    resolverMetadataStore.set(target, existing);
  };
}

/**
 * Define a Query resolver
 */
export function Query(options: ResolverMethodOptions = {}): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const constructor = target.constructor as Function;
    const existing = getOrCreateResolverMetadata(constructor);

    const queryMeta: ResolverFieldMetadata = {
      name: options.name || String(propertyKey),
      methodName: String(propertyKey),
      type: options.type || 'String',
      nullable: options.nullable ?? true,
      description: options.description,
      args: new Map(),
    };

    existing.queries.set(String(propertyKey), queryMeta);
    return descriptor;
  };
}

/**
 * Define a Mutation resolver
 */
export function Mutation(options: ResolverMethodOptions = {}): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const constructor = target.constructor as Function;
    const existing = getOrCreateResolverMetadata(constructor);

    const mutationMeta: ResolverFieldMetadata = {
      name: options.name || String(propertyKey),
      methodName: String(propertyKey),
      type: options.type || 'String',
      nullable: options.nullable ?? true,
      description: options.description,
      args: new Map(),
    };

    existing.mutations.set(String(propertyKey), mutationMeta);
    return descriptor;
  };
}

/**
 * Define a Subscription resolver
 */
export function Subscription(options: ResolverMethodOptions & { 
  topics?: string[];
  filter?: (payload: any, variables: any, context: any) => boolean | Promise<boolean>;
} = {}): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const constructor = target.constructor as Function;
    const existing = getOrCreateResolverMetadata(constructor);

    const subscriptionMeta: SubscriptionMetadata = {
      name: options.name || String(propertyKey),
      methodName: String(propertyKey),
      type: options.type || 'String',
      nullable: options.nullable ?? true,
      description: options.description,
      args: new Map(),
      topics: options.topics || [String(propertyKey)],
      filter: options.filter,
    };

    existing.subscriptions.set(String(propertyKey), subscriptionMeta);
    return descriptor;
  };
}

/**
 * Define a field resolver
 */
export function ResolveField(options: ResolverMethodOptions = {}): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const constructor = target.constructor as Function;
    const existing = getOrCreateResolverMetadata(constructor);

    const fieldMeta: ResolverFieldMetadata = {
      name: options.name || String(propertyKey),
      methodName: String(propertyKey),
      type: options.type || 'String',
      nullable: options.nullable ?? true,
      description: options.description,
      args: new Map(),
    };

    existing.fieldResolvers.set(String(propertyKey), fieldMeta);
    return descriptor;
  };
}

/**
 * Define a method argument
 */
export function Args(options: ArgsOptions | string = {}): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // Store arg metadata for the resolver method
    const opts = typeof options === 'string' ? { name: options } : options;
    const constructor = target.constructor as Function;
    const existing = getOrCreateResolverMetadata(constructor);

    // Find the resolver method and add arg
    const methodName = String(propertyKey);
    const argMeta: ArgMetadata = {
      name: opts.name || `arg${parameterIndex}`,
      type: opts.type || 'String',
      nullable: opts.nullable ?? false,
      defaultValue: opts.defaultValue,
    };

    // Add to the appropriate resolver method
    for (const map of [existing.queries, existing.mutations, existing.subscriptions, existing.fieldResolvers]) {
      const method = map.get(methodName);
      if (method) {
        method.args.set(argMeta.name, argMeta);
      }
    }
  };
}

/**
 * Inject the root/parent object
 */
export function Root(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // Mark this parameter as receiving the root/parent value
  };
}

/**
 * Inject the GraphQL context
 */
export function Context(key?: string): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // Mark this parameter as receiving the context (or a specific key from it)
  };
}

/**
 * Inject the GraphQL info object
 */
export function Info(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // Mark this parameter as receiving the GraphQL info
  };
}

// ============================================
// Helper Functions
// ============================================

function getOrCreateResolverMetadata(target: Function): ResolverMetadata {
  if (!resolverMetadataStore.has(target)) {
    resolverMetadataStore.set(target, {
      target,
      queries: new Map(),
      mutations: new Map(),
      subscriptions: new Map(),
      fieldResolvers: new Map(),
    });
  }
  return resolverMetadataStore.get(target)!;
}

// ============================================
// Schema Builder
// ============================================

export class CodeFirstSchemaBuilder {
  private types: Function[] = [];
  private resolvers: Function[] = [];
  private pubSub: PubSubEngine | null = null;

  /**
   * Add types to the schema
   */
  addTypes(...types: Function[]): this {
    this.types.push(...types);
    return this;
  }

  /**
   * Add resolvers to the schema
   */
  addResolvers(...resolvers: Function[]): this {
    this.resolvers.push(...resolvers);
    return this;
  }

  /**
   * Set the PubSub engine for subscriptions
   */
  setPubSub(pubSub: PubSubEngine): this {
    this.pubSub = pubSub;
    return this;
  }

  /**
   * Build the GraphQL schema string (SDL)
   */
  buildTypeDefs(): string {
    const lines: string[] = [];

    // Build type definitions
    for (const type of this.types) {
      const meta = typeMetadataStore.get(type);
      if (!meta) continue;

      const keyword = meta.kind === 'input' ? 'input' : meta.kind === 'interface' ? 'interface' : 'type';
      const implements_ = meta.implements?.map(i => i.name).join(' & ');
      
      lines.push(`${keyword} ${meta.name}${implements_ ? ` implements ${implements_}` : ''} {`);
      
      for (const [, field] of meta.fields) {
        const typeStr = this.typeToString(field.type, field.nullable);
        lines.push(`  ${field.name}: ${typeStr}${field.description ? ` # ${field.description}` : ''}`);
      }
      
      lines.push('}');
      lines.push('');
    }

    // Build Query type from resolvers
    const queryFields: string[] = [];
    const mutationFields: string[] = [];
    const subscriptionFields: string[] = [];

    for (const resolver of this.resolvers) {
      const meta = resolverMetadataStore.get(resolver);
      if (!meta) continue;

      for (const [, query] of meta.queries) {
        const typeStr = this.typeToString(query.type, query.nullable);
        const args = this.buildArgsString(query.args);
        queryFields.push(`  ${query.name}${args}: ${typeStr}`);
      }

      for (const [, mutation] of meta.mutations) {
        const typeStr = this.typeToString(mutation.type, mutation.nullable);
        const args = this.buildArgsString(mutation.args);
        mutationFields.push(`  ${mutation.name}${args}: ${typeStr}`);
      }

      for (const [, subscription] of meta.subscriptions) {
        const typeStr = this.typeToString(subscription.type, subscription.nullable);
        const args = this.buildArgsString(subscription.args);
        subscriptionFields.push(`  ${subscription.name}${args}: ${typeStr}`);
      }
    }

    if (queryFields.length > 0) {
      lines.push('type Query {');
      lines.push(...queryFields);
      lines.push('}');
      lines.push('');
    }

    if (mutationFields.length > 0) {
      lines.push('type Mutation {');
      lines.push(...mutationFields);
      lines.push('}');
      lines.push('');
    }

    if (subscriptionFields.length > 0) {
      lines.push('type Subscription {');
      lines.push(...subscriptionFields);
      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build resolvers object
   */
  buildResolvers(): Record<string, any> {
    const resolversObj: Record<string, any> = {
      Query: {},
      Mutation: {},
      Subscription: {},
    };

    for (const ResolverClass of this.resolvers) {
      const meta = resolverMetadataStore.get(ResolverClass);
      if (!meta) continue;

      const instance = new (ResolverClass as any)();

      // Query resolvers
      for (const [, query] of meta.queries) {
        resolversObj.Query[query.name] = (_: any, args: any, context: any, info: any) => {
          return instance[query.methodName](args, context, info);
        };
      }

      // Mutation resolvers
      for (const [, mutation] of meta.mutations) {
        resolversObj.Mutation[mutation.name] = (_: any, args: any, context: any, info: any) => {
          return instance[mutation.methodName](args, context, info);
        };
      }

      // Subscription resolvers
      for (const [, subscription] of meta.subscriptions) {
        resolversObj.Subscription[subscription.name] = {
          subscribe: (_: any, args: any, context: any, info: any) => {
            if (this.pubSub) {
              return this.pubSub.asyncIterator(subscription.topics);
            }
            throw new Error('PubSub not configured for subscriptions');
          },
          resolve: (payload: any) => payload,
        };

        if (subscription.filter && this.pubSub) {
          const originalSubscribe = resolversObj.Subscription[subscription.name].subscribe;
          resolversObj.Subscription[subscription.name].subscribe = async (
            _: any, args: any, context: any, info: any
          ) => {
            // Wrap with filter
            return originalSubscribe(_, args, context, info);
          };
        }
      }

      // Field resolvers (for the resolved type)
      if (meta.resolverOf) {
        const typeName = meta.resolverOf.name;
        if (!resolversObj[typeName]) {
          resolversObj[typeName] = {};
        }
        for (const [, field] of meta.fieldResolvers) {
          resolversObj[typeName][field.name] = (parent: any, args: any, context: any, info: any) => {
            return instance[field.methodName](parent, args, context, info);
          };
        }
      }
    }

    // Clean up empty objects
    if (Object.keys(resolversObj.Query).length === 0) delete resolversObj.Query;
    if (Object.keys(resolversObj.Mutation).length === 0) delete resolversObj.Mutation;
    if (Object.keys(resolversObj.Subscription).length === 0) delete resolversObj.Subscription;

    return resolversObj;
  }

  private typeToString(type: GraphQLType, nullable: boolean): string {
    let typeStr: string;

    if (typeof type === 'string') {
      typeStr = type;
    } else if (typeof type === 'function') {
      typeStr = type.name;
    } else if ('list' in type) {
      typeStr = `[${this.typeToString(type.list, false)}]`;
    } else if ('nullable' in type) {
      return this.typeToString(type.nullable, true);
    } else {
      typeStr = 'String';
    }

    return nullable ? typeStr : `${typeStr}!`;
  }

  private buildArgsString(args: Map<string, ArgMetadata>): string {
    if (args.size === 0) return '';
    
    const argStrings: string[] = [];
    for (const [, arg] of args) {
      const typeStr = this.typeToString(arg.type, arg.nullable);
      argStrings.push(`${arg.name}: ${typeStr}`);
    }
    
    return `(${argStrings.join(', ')})`;
  }
}

// ============================================
// PubSub Engine
// ============================================

export interface PubSubEngine {
  publish(topic: string, payload: any): Promise<void>;
  subscribe(topic: string, onMessage: (payload: any) => void): Promise<number>;
  unsubscribe(subId: number): void;
  asyncIterator<T>(topics: string | string[]): AsyncIterator<T>;
}

export class InMemoryPubSub implements PubSubEngine {
  private subscriptions: Map<number, { topic: string; callback: (payload: any) => void }> = new Map();
  private subIdCounter = 0;

  async publish(topic: string, payload: any): Promise<void> {
    for (const [, sub] of this.subscriptions) {
      if (sub.topic === topic) {
        sub.callback(payload);
      }
    }
  }

  async subscribe(topic: string, onMessage: (payload: any) => void): Promise<number> {
    const id = ++this.subIdCounter;
    this.subscriptions.set(id, { topic, callback: onMessage });
    return id;
  }

  unsubscribe(subId: number): void {
    this.subscriptions.delete(subId);
  }

  asyncIterator<T>(topics: string | string[]): AsyncIterator<T> {
    const topicArray = Array.isArray(topics) ? topics : [topics];
    const pullQueue: ((value: IteratorResult<T>) => void)[] = [];
    const pushQueue: T[] = [];
    let listening = true;
    const subIds: number[] = [];

    const pushValue = (payload: T) => {
      if (pullQueue.length > 0) {
        pullQueue.shift()!({ value: payload, done: false });
      } else {
        pushQueue.push(payload);
      }
    };

    // Subscribe to all topics
    for (const topic of topicArray) {
      this.subscribe(topic, pushValue).then(id => subIds.push(id));
    }

    return {
      next: () => {
        return new Promise<IteratorResult<T>>((resolve) => {
          if (!listening) {
            resolve({ value: undefined as any, done: true });
            return;
          }
          if (pushQueue.length > 0) {
            resolve({ value: pushQueue.shift()!, done: false });
          } else {
            pullQueue.push(resolve);
          }
        });
      },
      return: () => {
        listening = false;
        for (const id of subIds) {
          this.unsubscribe(id);
        }
        return Promise.resolve({ value: undefined as any, done: true });
      },
      throw: (error: any) => {
        listening = false;
        for (const id of subIds) {
          this.unsubscribe(id);
        }
        return Promise.reject(error);
      },
    };
  }
}

// ============================================
// Factory Functions
// ============================================

export function createCodeFirstSchema(): CodeFirstSchemaBuilder {
  return new CodeFirstSchemaBuilder();
}

export function createPubSub(): InMemoryPubSub {
  return new InMemoryPubSub();
}

/**
 * Get all registered type metadata
 */
export function getTypeMetadata(target: Function): TypeMetadata | undefined {
  return typeMetadataStore.get(target);
}

/**
 * Get all registered resolver metadata
 */
export function getResolverMetadata(target: Function): ResolverMetadata | undefined {
  return resolverMetadataStore.get(target);
}

export default CodeFirstSchemaBuilder;
