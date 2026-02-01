/**
 * CanxJS Browser Testing Helper
 * High-level wrapper for E2E testing (Playwright/Puppeteer compatible interface)
 */

export interface BrowserConfig {
  headless?: boolean;
  viewport?: { width: number; height: number };
  baseUrl?: string;
  screenshotDir?: string;
}

export class Browser {
  private config: BrowserConfig;
  private _driver: any; // Underlying driver (Playwright/Puppeteer page)

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: true,
      viewport: { width: 1280, height: 720 },
      baseUrl: 'http://localhost:3000',
      ...config,
    };
  }

  /**
   * Set the underlying driver instance
   */
  setDriver(driver: any) {
    this._driver = driver;
  }

  /**
   * Visit a URL
   */
  async visit(path: string): Promise<this> {
    if (!this._driver) throw new Error('Browser driver not initialized');
    const url = path.startsWith('http') ? path : `${this.config.baseUrl}${path}`;
    await this._driver.goto(url);
    return this;
  }

  /**
   * Type into an input
   */
  async type(selector: string, text: string): Promise<this> {
    if (!this._driver) throw new Error('Browser driver not initialized');
    await this._driver.fill ? this._driver.fill(selector, text) : this._driver.type(selector, text);
    return this;
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<this> {
    if (!this._driver) throw new Error('Browser driver not initialized');
    await this._driver.click(selector);
    return this;
  }

  /**
   * Press a key
   */
  async press(key: string): Promise<this> {
    if (!this._driver) throw new Error('Browser driver not initialized');
    await this._driver.keyboard.press(key);
    return this;
  }

  /**
   * Assert text exists
   */
  async see(text: string): Promise<this> {
    if (!this._driver) throw new Error('Browser driver not initialized');
    // Simplified assertion logic
    const content = await this._driver.content();
    if (!content.includes(text)) {
      throw new Error(`Expected to see "${text}", but it was not found.`);
    }
    return this;
  }

  /**
   * Assert element exists
   */
  async seeElement(selector: string): Promise<this> {
    if (!this._driver) throw new Error('Browser driver not initialized');
    const el = await this._driver.$(selector);
    if (!el) {
      throw new Error(`Expected to see element "${selector}", but it was not found.`);
    }
    return this;
  }

  /**
   * Take screenshot
   */
  async screenshot(name: string): Promise<this> {
    if (!this._driver) throw new Error('Browser driver not initialized');
    // Implementation depends on driver
    return this;
  }

  /**
   * Close browser
   */
  async quit(): Promise<void> {
    // Implementation depends on driver
  }
}

export const browser = new Browser();
