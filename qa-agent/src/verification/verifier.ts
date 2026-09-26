import type { Page } from 'playwright';

export interface VerificationResult {
  passed: boolean;
  confidence: number;
  evidence: string[];
  state: string;
}

export async function verifyFlightState(page: Page, expected: 'in_flight' | 'standby' | 'taking_off' | 'landing'): Promise<VerificationResult> {
  const deadline = Date.now() + 20000;
  let lastStatus = 'unknown';
  let lastSpeed = 0;
  let lastAltitude = 0;
  let lastSocket = 'unknown';

  const readSnapshot = async (): Promise<{ status: string; speed: number; altitude: number; socket: string }> => {
    const statusText = ((await page.locator('[data-testid="status-flight"]').textContent()) ?? '').trim().toLowerCase();
    const speedText = ((await page.locator('[data-testid="telemetry-hspeed"]').textContent()) ?? '').trim();
    const altText = ((await page.locator('[data-testid="telemetry-alt-rlt"]').textContent()) ?? '').trim();
    const socketText = ((await page.locator('[data-testid="socket-status"]').textContent()) ?? '').trim().toLowerCase();

    return {
      status: statusText,
      speed: parseFloat(speedText.replace(/[^0-9.-]/g, '')) || 0,
      altitude: parseFloat(altText.replace(/[^0-9.-]/g, '')) || 0,
      socket: socketText,
    };
  };

  const matchesExpected = (status: string, speed: number, altitude: number): boolean => {
    const normalized = status.toLowerCase();

    if (expected === 'in_flight') {
      if (normalized.includes('in_flight')) return true;
      if (normalized.includes('taking_off') && (speed > 0 || altitude > 0.5)) return true;
      if (normalized.includes('landing') && speed > 0 && altitude > 0) return true;
      return false;
    }

    if (expected === 'standby') {
      if (normalized.includes('standby')) return speed <= 0.5 && altitude <= 0.5;
      if (normalized.includes('landing')) return speed <= 2 && altitude <= 10;
      return false;
    }

    if (expected === 'taking_off') {
      return normalized.includes('taking_off') || (normalized.includes('in_flight') && altitude > 0);
    }

    if (expected === 'landing') {
      return normalized.includes('landing') || (normalized.includes('in_flight') && altitude <= 20 && speed <= 5);
    }

    return false;
  };

  while (Date.now() < deadline) {
    try {
      const snapshot = await readSnapshot();
      lastStatus = snapshot.status;
      lastSpeed = snapshot.speed;
      lastAltitude = snapshot.altitude;
      lastSocket = snapshot.socket;

      const evidence = [
        `status=${lastStatus}`,
        `speed=${lastSpeed} m/s`,
        `altitude=${lastAltitude} m`,
        `socket=${lastSocket}`,
      ];

      if (matchesExpected(lastStatus, lastSpeed, lastAltitude)) {
        return {
          passed: true,
          confidence: 0.9,
          evidence,
          state: expected,
        };
      }
    } catch {
      // keep polling until the DOM settles into the expected state
    }

    await page.waitForTimeout(500);
  }

  const evidence = [
    `status=${lastStatus}`,
    `speed=${lastSpeed} m/s`,
    `altitude=${lastAltitude} m`,
    `socket=${lastSocket}`,
  ];

  return {
    passed: false,
    confidence: 0.1,
    evidence,
    state: expected,
  };
}

export async function verifyApplicationReady(page: Page): Promise<VerificationResult> {
  const socketStatus = ((await page.locator('[data-testid="socket-status"]').textContent()) ?? '').trim().toLowerCase();
  const deviceCount = await page.locator('[data-testid^="device-row-"]').count();
  const telemetryVisible = await page.locator('[data-testid^="telemetry-"]').first().isVisible().catch(() => false);

  let score = 0;
  if (socketStatus.includes('connected')) score += 0.4;
  if (deviceCount >= 4) score += 0.4;
  if (telemetryVisible) score += 0.2;

  return {
    passed: score >= 0.8,
    confidence: Math.min(1, score),
    evidence: [
      `socket=${socketStatus}`,
      `device-count=${deviceCount}`,
      `telemetry-visible=${telemetryVisible}`,
    ],
    state: 'ready',
  };
}
