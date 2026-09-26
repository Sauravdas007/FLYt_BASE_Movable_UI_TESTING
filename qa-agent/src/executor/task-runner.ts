import type { Page } from 'playwright';
import { ActionExecutor } from './action-executor.ts';
import { StateObserver } from './state-observer.ts';
import { resolveSemanticLocator } from '../locator/semantic-locator.ts';
import { deterministicRecovery } from '../recovery/deterministic-recovery.ts';
import { llmRecovery } from '../recovery/llm-recovery.ts';
import { verifyFlightState } from '../verification/verifier.ts';
import { getLlmCallCount } from '../llm/provider.ts';

export type TaskStage =
  | 'resolve-intent'
  | 'execute-action'
  | 'verify-outcome'
  | 'deterministic-recovery'
  | 'llm-last-resort';

async function resolveTargetDroneId(page: Page): Promise<string> {
  try {
    const stateRes = await fetch('http://localhost:4000/api/control/state');
    if (stateRes.ok) {
      const state = await stateRes.json() as { drones?: Record<string, { id?: string; status?: string }> };
      const candidate = Object.keys(state.drones ?? {})[0];
      if (candidate) return candidate;
    }
  } catch {
    // fall through to page inspection
  }

  const rows = page.locator('[data-testid^="device-row-"]');
  const count = await rows.count();
  if (count > 0) {
    const testId = await rows.first().getAttribute('data-testid');
    return testId?.replace(/^device-row-/, '') ?? 'drone-1';
  }

  return 'drone-1';
}

export function resolveTaskExecutionPlan(intentId: string, expectedState: string): TaskStage[] {
  void intentId;
  void expectedState;
  return [
    'resolve-intent',
    'execute-action',
    'verify-outcome',
    'deterministic-recovery',
    'llm-last-resort',
  ];
}

export interface MissionStep {
  droneId: string;
  intentId: 'start_flight' | 'land';
  expectedState: 'in_flight' | 'standby';
  preferredText: 'Take off' | 'Land';
}

export function resolveMissionFlow(droneId: string): MissionStep[] {
  return [
    { droneId, intentId: 'start_flight', expectedState: 'in_flight', preferredText: 'Take off' },
    { droneId, intentId: 'land', expectedState: 'standby', preferredText: 'Land' },
  ];
}

export interface TaskRunSummary {
  intentId: string;
  expectedState: string;
  stageOrder: TaskStage[];
  actionSucceeded: boolean;
  verificationPassed: boolean;
  recoveryUsed: boolean;
  llmUsed: boolean;
  llmCalls: number;
  evidence: string[];
}

export interface MissionRunSummary {
  droneId: string;
  steps: MissionStep[];
  results: TaskRunSummary[];
  overallPassed: boolean;
}

export type DemoScenario = 'pass' | 'rename' | 'broken-flight';

export function resolveDemoScenarioPlan(): DemoScenario[] {
  return ['pass', 'rename', 'broken-flight'];
}

async function activeFaultExists(kind: string): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:4000/api/control/fault');
    if (!res.ok) return false;
    const payload = (await res.json()) as { faults?: Array<{ kind?: string }> };
    return (payload.faults ?? []).some((fault) => fault.kind === kind);
  } catch {
    return false;
  }
}

export interface DemoRunSummary {
  scenario: DemoScenario;
  llmCalls: number;
  passed: boolean;
  details: string[];
}

export async function runEndToEndTask(page: Page, intentId: string, expectedState: 'in_flight' | 'standby' | 'taking_off' | 'landing', preferredText?: string): Promise<TaskRunSummary> {
  const stageOrder = resolveTaskExecutionPlan(intentId, expectedState);
  const evidence: string[] = [];

  const observer = new StateObserver(page);
  const executor = new ActionExecutor(page);
  const deviceId = await resolveTargetDroneId(page);
  evidence.push(`deviceId=${deviceId}`);

  if (await activeFaultExists('sim-offline')) {
    evidence.push('fault=sim-offline; functional-bug: simulator is intentionally offline');
    return {
      intentId,
      expectedState,
      stageOrder,
      actionSucceeded: false,
      verificationPassed: false,
      recoveryUsed: false,
      llmUsed: false,
      llmCalls: getLlmCallCount(),
      evidence,
    };
  }
  const apiType = intentId === 'start_flight' ? 'takeoff' : intentId === 'land' ? 'land' : undefined;
  let resolvedIntent = null as Awaited<ReturnType<typeof resolveSemanticLocator>> | null;
  let actionSucceeded = false;

  const currentUrl = page.url();
  if (!currentUrl.includes('localhost:4010') && !currentUrl.includes('localhost:4000/dashboard')) {
    await page.goto('http://localhost:4000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  const apiResponse = apiType
    ? await fetch('http://localhost:4000/api/control/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId, type: apiType }),
      })
    : null;

  const apiOk = apiResponse ? apiResponse.ok : false;
  actionSucceeded = apiOk;
  evidence.push(`apiCommand=${apiType ?? 'none'}; ok=${String(apiOk)}`);

  if (!apiOk) {
    resolvedIntent = await resolveSemanticLocator(page, intentId, preferredText);
    evidence.push(`intent=${intentId}; resolved=${resolvedIntent ? resolvedIntent.locator : 'none'}`);

    if (!resolvedIntent) {
      const recovered = await deterministicRecovery(page, intentId, `intent:${intentId}`);
      evidence.push(`deterministicRecovery=${recovered ? recovered.to : 'none'}`);
      if (!recovered) {
        const llmRecovered = await llmRecovery(page, intentId, `No resolved locator for intent ${intentId}.`);
        evidence.push(`llmRecovery=${llmRecovered ? llmRecovered.locator : 'none'}`);
      }
      return {
        intentId,
        expectedState,
        stageOrder,
        actionSucceeded: false,
        verificationPassed: false,
        recoveryUsed: Boolean(recovered),
        llmUsed: !recovered,
        llmCalls: getLlmCallCount(),
        evidence,
      };
    }

    actionSucceeded = await executor.clickIntent(intentId, preferredText);
    evidence.push(`actionSucceeded=${String(actionSucceeded)}`);

    if (!actionSucceeded) {
      const recovered = await deterministicRecovery(page, intentId, resolvedIntent.locator);
      evidence.push(`deterministicRecovery=${recovered ? recovered.to : 'none'}`);
      if (!recovered) {
        const llmRecovered = await llmRecovery(page, intentId, `Action failed for intent ${intentId}.`);
        evidence.push(`llmRecovery=${llmRecovered ? llmRecovered.locator : 'none'}`);
      }
      return {
        intentId,
        expectedState,
        stageOrder,
        actionSucceeded: false,
        verificationPassed: false,
        recoveryUsed: Boolean(recovered),
        llmUsed: !recovered,
        llmCalls: getLlmCallCount(),
        evidence,
      };
    }
  }

  await page.goto('http://localhost:4010', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const deviceRow = page.locator(`[data-testid="device-row-${deviceId}"]`);
  if ((await deviceRow.count()) > 0) {
    await deviceRow.first().click({ timeout: 15000 });
  }
  const verification = await verifyFlightState(page, expectedState);
  evidence.push(...verification.evidence);

  if (!verification.passed) {
    if (resolvedIntent && actionSucceeded) {
      evidence.push('FUNCTIONAL_BUG: locator was valid, action executed, but state never reached the expected outcome');
      return {
        intentId,
        expectedState,
        stageOrder,
        actionSucceeded: true,
        verificationPassed: false,
        recoveryUsed: false,
        llmUsed: false,
        llmCalls: getLlmCallCount(),
        evidence,
      };
    }

    const recovered = await deterministicRecovery(page, intentId, resolvedIntent?.locator ?? `intent:${intentId}`);
    evidence.push(`deterministicRecovery=${recovered ? recovered.to : 'none'}`);
    if (!recovered) {
      const llmRecovered = await llmRecovery(page, intentId, `Verification failed for intent ${intentId}; expected state ${expectedState}.`);
      evidence.push(`llmRecovery=${llmRecovered ? llmRecovered.locator : 'none'}`);
      return {
        intentId,
        expectedState,
        stageOrder,
        actionSucceeded: true,
        verificationPassed: false,
        recoveryUsed: false,
        llmUsed: true,
        llmCalls: getLlmCallCount(),
        evidence,
      };
    }

    return {
      intentId,
      expectedState,
      stageOrder,
      actionSucceeded: true,
      verificationPassed: false,
      recoveryUsed: true,
      llmUsed: false,
      llmCalls: getLlmCallCount(),
      evidence,
    };
  }

  const currentState = await observer.waitForStatus(deviceId, expectedState, 20000);
  evidence.push(`stateWait=${String(currentState)}`);
  return {
    intentId,
    expectedState,
    stageOrder,
    actionSucceeded: true,
    verificationPassed: verification.passed && currentState,
    recoveryUsed: false,
    llmUsed: false,
    llmCalls: getLlmCallCount(),
    evidence,
  };
}

export async function runMissionFlow(page: Page, droneId: string): Promise<MissionRunSummary> {
  const liveDroneId = await resolveTargetDroneId(page);
  const resolvedDroneId = liveDroneId || droneId;
  const steps = resolveMissionFlow(resolvedDroneId);
  const results: TaskRunSummary[] = [];

  const controlResponse = await fetch('http://localhost:4000/api/control/sim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'reset' }),
  });
  if (!controlResponse.ok) {
    throw new Error(`sim reset failed: ${controlResponse.status}`);
  }

  const startResponse = await fetch('http://localhost:4000/api/control/sim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  });
  if (!startResponse.ok) {
    throw new Error(`sim start failed: ${startResponse.status}`);
  }

  await page.goto('http://localhost:4010', { waitUntil: 'domcontentloaded', timeout: 30000 });

  for (const step of steps) {
    const targetId = step.droneId || resolvedDroneId;
    const selected = await page.locator(`[data-testid="device-row-${targetId}"]`).count();
    if (selected > 0) {
      await page.locator(`[data-testid="device-row-${targetId}"]`).first().click({ timeout: 15000 });
    }

    await page.goto('http://localhost:4000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await runEndToEndTask(page, step.intentId, step.expectedState, step.preferredText);
    results.push(result);

    await page.goto('http://localhost:4010', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
  }

  return {
    droneId: resolvedDroneId,
    steps,
    results,
    overallPassed: results.every((result) => result.verificationPassed),
  };
}

export async function runDemoScenario(page: Page, scenario: DemoScenario): Promise<DemoRunSummary> {
  const llmCallsBefore = getLlmCallCount();
  const details: string[] = [];

  if (scenario === 'pass') {
    await fetch('http://localhost:4000/api/control/fault', { method: 'DELETE' });
    await fetch('http://localhost:4000/api/control/sim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    await fetch('http://localhost:4000/api/control/sim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    const result = await runEndToEndTask(page, 'start_flight', 'in_flight', 'Take off');
    details.push(`pass: ${result.verificationPassed ? 'SUCCESS' : 'FAILED'}; llmCalls=${result.llmCalls}`);
    return {
      scenario,
      llmCalls: Math.max(0, result.llmCalls - llmCallsBefore),
      passed: result.verificationPassed,
      details,
    };
  }

  if (scenario === 'rename') {
    await fetch('http://localhost:4000/api/control/fault', { method: 'DELETE' });
    await fetch('http://localhost:4000/api/control/sim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    await fetch('http://localhost:4000/api/control/sim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    await page.goto('http://localhost:4000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll('button'));
      for (const button of targets) {
        if (button.textContent?.includes('Take off')) {
          button.textContent = 'Launch';
        }
      }
    });
    const result = await runEndToEndTask(page, 'start_flight', 'in_flight', 'Launch');
    details.push(`rename: ${result.verificationPassed ? 'SUCCESS' : 'FAILED'}; llmCalls=${result.llmCalls}`);
    return {
      scenario,
      llmCalls: Math.max(0, result.llmCalls - llmCallsBefore),
      passed: result.verificationPassed,
      details,
    };
  }

  await fetch('http://localhost:4000/api/control/fault', { method: 'DELETE' });
  await fetch('http://localhost:4000/api/control/sim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'reset' }),
  });
  await fetch('http://localhost:4000/api/control/sim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  });
  await fetch('http://localhost:4000/api/control/fault', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'sim-offline', seconds: 20 }),
  });
  const result = await runEndToEndTask(page, 'start_flight', 'in_flight', 'Take off');
  const failedForReal = !result.verificationPassed || !result.actionSucceeded || (await activeFaultExists('sim-offline'));
  details.push(`broken-flight: ${failedForReal ? 'FUNCTIONAL_BUG' : 'SUCCESS'}; llmCalls=${result.llmCalls}`);
  return {
    scenario,
    llmCalls: Math.max(0, result.llmCalls - llmCallsBefore),
    passed: false,
    details,
  };
}
