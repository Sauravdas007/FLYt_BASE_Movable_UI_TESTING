import { BrowserManager } from '../browser/browser-manager.ts';
import { ActionExecutor } from './action-executor.ts';
import { StateObserver } from './state-observer.ts';

export async function runPhaseTwoDemo(): Promise<void> {
  const browser = new BrowserManager();
  const cockpit = await browser.launch('http://localhost:4010');

  try {
    const executor = new ActionExecutor(cockpit);
    const observer = new StateObserver(cockpit);

    const selected = await executor.selectDroneByIndex(0);
    console.log('selected-drone', selected);

    await cockpit.goto('http://localhost:4000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const dashboardExecutor = new ActionExecutor(cockpit);
    const takeoff = await dashboardExecutor.clickIntent('start_flight', 'Take off');
    console.log('start-flight-click', takeoff);

    await cockpit.goto('http://localhost:4010', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const inFlight = await observer.waitForStatus('drone-1', 'in_flight', 20000);
    console.log('status-in-flight', inFlight);

    await cockpit.goto('http://localhost:4000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const land = await dashboardExecutor.clickIntent('land', 'Land');
    console.log('land-click', land);

    await cockpit.goto('http://localhost:4010', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const landed = await observer.waitForStatus('drone-1', 'standby', 20000);
    console.log('status-on-ground', landed);
  } finally {
    await browser.close();
  }
}
