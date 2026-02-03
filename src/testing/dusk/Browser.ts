export interface BrowserConfig {
  headless?: boolean | 'new';
  viewport?: { width: number; height: number };
  baseUrl?: string;
  screenshotDir?: string;
  launchOptions?: Record<string, any>;
}

export class Browser {
  public page: any;
  public browser: any;
  public config: BrowserConfig;

  constructor(browser: any, page: any, config: BrowserConfig = {}) {
    this.browser = browser;
    this.page = page;
    this.config = config;
  }

  /**
   * Visit a URL
   */
  async visit(path: string): Promise<this> {
    const url = path.startsWith('http') ? path : `${this.config.baseUrl || 'http://localhost:3000'}${path}`;
    await this.page.goto(url, { waitUntil: 'networkidle0' });
    return this;
  }

  /**
   * Type text into selector
   */
  async type(selector: string, text: string): Promise<this> {
    await this.page.type(selector, text);
    return this;
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<this> {
    await this.page.click(selector);
    return this;
  }

  /**
   * Press a key
   */
  async press(key: string): Promise<this> {
    await this.page.keyboard.press(key);
    return this;
  }

  /**
   * Wait for selector
   */
  async waitFor(selector: string): Promise<this> {
    await this.page.waitForSelector(selector);
    return this;
  }

  /**
   * Wait for text
   */
  async waitForText(text: string): Promise<this> {
    await this.page.waitForFunction(
      (text: string) => document.body.innerText.includes(text),
      {},
      text
    );
    return this;
  }

  /**
   * Assert that the given text is visible
   */
  async assertSee(text: string): Promise<this> {
    const content = await this.page.content();
    if (!content.includes(text)) {
      throw new Error(`Expected text "${text}" not found on page.`);
    }
    return this;
  }

  /**
   * Assert that the given text is not visible
   */
  async assertDontSee(text: string): Promise<this> {
    const content = await this.page.content();
    if (content.includes(text)) {
      throw new Error(`Unexpected text "${text}" found on page.`);
    }
    return this;
  }

  /**
   * Assert current path matches
   */
  async assertPathIs(path: string): Promise<this> {
    const url = this.page.url();
    const currentPath = new URL(url).pathname;
    if (currentPath !== path) {
      throw new Error(`Expected path to be "${path}", but got "${currentPath}".`);
    }
    return this;
  }

  /**
   * Assert title matches
   */
  async assertTitle(title: string): Promise<this> {
    const currentTitle = await this.page.title();
    if (currentTitle !== title) {
      throw new Error(`Expected title "${title}", but got "${currentTitle}".`);
    }
    return this;
  }

  /**
   * Get value of an input
   */
  async value(selector: string): Promise<string> {
    return this.page.$eval(selector, (el: any) => el.value);
  }

  /**
   * Get text of an element
   */
  async text(selector: string): Promise<string> {
    return this.page.$eval(selector, (el: any) => el.innerText);
  }

  /**
   * Take screenshot
   */
  async screenshot(name: string): Promise<this> {
    if (this.config.screenshotDir) {
        await this.page.screenshot({ path: `${this.config.screenshotDir}/${name}.png` });
    }
    return this;
  }

  /**
   * Quit the browser
   */
  async quit(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
