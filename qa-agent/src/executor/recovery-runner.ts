import { BrowserManager } from '../browser/browser-manager.ts';
import { verifyFlightState } from '../verification/verifier.ts';
import { deterministicRecovery } from '../recovery/deterministic-recovery.ts';
import { llmRecovery } from '../recovery/llm-recovery.ts';

export async function runRecoveryDemo(): Promise<void> {
  const browser = new BrowserManager();
  const page = await browser.launch('http://localhost:4000/dashboard');

  try {
    const originalLocator = 'button:has-text("Take off")';
    const recovered = await deterministicRecovery(page, 'start_flight', originalLocator);
    if (recovered) {
      console.log('deterministic-recovery', recovered);
    } else {
      const llmRecovered = await llmRecovery(page, 'start_flight', 'UI changed but action intent should still be clickable via the control panel');
      console.log('llm-recovery', llmRecovered);
    }

    await page.goto('http://localhost:4010', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await verifyFlightState(page, 'in_flight');
    console.log('verification', result);
  } finally {
    await browser.close();
  }
}
