import type { Page } from 'playwright';

export interface ElementObservation {
  tagName: string;
  role: string;
  name: string;
  text: string;
  testId?: string;
  ariaLabel?: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function collectElementObservations(page: Page): Promise<ElementObservation[]> {
  return page.evaluate(() => {
    const selector = 'button, [role], a, input, select, textarea, [data-testid], h1, h2, h3, h4, li, div, span';
    const nodes = Array.from(document.querySelectorAll(selector));

    return nodes
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .map((el) => {
        const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
        const ariaLabel = el.getAttribute('aria-label') ?? undefined;
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          role,
          name: ariaLabel ?? (text || el.getAttribute('aria-label') || ''),
          text,
          testId: el.getAttribute('data-testid') ?? undefined,
          ariaLabel,
          visible: true,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      });
  });
}

export async function collectNetworkEvents(page: Page): Promise<string[]> {
  const events: string[] = [];
  page.on('request', (req) => events.push(`request:${req.method()} ${req.url()}`));
  page.on('response', (res) => events.push(`response:${res.status()} ${res.url()}`));
  return events;
}

export async function takeScreenshot(page: Page, outputPath: string): Promise<void> {
  await page.screenshot({ path: outputPath, fullPage: true });
}
