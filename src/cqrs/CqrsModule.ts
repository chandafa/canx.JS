/**
 * CanxJS CQRS Module
 * Command Query Responsibility Segregation implementation
 */

// ============================================
// Types & Interfaces
// ============================================

export interface ICommand<TResult = void> {
  readonly type: string;
}

export interface IQuery<TResult = unknown> {
  readonly type: string;
}

export interface IEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly aggregateId?: string;
  readonly version?: number;
}

export interface ICommandHandler<TCommand extends ICommand<TResult>, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}

export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult = unknown> {
  execute(query: TQuery): Promise<TResult>;
}

export interface IEventHandler<TEvent extends IEvent> {
  handle(event: TEvent): Promise<void>;
}

export interface ISaga {
  handle(event: IEvent): AsyncGenerator<ICommand | IEvent, void, unknown>;
}

// Handler metadata types
type CommandHandlerMap = Map<string, ICommandHandler<any, any>>;
type QueryHandlerMap = Map<string, IQueryHandler<any, any>>;
type EventHandlerMap = Map<string, Set<IEventHandler<any>>>;

// ============================================
// Command Bus
// ============================================

export class CommandBus {
  private handlers: CommandHandlerMap = new Map();
  private middleware: CommandMiddleware[] = [];

  /**
   * Register a command handler
   */
  register<TCommand extends ICommand<TResult>, TResult>(
    commandType: string,
    handler: ICommandHandler<TCommand, TResult>
  ): this {
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for command: ${commandType}`);
    }
    this.handlers.set(commandType, handler);
    return this;
  }

  /**
   * Unregister a command handler
   */
  unregister(commandType: string): this {
    this.handlers.delete(commandType);
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: CommandMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Execute a command
   */
  async execute<TResult>(command: ICommand<TResult>): Promise<TResult> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler found for command: ${command.type}`);
    }

    // Build middleware chain
    let index = 0;
    const next = async (): Promise<TResult> => {
      if (index < this.middleware.length) {
        const mw = this.middleware[index++];
        return mw(command, next);
      }
      return handler.execute(command);
    };

    return next();
  }

  /**
   * Check if handler exists
   */
  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }
}

export type CommandMiddleware = <T>(
  command: ICommand<T>,
  next: () => Promise<T>
) => Promise<T>;

// ============================================
// Query Bus
// ============================================

export class QueryBus {
  private handlers: QueryHandlerMap = new Map();
  private middleware: QueryMiddleware[] = [];
  private cache: Map<string, { result: unknown; expiry: number }> = new Map();

  /**
   * Register a query handler
   */
  register<TQuery extends IQuery<TResult>, TResult>(
    queryType: string,
    handler: IQueryHandler<TQuery, TResult>
  ): this {
    if (this.handlers.has(queryType)) {
      throw new Error(`Handler already registered for query: ${queryType}`);
    }
    this.handlers.set(queryType, handler);
    return this;
  }

  /**
   * Unregister a query handler
   */
  unregister(queryType: string): this {
    this.handlers.delete(queryType);
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: QueryMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Execute a query
   */
  async execute<TResult>(query: IQuery<TResult>): Promise<TResult> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler found for query: ${query.type}`);
    }

    // Check cache
    const cacheKey = this.getCacheKey(query);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.result as TResult;
    }

    // Build middleware chain
    let index = 0;
    const next = async (): Promise<TResult> => {
      if (index < this.middleware.length) {
        const mw = this.middleware[index++];
        return mw(query, next);
      }
      return handler.execute(query);
    };

    const result = await next();
    return result;
  }

  /**
   * Execute with caching
   */
  async executeWithCache<TResult>(
    query: IQuery<TResult>,
    ttlMs: number = 60000
  ): Promise<TResult> {
    const result = await this.execute(query);
    const cacheKey = this.getCacheKey(query);
    this.cache.set(cacheKey, {
      result,
      expiry: Date.now() + ttlMs,
    });
    return result;
  }

  /**
   * Clear cache
   */
  clearCache(queryType?: string): void {
    if (queryType) {
      for (const [key] of this.cache) {
        if (key.startsWith(`${queryType}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if handler exists
   */
  hasHandler(queryType: string): boolean {
    return this.handlers.has(queryType);
  }

  private getCacheKey(query: IQuery): string {
    return `${query.type}:${JSON.stringify(query)}`;
  }
}

export type QueryMiddleware = <T>(
  query: IQuery<T>,
  next: () => Promise<T>
) => Promise<T>;

// ============================================
// Event Bus
// ============================================

export class EventBus {
  private handlers: EventHandlerMap = new Map();
  private sagas: ISaga[] = [];
  private commandBus?: CommandBus;
  private history: IEvent[] = [];
  private maxHistorySize: number = 1000;

  constructor(options?: { commandBus?: CommandBus; maxHistorySize?: number }) {
    this.commandBus = options?.commandBus;
    this.maxHistorySize = options?.maxHistorySize ?? 1000;
  }

  /**
   * Subscribe to an event
   */
  subscribe<TEvent extends IEvent>(
    eventType: string,
    handler: IEventHandler<TEvent>
  ): this {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return this;
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe<TEvent extends IEvent>(
    eventType: string,
    handler: IEventHandler<TEvent>
  ): this {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
    return this;
  }

  /**
   * Register a saga
   */
  registerSaga(saga: ISaga): this {
    this.sagas.push(saga);
    return this;
  }

  /**
   * Publish an event
   */
  async publish(event: IEvent): Promise<void> {
    // Add to history
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Notify handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      const promises = Array.from(handlers).map(handler =>
        handler.handle(event).catch(err => {
          console.error(`Error in event handler for ${event.type}:`, err);
        })
      );
      await Promise.all(promises);
    }

    // Process sagas
    for (const saga of this.sagas) {
      try {
        const generator = saga.handle(event);
        for await (const result of generator) {
          if ('type' in result) {
            if (this.isCommand(result)) {
              if (this.commandBus) {
                await this.commandBus.execute(result);
              }
            } else {
              await this.publish(result as IEvent);
            }
          }
        }
      } catch (err) {
        console.error('Error in saga:', err);
      }
    }
  }

  /**
   * Publish multiple events
   */
  async publishAll(events: IEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Get event history
   */
  getHistory(filter?: { eventType?: string; aggregateId?: string }): IEvent[] {
    let filtered = [...this.history];
    if (filter?.eventType) {
      filtered = filtered.filter(e => e.type === filter.eventType);
    }
    if (filter?.aggregateId) {
      filtered = filtered.filter(e => e.aggregateId === filter.aggregateId);
    }
    return filtered;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  private isCommand(obj: unknown): obj is ICommand {
    return typeof obj === 'object' && obj !== null && 'type' in obj;
  }
}

// ============================================
// CQRS Module Container
// ============================================

export class CqrsModule {
  public readonly commandBus: CommandBus;
  public readonly queryBus: QueryBus;
  public readonly eventBus: EventBus;

  constructor(options?: { maxHistorySize?: number }) {
    this.commandBus = new CommandBus();
    this.queryBus = new QueryBus();
    this.eventBus = new EventBus({
      commandBus: this.commandBus,
      maxHistorySize: options?.maxHistorySize,
    });
  }

  /**
   * Register command handler
   */
  registerCommandHandler<TCommand extends ICommand<TResult>, TResult>(
    commandType: string,
    handler: ICommandHandler<TCommand, TResult>
  ): this {
    this.commandBus.register(commandType, handler);
    return this;
  }

  /**
   * Register query handler
   */
  registerQueryHandler<TQuery extends IQuery<TResult>, TResult>(
    queryType: string,
    handler: IQueryHandler<TQuery, TResult>
  ): this {
    this.queryBus.register(queryType, handler);
    return this;
  }

  /**
   * Register event handler
   */
  registerEventHandler<TEvent extends IEvent>(
    eventType: string,
    handler: IEventHandler<TEvent>
  ): this {
    this.eventBus.subscribe(eventType, handler);
    return this;
  }

  /**
   * Register saga
   */
  registerSaga(saga: ISaga): this {
    this.eventBus.registerSaga(saga);
    return this;
  }
}

// ============================================
// Decorators
// ============================================

const commandHandlerMetadata = new Map<Function, string>();
const queryHandlerMetadata = new Map<Function, string>();
const eventHandlerMetadata = new Map<Function, string>();

/**
 * Mark a class as a command handler
 */
export function CommandHandler(commandType: string): ClassDecorator {
  return (target: Function) => {
    commandHandlerMetadata.set(target, commandType);
  };
}

/**
 * Mark a class as a query handler
 */
export function QueryHandler(queryType: string): ClassDecorator {
  return (target: Function) => {
    queryHandlerMetadata.set(target, queryType);
  };
}

/**
 * Mark a class as an event handler
 */
export function EventHandler(eventType: string): ClassDecorator {
  return (target: Function) => {
    eventHandlerMetadata.set(target, eventType);
  };
}

/**
 * Get command handler metadata
 */
export function getCommandHandlerMetadata(target: Function): string | undefined {
  return commandHandlerMetadata.get(target);
}

/**
 * Get query handler metadata
 */
export function getQueryHandlerMetadata(target: Function): string | undefined {
  return queryHandlerMetadata.get(target);
}

/**
 * Get event handler metadata
 */
export function getEventHandlerMetadata(target: Function): string | undefined {
  return eventHandlerMetadata.get(target);
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new CQRS module
 */
export function createCqrsModule(options?: { maxHistorySize?: number }): CqrsModule {
  return new CqrsModule(options);
}

/**
 * Create a standalone command bus
 */
export function createCommandBus(): CommandBus {
  return new CommandBus();
}

/**
 * Create a standalone query bus
 */
export function createQueryBus(): QueryBus {
  return new QueryBus();
}

/**
 * Create a standalone event bus
 */
export function createEventBus(options?: {
  commandBus?: CommandBus;
  maxHistorySize?: number;
}): EventBus {
  return new EventBus(options);
}

// ============================================
// Exports
// ============================================

export default CqrsModule;
