import type { Page } from 'playwright';
import { recordRecoveryHistory } from '../application/application-map.ts';

export interface RecoveryAttempt {
  from: string;
  to: string;
  reason: string;
  confidence: number;
}

export async function deterministicRecovery(page: Page, intentId: string, originalLocator: string): Promise<RecoveryAttempt | null> {
  const fallbackCandidates = {
    start_flight: ['button:has-text("Take off")', 'button:has-text("Launch")', 'text=Take off', 'text=Launch'],
    land: ['button:has-text("Land")', 'button:has-text("Return")', 'text=Land', 'text=Return'],
    select_drone: ['[data-testid^="device-row-"]', 'text=Drone 1', 'text=Drone 2'],
  };

  const candidates = fallbackCandidates[intentId as keyof typeof fallbackCandidates] ?? [originalLocator];
  for (const locator of candidates) {
    try {
      const resolved = page.locator(locator);
      if ((await resolved.count()) > 0) {
        const attempt = {
          from: originalLocator,
          to: locator,
          reason: 'Fallback locator matched after deterministic recovery search',
          confidence: 0.82,
        };
        await recordRecoveryHistory({
          intentId,
          originalLocator,
          recoveredLocator: locator,
          confidence: attempt.confidence,
          usedAt: new Date().toISOString(),
          llmInvoked: false,
        });
        return attempt;
      }
    } catch {
      // ignored; keep checking other candidates
    }
  }

  return null;
}
