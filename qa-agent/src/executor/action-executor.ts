import type { Page } from 'playwright';
import { resolveSemanticLocator } from '../locator/semantic-locator.ts';

export class ActionExecutor {
  constructor(private readonly page: Page) {}

  async clickIntent(intentId: string, preferredText?: string, overrideLocator?: string): Promise<boolean> {
    const candidate = overrideLocator
      ? { locator: overrideLocator, strategy: 'override', confidence: 1 }
      : await resolveSemanticLocator(this.page, intentId, preferredText);
    if (!candidate) return false;

    const locator = this.page.locator(candidate.locator);
    const count = await locator.count();
    if (count === 0) return false;

    const enabledIndex = await locator.evaluateAll((elements) => {
      const visibleIndex = elements.findIndex((element) => {
        const el = element as HTMLElement;
        return !el.hasAttribute('disabled') && !el.matches(':disabled') && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      });
      return visibleIndex;
    });

    if (enabledIndex === -1) {
      return false;
    }

    await locator.nth(enabledIndex).click({ timeout: 15000 });
    return true;
  }

  async selectDroneByIndex(index: number): Promise<boolean> {
    const row = this.page.locator('[data-testid^="device-row-"]').nth(index);
    if ((await row.count()) === 0) return false;
    await row.click({ timeout: 15000 });
    return true;
  }
}
