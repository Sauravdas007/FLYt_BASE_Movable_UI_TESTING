import type { Page } from 'playwright';
import { loadApplicationMap } from '../application/application-map.ts';

export interface LocatorCandidate {
  locator: string;
  strategy: string;
  confidence: number;
}

export async function resolveSemanticLocator(page: Page, intentId: string, preferredText?: string): Promise<LocatorCandidate | null> {
  const appMap = await loadApplicationMap();
  if (!appMap) return null;

  const recovered = [...(appMap.recoveryHistory ?? [])]
    .filter((entry) => entry.intentId === intentId)
    .sort((a, b) => b.confidence - a.confidence)
    .map((entry) => ({
      locator: entry.recoveredLocator,
      strategy: entry.recoveredLocator.startsWith('[data-testid=') ? 'data-testid' : entry.recoveredLocator.includes('button:has-text') ? 'button-text' : 'semantic-text',
      confidence: entry.confidence,
    }));

  for (const candidate of recovered) {
    try {
      const resolved = page.locator(candidate.locator);
      if ((await resolved.count()) > 0) {
        const first = resolved.first();
        const visible = await first.isVisible().catch(() => false);
        if (visible || (await resolved.count()) > 0) return candidate;
      }
    } catch {
      // ignore
    }
  }

  const intent = appMap.intents.find((i) => i.intentId === intentId);
  if (!intent) return null;

  const ordered = [...intent.locatorCandidates].sort((a, b) => {
    const aScore = a.includes('button:has-text') ? 0 : a.startsWith('[data-testid=') ? 1 : 2;
    const bScore = b.includes('button:has-text') ? 0 : b.startsWith('[data-testid=') ? 1 : 2;
    return aScore - bScore;
  });

  const candidates: LocatorCandidate[] = ordered.map((locator) => {
    const strategy = locator.startsWith('[data-testid=') ? 'data-testid' : locator.startsWith('role=') ? 'aria-role' : locator.includes('button:has-text') ? 'button-text' : locator.includes('text=') ? 'semantic-text' : 'fallback';
    const confidence = strategy === 'data-testid' ? 0.98 : strategy === 'aria-role' ? 0.9 : strategy === 'button-text' ? 0.88 : strategy === 'semantic-text' ? 0.8 : 0.6;
    return { locator, strategy, confidence };
  });

  for (const candidate of candidates) {
    try {
      const resolved = page.locator(candidate.locator);
      const count = await resolved.count();
      if (count > 0) {
        const first = resolved.first();
        const visible = await first.isVisible().catch(() => false);
        if (visible || count > 0) return candidate;
      }
    } catch {
      // ignore and continue trying the next locator
    }
  }

  if (preferredText) {
    const buttonLocator = `button:has-text("${preferredText}")`;
    try {
      const resolved = page.locator(buttonLocator);
      if ((await resolved.count()) > 0) return { locator: buttonLocator, strategy: 'button-text', confidence: 0.86 };
    } catch {
      // ignored
    }
  }

  return null;
}
