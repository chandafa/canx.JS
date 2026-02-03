import type { BrowserConfig } from './Browser';

/**
 * Chrome Driver Helper
 * Launches Puppeteer instance
 */
export class Chrome {
  static async launch(config: BrowserConfig = {}) {
    let puppeteer;
    try {
      // Dynamic import to avoid hard dependency
      // @ts-ignore
      puppeteer = await import('puppeteer');
    } catch (e) {
        try {
            // Try puppeteer-core as fallback
            // @ts-ignore
            puppeteer = await import('puppeteer-core');
        } catch (e2) {
            throw new Error('Puppeteer is not installed. Please install it via `bun add -d puppeteer`.');
        }
    }

    const launchOptions = {
      headless: config.headless !== false ? (config.headless === true ? 'new' : config.headless) : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...config.launchOptions,
    };

    const browser = await puppeteer.default.launch(launchOptions);
    return browser;
  }
}
