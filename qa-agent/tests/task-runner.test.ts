import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { ActionExecutor } from '../src/executor/action-executor.ts';
import { resolveDemoScenarioPlan, resolveMissionFlow, resolveTaskExecutionPlan } from '../src/executor/task-runner.ts';
import { verifyFlightState } from '../src/verification/verifier.ts';

describe('resolveTaskExecutionPlan', () => {
  it('orders deterministic recovery before LLM fallback', () => {
    const plan = resolveTaskExecutionPlan('start_flight', 'in_flight');
    assert.deepEqual(plan, [
      'resolve-intent',
      'execute-action',
      'verify-outcome',
      'deterministic-recovery',
      'llm-last-resort',
    ]);
  });
});

describe('resolveMissionFlow', () => {
  it('defines a takeoff then landing mission sequence', () => {
    const flow = resolveMissionFlow('drone-1');
    assert.deepEqual(flow, [
      { intentId: 'start_flight', expectedState: 'in_flight', preferredText: 'Take off', droneId: 'drone-1' },
      { intentId: 'land', expectedState: 'standby', preferredText: 'Land', droneId: 'drone-1' },
    ]);
  });
});

describe('resolveDemoScenarioPlan', () => {
  it('defines the three hackathon demo scenarios', () => {
    const plan = resolveDemoScenarioPlan();
    assert.deepEqual(plan, ['pass', 'rename', 'broken-flight']);
  });
});

describe('ActionExecutor', () => {
  it('clicks the first enabled takeoff button instead of a disabled stale one', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(`
      <div>
        <button data-cmd="takeoff" data-id="drone-1" disabled onclick="this.setAttribute('data-pressed','true')">Take off</button>
        <button data-cmd="takeoff" data-id="drone-2" onclick="this.setAttribute('data-pressed','true')">Take off</button>
        <button data-cmd="takeoff" data-id="drone-3" disabled onclick="this.setAttribute('data-pressed','true')">Take off</button>
      </div>
    `);

    const executor = new ActionExecutor(page);
    const clicked = await executor.clickIntent('start_flight', 'Take off', 'button:has-text("Take off")');

    assert.equal(clicked, true);
    const clickedId = await page.locator('[data-cmd="takeoff"]').evaluateAll((els) => {
      const match = els.find((el) => el.getAttribute('data-pressed') === 'true');
      return match?.getAttribute('data-id') ?? 'none';
    });

    assert.equal(clickedId, 'drone-2');
    await browser.close();
  });
});

describe('verifyFlightState', () => {
  it('accepts taking_off as valid in_flight progress while altitude rises', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(`
      <div>
        <span data-testid="status-flight">taking_off</span>
        <span data-testid="telemetry-hspeed">0.0 m/s</span>
        <span data-testid="telemetry-alt-rlt">12.0 m</span>
        <span data-testid="socket-status">socket connected</span>
      </div>
    `);

    const result = await verifyFlightState(page, 'in_flight');
    assert.equal(result.passed, true);
    await browser.close();
  });

  it('accepts landing as valid standby progress while altitude is descending to zero', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(`
      <div>
        <span data-testid="status-flight">landing</span>
        <span data-testid="telemetry-hspeed">0.0 m/s</span>
        <span data-testid="telemetry-alt-rlt">3.0 m</span>
        <span data-testid="socket-status">socket connected</span>
      </div>
    `);

    const result = await verifyFlightState(page, 'standby');
    assert.equal(result.passed, true);
    await browser.close();
  });
});
