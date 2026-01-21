/**
 * CanxJS CQRS & Event Sourcing Module
 * Export all CQRS and Event Sourcing components
 */

// CQRS Module
export {
  // Classes
  CommandBus,
  QueryBus,
  EventBus,
  CqrsModule,
  
  // Decorators
  CommandHandler,
  QueryHandler,
  EventHandler,
  getCommandHandlerMetadata,
  getQueryHandlerMetadata,
  getEventHandlerMetadata,
  
  // Factory Functions
  createCqrsModule,
  createCommandBus,
  createQueryBus,
  createEventBus,
} from './CqrsModule';

export type {
  // Interfaces
  ICommand,
  IQuery,
  IEvent,
  ICommandHandler,
  IQueryHandler,
  IEventHandler,
  ISaga,
  CommandMiddleware,
  QueryMiddleware,
} from './CqrsModule';

// Event Sourcing
export {
  // Classes
  AggregateRoot,
  InMemoryEventStore,
  EventSourcingRepository,
  ProjectionManager,
  
  // Errors
  ConcurrencyError,
  AggregateNotFoundError,
  
  // Factory Functions
  createEventStore,
  createRepository,
  createProjectionManager,
} from './EventSourcing';

export type {
  // Interfaces
  DomainEvent,
  EventMetadata,
  Snapshot,
  EventStoreOptions,
  StoredEvent,
  Projection,
} from './EventSourcing';
