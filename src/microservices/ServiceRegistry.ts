/**
 * CanxJS Service Registry - Service discovery for microservices
 * @description Enables service registration, discovery, and health monitoring
 */

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  metadata?: Record<string, unknown>;
  health?: 'healthy' | 'unhealthy' | 'unknown';
  lastHeartbeat?: Date;
  registeredAt: Date;
}

export interface ServiceRegistryConfig {
  /** TTL for service registration in seconds */
  ttl?: number;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
  /** Health check interval in ms */
  healthCheckInterval?: number;
  /** Load balancing strategy */
  loadBalancer?: 'round-robin' | 'random' | 'least-connections';
}

export interface ServiceRegistryDriver {
  register(service: ServiceInstance): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  heartbeat(serviceId: string): Promise<void>;
  getServices(name: string): Promise<ServiceInstance[]>;
  getAllServices(): Promise<Map<string, ServiceInstance[]>>;
  watch(name: string, callback: (services: ServiceInstance[]) => void): () => void;
  close(): Promise<void>;
}

/**
 * In-memory Service Registry Driver
 */
export class MemoryServiceRegistryDriver implements ServiceRegistryDriver {
  private services = new Map<string, Map<string, ServiceInstance>>();
  private watchers = new Map<string, Set<(services: ServiceInstance[]) => void>>();
  private cleanupInterval: Timer | null = null;

  constructor(private ttl: number = 30) {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [name, instances] of this.services) {
        for (const [id, instance] of instances) {
          if (instance.lastHeartbeat) {
            const elapsed = now - instance.lastHeartbeat.getTime();
            if (elapsed > this.ttl * 1000) {
              instances.delete(id);
              this.notifyWatchers(name);
            }
          }
        }
      }
    }, 5000);
  }

  async register(service: ServiceInstance): Promise<void> {
    if (!this.services.has(service.name)) {
      this.services.set(service.name, new Map());
    }
    service.registeredAt = new Date();
    service.lastHeartbeat = new Date();
    this.services.get(service.name)!.set(service.id, service);
    this.notifyWatchers(service.name);
  }

  async deregister(serviceId: string): Promise<void> {
    for (const [name, instances] of this.services) {
      if (instances.has(serviceId)) {
        instances.delete(serviceId);
        this.notifyWatchers(name);
        break;
      }
    }
  }

  async heartbeat(serviceId: string): Promise<void> {
    for (const instances of this.services.values()) {
      const instance = instances.get(serviceId);
      if (instance) {
        instance.lastHeartbeat = new Date();
        instance.health = 'healthy';
        break;
      }
    }
  }

  async getServices(name: string): Promise<ServiceInstance[]> {
    const instances = this.services.get(name);
    if (!instances) return [];
    return Array.from(instances.values()).filter(s => s.health !== 'unhealthy');
  }

  async getAllServices(): Promise<Map<string, ServiceInstance[]>> {
    const result = new Map<string, ServiceInstance[]>();
    for (const [name, instances] of this.services) {
      result.set(name, Array.from(instances.values()));
    }
    return result;
  }

  watch(name: string, callback: (services: ServiceInstance[]) => void): () => void {
    if (!this.watchers.has(name)) {
      this.watchers.set(name, new Set());
    }
    this.watchers.get(name)!.add(callback);

    return () => {
      this.watchers.get(name)?.delete(callback);
    };
  }

  private notifyWatchers(name: string): void {
    const watchers = this.watchers.get(name);
    if (watchers) {
      const services = Array.from(this.services.get(name)?.values() ?? []);
      for (const watcher of watchers) {
        watcher(services);
      }
    }
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.services.clear();
    this.watchers.clear();
  }
}

/**
 * Redis Service Registry Driver
 */
export class RedisServiceRegistryDriver implements ServiceRegistryDriver {
  private redis: any;
  private prefix: string;
  private ttl: number;
  private subscriptions = new Map<string, any>();

  constructor(redisClient: any, prefix: string = 'services:', ttl: number = 30) {
    this.redis = redisClient;
    this.prefix = prefix;
    this.ttl = ttl;
  }

  private getKey(name: string): string {
    return `${this.prefix}${name}`;
  }

  async register(service: ServiceInstance): Promise<void> {
    service.registeredAt = new Date();
    service.lastHeartbeat = new Date();
    
    await this.redis.hset(
      this.getKey(service.name),
      service.id,
      JSON.stringify(service)
    );
    await this.redis.expire(this.getKey(service.name), this.ttl);
  }

  async deregister(serviceId: string): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    for (const key of keys) {
      await this.redis.hdel(key, serviceId);
    }
  }

  async heartbeat(serviceId: string): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    for (const key of keys) {
      const data = await this.redis.hget(key, serviceId);
      if (data) {
        const service = JSON.parse(data) as ServiceInstance;
        service.lastHeartbeat = new Date();
        service.health = 'healthy';
        await this.redis.hset(key, serviceId, JSON.stringify(service));
        await this.redis.expire(key, this.ttl);
        break;
      }
    }
  }

  async getServices(name: string): Promise<ServiceInstance[]> {
    const data = await this.redis.hgetall(this.getKey(name));
    if (!data) return [];

    return Object.values(data)
      .map((s) => JSON.parse(s as string) as ServiceInstance)
      .filter(s => s.health !== 'unhealthy');
  }

  async getAllServices(): Promise<Map<string, ServiceInstance[]>> {
    const result = new Map<string, ServiceInstance[]>();
    const keys = await this.redis.keys(`${this.prefix}*`);

    for (const key of keys) {
      const name = key.replace(this.prefix, '');
      const data = await this.redis.hgetall(key);
      if (data) {
        result.set(name, Object.values(data).map((s) => JSON.parse(s as string)));
      }
    }

    return result;
  }

  watch(name: string, callback: (services: ServiceInstance[]) => void): () => void {
    // Redis pub/sub for real-time updates
    const channel = `${this.prefix}watch:${name}`;
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe(channel, async () => {
      const services = await this.getServices(name);
      callback(services);
    });

    this.subscriptions.set(name, subscriber);

    return () => {
      subscriber.unsubscribe(channel);
      this.subscriptions.delete(name);
    };
  }

  async close(): Promise<void> {
    for (const subscriber of this.subscriptions.values()) {
      await subscriber.quit();
    }
    this.subscriptions.clear();
  }
}

/**
 * Load Balancer
 */
export class LoadBalancer {
  private roundRobinIndex = new Map<string, number>();

  constructor(private strategy: 'round-robin' | 'random' | 'least-connections' = 'round-robin') {}

  select(services: ServiceInstance[]): ServiceInstance | null {
    if (services.length === 0) return null;

    const healthyServices = services.filter(s => s.health !== 'unhealthy');
    if (healthyServices.length === 0) return null;

    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(healthyServices);
      case 'random':
        return this.random(healthyServices);
      case 'least-connections':
        return this.leastConnections(healthyServices);
      default:
        return healthyServices[0];
    }
  }

  private roundRobin(services: ServiceInstance[]): ServiceInstance {
    const key = services[0].name;
    let index = this.roundRobinIndex.get(key) ?? 0;
    const service = services[index % services.length];
    this.roundRobinIndex.set(key, index + 1);
    return service;
  }

  private random(services: ServiceInstance[]): ServiceInstance {
    return services[Math.floor(Math.random() * services.length)];
  }

  private leastConnections(services: ServiceInstance[]): ServiceInstance {
    // For now, just use round-robin as we don't track connections
    return this.roundRobin(services);
  }
}

/**
 * Service Registry
 */
export class ServiceRegistry {
  private config: Required<ServiceRegistryConfig>;
  private driver: ServiceRegistryDriver;
  private loadBalancer: LoadBalancer;
  private localService?: ServiceInstance;
  private heartbeatTimer?: Timer;

  constructor(driver: ServiceRegistryDriver, config: ServiceRegistryConfig = {}) {
    this.driver = driver;
    this.config = {
      ttl: config.ttl ?? 30,
      heartbeatInterval: config.heartbeatInterval ?? 10000,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
      loadBalancer: config.loadBalancer ?? 'round-robin',
    };
    this.loadBalancer = new LoadBalancer(this.config.loadBalancer);
  }

  /**
   * Register current service
   */
  async register(name: string, host: string, port: number, metadata?: Record<string, unknown>): Promise<string> {
    const serviceId = `${name}-${crypto.randomUUID().slice(0, 8)}`;
    
    this.localService = {
      id: serviceId,
      name,
      host,
      port,
      metadata,
      health: 'healthy',
      registeredAt: new Date(),
    };

    await this.driver.register(this.localService);
    this.startHeartbeat();

    console.log(`[ServiceRegistry] Registered: ${name} at ${host}:${port} (${serviceId})`);
    return serviceId;
  }

  /**
   * Deregister current service
   */
  async deregister(): Promise<void> {
    if (this.localService) {
      await this.driver.deregister(this.localService.id);
      this.stopHeartbeat();
      console.log(`[ServiceRegistry] Deregistered: ${this.localService.name}`);
      this.localService = undefined;
    }
  }

  /**
   * Discover a service
   */
  async discover(name: string): Promise<ServiceInstance | null> {
    const services = await this.driver.getServices(name);
    return this.loadBalancer.select(services);
  }

  /**
   * Get all instances of a service
   */
  async getInstances(name: string): Promise<ServiceInstance[]> {
    return this.driver.getServices(name);
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<Map<string, ServiceInstance[]>> {
    return this.driver.getAllServices();
  }

  /**
   * Watch for service changes
   */
  watch(name: string, callback: (services: ServiceInstance[]) => void): () => void {
    return this.driver.watch(name, callback);
  }

  /**
   * Get service URL
   */
  async getServiceUrl(name: string): Promise<string | null> {
    const instance = await this.discover(name);
    if (!instance) return null;
    return `http://${instance.host}:${instance.port}`;
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.localService) {
        await this.driver.heartbeat(this.localService.id);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Close registry
   */
  async close(): Promise<void> {
    await this.deregister();
    await this.driver.close();
  }
}

// ============================================
// Factory Functions
// ============================================

let defaultRegistry: ServiceRegistry | null = null;

export function initServiceRegistry(driver: ServiceRegistryDriver, config?: ServiceRegistryConfig): ServiceRegistry {
  defaultRegistry = new ServiceRegistry(driver, config);
  return defaultRegistry;
}

export function serviceRegistry(): ServiceRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ServiceRegistry(new MemoryServiceRegistryDriver());
  }
  return defaultRegistry;
}

export function createServiceRegistry(driver: ServiceRegistryDriver, config?: ServiceRegistryConfig): ServiceRegistry {
  return new ServiceRegistry(driver, config);
}

export default ServiceRegistry;
