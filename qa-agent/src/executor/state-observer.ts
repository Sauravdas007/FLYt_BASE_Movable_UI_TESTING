import type { Page } from 'playwright';

export interface DroneStateSnapshot {
  id: string;
  status: string;
  battery: number;
  height: number;
  speed: number;
  connected: boolean;
}

export class StateObserver {
  constructor(private readonly page: Page) {}

  async getCurrentDroneState(droneId: string): Promise<DroneStateSnapshot> {
    const value = await this.page.evaluate((id) => {
      const row = document.querySelector(`[data-testid="device-row-${id}"]`);
      const status = row?.textContent ?? 'unknown';
      const metrics = {
        id,
        status: status.includes('in_flight') ? 'in_flight' : status.includes('taking_off') ? 'taking_off' : status.includes('landing') ? 'landing' : status.includes('standby') ? 'standby' : 'unknown',
        battery: 100,
        height: 0,
        speed: 0,
        connected: true,
      };
      return metrics;
    }, droneId);
    return value;
  }

  async waitForStatus(droneId: string, expectedStatus: string, timeoutMs = 15000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const state = await this.getCurrentDroneState(droneId);
      if (state.status === expectedStatus) return true;
      await this.page.waitForTimeout(250);
    }
    return false;
  }
}
