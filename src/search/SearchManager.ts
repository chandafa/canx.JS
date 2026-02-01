import type { SearchDriver } from './types';
import { DatabaseSearchDriver } from './drivers/DatabaseSearchDriver';

export class SearchManager {
  private drivers: Map<string, SearchDriver> = new Map();
  private defaultDriver: string = 'database';

  constructor() {
    this.register('database', new DatabaseSearchDriver());
  }

  /**
   * Register a new custom driver
   */
  register(name: string, driver: SearchDriver): this {
    this.drivers.set(name, driver);
    return this;
  }

  /**
   * Get a driver instance
   */
  driver(name?: string): SearchDriver {
    const driverName = name || this.defaultDriver;
    const driver = this.drivers.get(driverName);
    
    if (!driver) {
      throw new Error(`Search driver [${driverName}] is not defined.`);
    }
    
    return driver;
  }

  /**
   * Set the default driver name
   */
  setDefaultDriver(name: string): this {
    this.defaultDriver = name;
    return this;
  }
}

export const searchManager = new SearchManager();
export default searchManager;
