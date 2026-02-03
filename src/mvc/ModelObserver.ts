/**
 * CanxJS Model Observers
 * 
 * Laravel-style model lifecycle event hooks using decorators.
 * Allows you to automatically trigger actions when models are created, updated, deleted, etc.
 */

import { events } from '../events/EventEmitter';

// ============================================
// Types
// ============================================

export type ModelLifecycleEvent = 
  | 'creating'
  | 'created'
  | 'updating'
  | 'updated'
  | 'saving'
  | 'saved'
  | 'deleting'
  | 'deleted'
  | 'restoring'
  | 'restored'
  | 'retrieved'
  | 'replicating';

export interface ModelEventData<T = any> {
  model: T;
  modelName: string;
  changes?: Partial<T>;
  original?: Partial<T>;
}

export type ModelEventHandler<T = any> = (data: ModelEventData<T>) => void | Promise<void>;

// ============================================
// Observer Registry
// ============================================

const observerRegistry = new Map<string, Map<ModelLifecycleEvent, ModelEventHandler[]>>();

/**
 * Register an observer for a model event
 */
export function registerModelObserver<T>(
  modelName: string,
  event: ModelLifecycleEvent,
  handler: ModelEventHandler<T>
): void {
  if (!observerRegistry.has(modelName)) {
    observerRegistry.set(modelName, new Map());
  }
  
  const modelObservers = observerRegistry.get(modelName)!;
  if (!modelObservers.has(event)) {
    modelObservers.set(event, []);
  }
  
  modelObservers.get(event)!.push(handler as ModelEventHandler);
}

/**
 * Dispatch a model event
 */
export async function dispatchModelEvent<T>(
  modelName: string,
  event: ModelLifecycleEvent,
  model: T,
  options: { changes?: Partial<T>; original?: Partial<T> } = {}
): Promise<boolean> {
  const modelObservers = observerRegistry.get(modelName);
  
  // Also emit global event for cross-cutting concerns
  events.emit(`model:${event}`, { model, modelName, ...options });
  events.emit(`model:${modelName}:${event}`, { model, modelName, ...options });
  
  if (!modelObservers || !modelObservers.has(event)) {
    return true;
  }
  
  const handlers = modelObservers.get(event)!;
  const eventData: ModelEventData<T> = {
    model,
    modelName,
    changes: options.changes,
    original: options.original,
  };
  
  for (const handler of handlers) {
    try {
      const result = await handler(eventData);
      // If handler explicitly returns false, stop event propagation
      if (result !== undefined && result === false) {
        return false;
      }
    } catch (error) {
      console.error(`Observer error for ${modelName}:${event}:`, error);
      // Re-throw to allow handling upstream
      throw error;
    }
  }
  
  return true;
}

// ============================================
// Class Decorator - @Observer
// ============================================

/**
 * Observer class decorator - registers a class as an observer for a model
 * 
 * @example
 * @Observer(User)
 * class UserObserver {
 *   @OnCreated()
 *   async afterCreate(data: ModelEventData<User>) {
 *     await sendWelcomeEmail(data.model.email);
 *   }
 * }
 */
export function Observer(modelClass: { name: string } | string): ClassDecorator {
  return (target: Function) => {
    const modelName = typeof modelClass === 'string' ? modelClass : modelClass.name;
    
    // Store model name on the observer class for later registration
    Reflect.defineMetadata('observer:model', modelName, target);
    
    // Auto-register decorated methods
    const instance = new (target as any)();
    const methodMeta = Reflect.getMetadata('observer:methods', target.prototype) as Map<string, ModelLifecycleEvent> | undefined;
    
    if (methodMeta) {
      for (const [methodName, event] of methodMeta) {
        const handler = instance[methodName].bind(instance);
        registerModelObserver(modelName, event, handler);
      }
    }
  };
}

// ============================================
// Method Decorators - Lifecycle Events
// ============================================

function createEventDecorator(event: ModelLifecycleEvent): () => MethodDecorator {
  return () => {
    return (target: Object, propertyKey: string | symbol) => {
      let methodMeta = Reflect.getMetadata('observer:methods', target) as Map<string, ModelLifecycleEvent> | undefined;
      
      if (!methodMeta) {
        methodMeta = new Map();
        Reflect.defineMetadata('observer:methods', methodMeta, target);
      }
      
      methodMeta.set(String(propertyKey), event);
    };
  };
}

/**
 * @OnCreating - Called before a model is created
 * Return false to cancel the creation
 */
export const OnCreating = createEventDecorator('creating');

/**
 * @OnCreated - Called after a model is created
 */
export const OnCreated = createEventDecorator('created');

/**
 * @OnUpdating - Called before a model is updated
 * Return false to cancel the update
 */
export const OnUpdating = createEventDecorator('updating');

/**
 * @OnUpdated - Called after a model is updated
 */
export const OnUpdated = createEventDecorator('updated');

/**
 * @OnSaving - Called before a model is created or updated
 * Return false to cancel the save
 */
export const OnSaving = createEventDecorator('saving');

/**
 * @OnSaved - Called after a model is created or updated
 */
export const OnSaved = createEventDecorator('saved');

/**
 * @OnDeleting - Called before a model is deleted
 * Return false to cancel the delete
 */
export const OnDeleting = createEventDecorator('deleting');

/**
 * @OnDeleted - Called after a model is deleted
 */
export const OnDeleted = createEventDecorator('deleted');

/**
 * @OnRestoring - Called before a soft-deleted model is restored
 */
export const OnRestoring = createEventDecorator('restoring');

/**
 * @OnRestored - Called after a soft-deleted model is restored
 */
export const OnRestored = createEventDecorator('restored');

/**
 * @OnRetrieved - Called after a model is retrieved from the database
 */
export const OnRetrieved = createEventDecorator('retrieved');

/**
 * @OnReplicating - Called when a model is being replicated
 */
export const OnReplicating = createEventDecorator('replicating');

// ============================================
// Functional API - register observers without decorators
// ============================================

export interface ObserverDefinition<T = any> {
  creating?: ModelEventHandler<T>;
  created?: ModelEventHandler<T>;
  updating?: ModelEventHandler<T>;
  updated?: ModelEventHandler<T>;
  saving?: ModelEventHandler<T>;
  saved?: ModelEventHandler<T>;
  deleting?: ModelEventHandler<T>;
  deleted?: ModelEventHandler<T>;
  restoring?: ModelEventHandler<T>;
  restored?: ModelEventHandler<T>;
  retrieved?: ModelEventHandler<T>;
  replicating?: ModelEventHandler<T>;
}

/**
 * Define an observer for a model using a functional approach
 * 
 * @example
 * defineObserver('User', {
 *   async created({ model }) {
 *     await sendWelcomeEmail(model.email);
 *   },
 *   async updated({ model, changes }) {
 *     if (changes.email) {
 *       await sendEmailChangeNotification(model);
 *     }
 *   },
 * });
 */
export function defineObserver<T = any>(
  modelName: string,
  definition: ObserverDefinition<T>
): void {
  const events: ModelLifecycleEvent[] = [
    'creating', 'created',
    'updating', 'updated',
    'saving', 'saved',
    'deleting', 'deleted',
    'restoring', 'restored',
    'retrieved', 'replicating',
  ];
  
  for (const event of events) {
    const handler = definition[event];
    if (handler) {
      registerModelObserver(modelName, event, handler);
    }
  }
}

// ============================================
// Model Mixin - Add observer support to Model class
// ============================================

/**
 * Mixin to add observer support to any model class.
 * Use this with your Model base class.
 */
export function withObservers<T extends new (...args: any[]) => any>(Base: T) {
  return class extends Base {
    static observers: ObserverDefinition[] = [];
    
    /**
     * Register an observer for this model
     */
    static observe(definition: ObserverDefinition): void {
      defineObserver(this.name, definition);
    }
    
    /**
     * Fire a model event
     */
    async fireModelEvent(
      event: ModelLifecycleEvent,
      options: { changes?: any; original?: any } = {}
    ): Promise<boolean> {
      return dispatchModelEvent(
        this.constructor.name,
        event,
        this,
        options
      );
    }
  };
}

// ============================================
// Helpers
// ============================================

/**
 * List all registered observers
 */
export function getRegisteredObservers(): Map<string, Map<ModelLifecycleEvent, number>> {
  const result = new Map<string, Map<ModelLifecycleEvent, number>>();
  
  for (const [modelName, eventMap] of observerRegistry) {
    const counts = new Map<ModelLifecycleEvent, number>();
    for (const [event, handlers] of eventMap) {
      counts.set(event, handlers.length);
    }
    result.set(modelName, counts);
  }
  
  return result;
}

/**
 * Clear all observers for a model (useful for testing)
 */
export function clearObservers(modelName?: string): void {
  if (modelName) {
    observerRegistry.delete(modelName);
  } else {
    observerRegistry.clear();
  }
}
