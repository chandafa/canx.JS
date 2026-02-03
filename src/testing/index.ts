import { Chrome } from './dusk/Chrome';
import { Browser, type BrowserConfig } from './dusk/Browser';

// Export core testing classes
export * from './TestCase';
export * from './TestHelper';

// Export Dusk-like browser testing
export { Browser, Chrome, BrowserConfig };

/**
 * Run a browser test
 * @example
 * await browse(async (browser) => {
 *   await browser.visit('/').assertSee('Welcome');
 * });
 */
export async function browse(
  callback: (browser: Browser) => Promise<void>,
  config: BrowserConfig = {}
): Promise<void> {
  let browserInstance;
  let page;
  
  try {
    browserInstance = await Chrome.launch(config);
    page = await browserInstance.newPage();
    
    // Set viewport if configured
    if (config.viewport) {
      await page.setViewport(config.viewport);
    }

    const browser = new Browser(browserInstance, page, config);
    
    await callback(browser);
    
  } catch (e) {
    throw e;
  } finally {
    if (browserInstance) {
      await browserInstance.close();
    }
  }
}
