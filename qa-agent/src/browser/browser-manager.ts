import { chromium, type Browser, type Page } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;

  async launch(url = 'http://localhost:4010'): Promise<Page> {
    this.browser = await chromium.launch({ headless: true });
    const page = await this.browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
    return page;
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}
