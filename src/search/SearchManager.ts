import { SearchEngine } from './engines/Engine';
import { DatabaseEngine } from './engines/DatabaseEngine';

export class SearchManager {
  private drivers: Map<string, SearchEngine> = new Map();
  private defaultDriver: string = 'database';

  constructor() {
    this.register('database', new DatabaseEngine());
  }

  /**
   * Register a new custom driver
   */
  register(name: string, driver: SearchEngine): this {
    this.drivers.set(name, driver);
    return this;
  }

  /**
   * Get a driver instance
   */
  engine(name?: string): SearchEngine {
    const driverName = name || this.defaultDriver;
    const driver = this.drivers.get(driverName);
    
    if (!driver) {
      throw new Error(`Search engine [${driverName}] is not defined.`);
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
export const Scout = searchManager;

