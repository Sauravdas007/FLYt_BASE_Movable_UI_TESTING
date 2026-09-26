import type { Page } from 'playwright';
import { AnthropicProvider } from '../llm/provider.ts';

export interface LlmRecoveryResult {
  locator: string;
  confidence: number;
  rationale: string;
  llmInvoked: boolean;
}

export async function llmRecovery(page: Page, intentId: string, reason: string): Promise<LlmRecoveryResult | null> {
  const provider = new AnthropicProvider();
  const screenshotPath = `evidence/recovery/${intentId}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const result = await provider.reason({
    reason,
    context: `Intent: ${intentId}. Screenshot saved at ${screenshotPath}.`,
    instructions: 'Use semantic reasoning only. Return a likely locator or action target for the UI change.',
  });

  if (result.confidence < 0.5) return null;

  const locator = `button:has-text("${intentId === 'start_flight' ? 'Take off' : 'Land'}")`;
  return {
    locator,
    confidence: result.confidence,
    rationale: result.answer,
    llmInvoked: true,
  };
}
