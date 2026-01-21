/**
 * CanxJS Event Sourcing Module
 * Event Sourcing implementation with AggregateRoot and EventStore
 */

import type { IEvent } from './CqrsModule';

// ============================================
// Types & Interfaces
// ============================================

export interface DomainEvent extends IEvent {
  aggregateId: string;
  version: number;
  payload: unknown;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface Snapshot<TState> {
  aggregateId: string;
  version: number;
  state: TState;
  timestamp: number;
}

export interface EventStoreOptions {
  snapshotThreshold?: number;
  maxEventsPerAggregate?: number;
}

export interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  type: string;
  version: number;
  payload: unknown;
  metadata: EventMetadata;
  timestamp: number;
}

// ============================================
// Aggregate Root
// ============================================

export abstract class AggregateRoot<TState = unknown> {
  private _id: string;
  private _version: number = 0;
  private _uncommittedEvents: DomainEvent[] = [];
  protected state: TState;

  constructor(id: string, initialState: TState) {
    this._id = id;
    this.state = initialState;
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get uncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * Apply an event to the aggregate (mutates state)
   */
  protected abstract apply(event: DomainEvent): void;

  /**
   * Raise a new domain event
   */
  protected raise(eventType: string, payload: unknown, metadata?: Partial<EventMetadata>): void {
    const event: DomainEvent = {
      type: eventType,
      aggregateId: this._id,
      version: this._version + 1,
      payload,
      timestamp: Date.now(),
      metadata: {
        timestamp: Date.now(),
        ...metadata,
      },
    };

    this._uncommittedEvents.push(event);
    this._version++;
    this.apply(event);
  }

  /**
   * Load aggregate from event history
   */
  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.apply(event);
      this._version = event.version;
    }
    this._uncommittedEvents = [];
  }

  /**
   * Load from snapshot and events
   */
  loadFromSnapshot(snapshot: Snapshot<TState>, events: DomainEvent[] = []): void {
    this.state = snapshot.state;
    this._version = snapshot.version;
    
    // Apply events after snapshot
    for (const event of events) {
      if (event.version > snapshot.version) {
        this.apply(event);
        this._version = event.version;
      }
    }
    this._uncommittedEvents = [];
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): Snapshot<TState> {
    return {
      aggregateId: this._id,
      version: this._version,
      state: this.state,
      timestamp: Date.now(),
    };
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Get current state (readonly)
   */
  getState(): Readonly<TState> {
    return this.state;
  }
}

// ============================================
// Event Store (In-Memory Implementation)
// ============================================

export class InMemoryEventStore {
  private events: Map<string, StoredEvent[]> = new Map();
  private snapshots: Map<string, Snapshot<unknown>> = new Map();
  private allEvents: StoredEvent[] = [];
  private options: Required<EventStoreOptions>;

  constructor(options: EventStoreOptions = {}) {
    this.options = {
      snapshotThreshold: options.snapshotThreshold ?? 100,
      maxEventsPerAggregate: options.maxEventsPerAggregate ?? 10000,
    };
  }

  /**
   * Append events to the store
   */
  async appendEvents(
    aggregateId: string,
    aggregateType: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    const existingEvents = this.events.get(aggregateId) || [];
    
    // Optimistic concurrency check
    if (expectedVersion !== undefined) {
      const currentVersion = existingEvents.length > 0 
        ? existingEvents[existingEvents.length - 1].version 
        : 0;
      
      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Concurrency conflict: expected version ${expectedVersion}, but found ${currentVersion}`
        );
      }
    }

    const storedEvents: StoredEvent[] = events.map((event, index) => ({
      id: `${aggregateId}-${event.version}`,
      aggregateId,
      aggregateType,
      type: event.type,
      version: event.version,
      payload: event.payload,
      metadata: event.metadata || { timestamp: event.timestamp },
      timestamp: event.timestamp,
    }));

    // Append to aggregate events
    const updatedEvents = [...existingEvents, ...storedEvents];
    
    // Check max events limit
    if (updatedEvents.length > this.options.maxEventsPerAggregate) {
      throw new Error(`Maximum events per aggregate exceeded: ${this.options.maxEventsPerAggregate}`);
    }
    
    this.events.set(aggregateId, updatedEvents);

    // Append to global event stream
    this.allEvents.push(...storedEvents);
  }

  /**
   * Get events for an aggregate
   */
  async getEvents(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<StoredEvent[]> {
    const events = this.events.get(aggregateId) || [];
    
    return events.filter(e => {
      if (fromVersion !== undefined && e.version < fromVersion) return false;
      if (toVersion !== undefined && e.version > toVersion) return false;
      return true;
    });
  }

  /**
   * Get events since a specific version for an aggregate
   */
  async getEventsSinceVersion(
    aggregateId: string,
    version: number
  ): Promise<StoredEvent[]> {
    return this.getEvents(aggregateId, version + 1);
  }

  /**
   * Get all events (for projections)
   */
  async getAllEvents(
    fromPosition?: number,
    limit?: number
  ): Promise<StoredEvent[]> {
    let events = this.allEvents;
    
    if (fromPosition !== undefined) {
      events = events.slice(fromPosition);
    }
    
    if (limit !== undefined) {
      events = events.slice(0, limit);
    }
    
    return events;
  }

  /**
   * Get events by type
   */
  async getEventsByType(eventType: string): Promise<StoredEvent[]> {
    return this.allEvents.filter(e => e.type === eventType);
  }

  /**
   * Save snapshot
   */
  async saveSnapshot<TState>(snapshot: Snapshot<TState>): Promise<void> {
    this.snapshots.set(snapshot.aggregateId, snapshot);
  }

  /**
   * Get snapshot
   */
  async getSnapshot<TState>(aggregateId: string): Promise<Snapshot<TState> | null> {
    return (this.snapshots.get(aggregateId) as Snapshot<TState>) || null;
  }

  /**
   * Check if snapshot is needed
   */
  shouldSnapshot(aggregateId: string, currentVersion: number): boolean {
    const snapshot = this.snapshots.get(aggregateId);
    const lastSnapshotVersion = snapshot?.version || 0;
    return (currentVersion - lastSnapshotVersion) >= this.options.snapshotThreshold;
  }

  /**
   * Get current stream position
   */
  async getStreamPosition(): Promise<number> {
    return this.allEvents.length;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.events.clear();
    this.snapshots.clear();
    this.allEvents = [];
  }
}

// ============================================
// Repository
// ============================================

export class EventSourcingRepository<
  TAggregate extends AggregateRoot<TState>,
  TState = unknown
> {
  private eventStore: InMemoryEventStore;
  private aggregateFactory: (id: string) => TAggregate;
  private aggregateType: string;

  constructor(
    eventStore: InMemoryEventStore,
    aggregateType: string,
    aggregateFactory: (id: string) => TAggregate
  ) {
    this.eventStore = eventStore;
    this.aggregateType = aggregateType;
    this.aggregateFactory = aggregateFactory;
  }

  /**
   * Load aggregate by ID
   */
  async load(aggregateId: string): Promise<TAggregate | null> {
    // Try to load from snapshot first
    const snapshot = await this.eventStore.getSnapshot<TState>(aggregateId);
    
    // Get events (from snapshot version or all)
    const fromVersion = snapshot ? snapshot.version + 1 : undefined;
    const storedEvents = await this.eventStore.getEvents(aggregateId, fromVersion);
    
    if (!snapshot && storedEvents.length === 0) {
      return null;
    }

    const aggregate = this.aggregateFactory(aggregateId);
    
    // Convert stored events to domain events
    const events: DomainEvent[] = storedEvents.map(e => ({
      type: e.type,
      aggregateId: e.aggregateId,
      version: e.version,
      payload: e.payload,
      timestamp: e.timestamp,
      metadata: e.metadata,
    }));

    if (snapshot) {
      aggregate.loadFromSnapshot(snapshot, events);
    } else {
      aggregate.loadFromHistory(events);
    }

    return aggregate;
  }

  /**
   * Save aggregate
   */
  async save(aggregate: TAggregate, expectedVersion?: number): Promise<void> {
    const uncommittedEvents = aggregate.uncommittedEvents;
    
    if (uncommittedEvents.length === 0) {
      return;
    }

    await this.eventStore.appendEvents(
      aggregate.id,
      this.aggregateType,
      uncommittedEvents,
      expectedVersion
    );

    // Check if snapshot is needed
    if (this.eventStore.shouldSnapshot(aggregate.id, aggregate.version)) {
      const snapshot = aggregate.createSnapshot();
      await this.eventStore.saveSnapshot(snapshot);
    }

    aggregate.markEventsAsCommitted();
  }

  /**
   * Check if aggregate exists
   */
  async exists(aggregateId: string): Promise<boolean> {
    const events = await this.eventStore.getEvents(aggregateId);
    return events.length > 0;
  }
}

// ============================================
// Projections
// ============================================

export interface Projection<TState> {
  name: string;
  initialState: TState;
  handlers: Map<string, (state: TState, event: StoredEvent) => TState>;
  currentState: TState;
  lastPosition: number;
}

export class ProjectionManager {
  private eventStore: InMemoryEventStore;
  private projections: Map<string, Projection<any>> = new Map();

  constructor(eventStore: InMemoryEventStore) {
    this.eventStore = eventStore;
  }

  /**
   * Register a projection
   */
  register<TState>(
    name: string,
    initialState: TState,
    handlers: Record<string, (state: TState, event: StoredEvent) => TState>
  ): this {
    this.projections.set(name, {
      name,
      initialState,
      handlers: new Map(Object.entries(handlers)),
      currentState: structuredClone(initialState),
      lastPosition: 0,
    });
    return this;
  }

  /**
   * Update all projections
   */
  async updateAll(): Promise<void> {
    for (const projection of this.projections.values()) {
      await this.update(projection.name);
    }
  }

  /**
   * Update a specific projection
   */
  async update(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionName}`);
    }

    const events = await this.eventStore.getAllEvents(projection.lastPosition);
    
    for (const event of events) {
      const handler = projection.handlers.get(event.type);
      if (handler) {
        projection.currentState = handler(projection.currentState, event);
      }
      projection.lastPosition++;
    }
  }

  /**
   * Get projection state
   */
  getState<TState>(projectionName: string): TState | null {
    const projection = this.projections.get(projectionName);
    return projection?.currentState ?? null;
  }

  /**
   * Reset projection
   */
  reset(projectionName: string): void {
    const projection = this.projections.get(projectionName);
    if (projection) {
      projection.currentState = structuredClone(projection.initialState);
      projection.lastPosition = 0;
    }
  }

  /**
   * Reset all projections
   */
  resetAll(): void {
    for (const name of this.projections.keys()) {
      this.reset(name);
    }
  }
}

// ============================================
// Errors
// ============================================

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class AggregateNotFoundError extends Error {
  constructor(aggregateId: string, aggregateType: string) {
    super(`Aggregate not found: ${aggregateType} with id ${aggregateId}`);
    this.name = 'AggregateNotFoundError';
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create an in-memory event store
 */
export function createEventStore(options?: EventStoreOptions): InMemoryEventStore {
  return new InMemoryEventStore(options);
}

/**
 * Create a repository for an aggregate
 */
export function createRepository<
  TAggregate extends AggregateRoot<TState>,
  TState = unknown
>(
  eventStore: InMemoryEventStore,
  aggregateType: string,
  factory: (id: string) => TAggregate
): EventSourcingRepository<TAggregate, TState> {
  return new EventSourcingRepository(eventStore, aggregateType, factory);
}

/**
 * Create a projection manager
 */
export function createProjectionManager(
  eventStore: InMemoryEventStore
): ProjectionManager {
  return new ProjectionManager(eventStore);
}

// ============================================
// Exports
// ============================================

export default {
  AggregateRoot,
  InMemoryEventStore,
  EventSourcingRepository,
  ProjectionManager,
  ConcurrencyError,
  AggregateNotFoundError,
};
