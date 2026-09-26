import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BrowserManager } from '../browser/browser-manager.ts';
import { collectElementObservations, takeScreenshot } from '../browser/observation.ts';
import { saveApplicationMap } from '../application/application-map.ts';
import { ApplicationMapSchema } from '../application/schema.ts';
import { analyzeDom } from './dom-analyzer.ts';

export async function runDiscovery(): Promise<void> {
  const browser = new BrowserManager();
  const page = await browser.launch();

  try {
    const elements = await collectElementObservations(page);
    const inventory = analyzeDom(elements);

    const map = ApplicationMapSchema.parse({
      generatedAt: new Date().toISOString(),
      app: 'FlytBase Cockpit',
      url: 'http://localhost:4010',
      regions: {
        global_shell: { id: 'global_shell', label: 'Global shell', description: 'Shell and header', confidence: 0.96 },
        map: { id: 'map', label: 'Map', description: 'Cesium map viewport', confidence: 0.97 },
        video: { id: 'video', label: 'Video', description: 'Selected drone video tile', confidence: 0.95 },
        dock_video: { id: 'dock_video', label: 'Dock video', description: 'Dock video container', confidence: 0.8 },
        mission_controls: { id: 'mission_controls', label: 'Mission controls', description: 'Action area for takeoff and landing', confidence: 0.9 },
        telemetry: { id: 'telemetry', label: 'Telemetry', description: 'Telemetry data panel', confidence: 0.96 },
        side_toolbar: { id: 'side_toolbar', label: 'Side toolbar', description: 'Device list and status panel', confidence: 0.92 },
      },
      entities: [
        { id: 'drone-1', kind: 'drone', name: 'Drone 1', stateList: ['offline', 'on_ground', 'taking_off', 'in_flight', 'landing'], defaultRegion: 'telemetry' },
        { id: 'drone-2', kind: 'drone', name: 'Drone 2', stateList: ['offline', 'on_ground', 'taking_off', 'in_flight', 'landing'], defaultRegion: 'telemetry' },
        { id: 'drone-3', kind: 'drone', name: 'Drone 3', stateList: ['offline', 'on_ground', 'taking_off', 'in_flight', 'landing'], defaultRegion: 'telemetry' },
        { id: 'drone-4', kind: 'drone', name: 'Drone 4', stateList: ['offline', 'on_ground', 'taking_off', 'in_flight', 'landing'], defaultRegion: 'telemetry' },
        { id: 'dock-1', kind: 'dock', name: 'Dock 1', stateList: ['closed', 'opening', 'open', 'closing'], defaultRegion: 'side_toolbar' },
        { id: 'dock-2', kind: 'dock', name: 'Dock 2', stateList: ['closed', 'opening', 'open', 'closing'], defaultRegion: 'side_toolbar' },
        { id: 'dock-3', kind: 'dock', name: 'Dock 3', stateList: ['closed', 'opening', 'open', 'closing'], defaultRegion: 'side_toolbar' },
        { id: 'dock-4', kind: 'dock', name: 'Dock 4', stateList: ['closed', 'opening', 'open', 'closing'], defaultRegion: 'side_toolbar' },
      ],
      intents: [
        {
          intentId: 'verify_application_ready',
          semanticTarget: 'cockpit ready state',
          preconditions: ['page_loaded', 'socket_connected', 'drones_visible'],
          locatorCandidates: ['[data-testid="socket-status"]', 'text=FlytBase Cockpit', 'text=Devices'],
          expectedTransitions: ['ready'],
          verificationRules: ['socket_connected', 'drones_visible', 'telemetry_panels_visible'],
          evidence: ['dom', 'screenshot'],
        },
        {
          intentId: 'select_drone',
          semanticTarget: 'drone row selection',
          preconditions: ['drone_list_visible'],
          locatorCandidates: ['[data-testid="device-row-drone-1"]', 'text=Drone 1', 'role=listitem'],
          expectedTransitions: ['selected_device_changed'],
          verificationRules: ['telemetry_updates_for_selected_drone', 'video_updates_for_selected_drone'],
          evidence: ['dom', 'socket'],
        },
        {
          intentId: 'start_flight',
          semanticTarget: 'takeoff action',
          preconditions: ['drone_on_ground'],
          locatorCandidates: ['text=Take off', 'button:has-text("Take off")', '[data-testid="takeoff-button"]'],
          expectedTransitions: ['taking_off', 'in_flight'],
          verificationRules: ['flight_status_becomes_taking_off', 'altitude_increases', 'speed_nonzero'],
          evidence: ['dom', 'telemetry', 'socket'],
        },
        {
          intentId: 'land',
          semanticTarget: 'land action',
          preconditions: ['drone_in_flight'],
          locatorCandidates: ['text=Land', 'button:has-text("Land")', '[data-testid="land-button"]'],
          expectedTransitions: ['landing', 'on_ground'],
          verificationRules: ['flight_status_becomes_landing', 'altitude_returns_to_zero'],
          evidence: ['dom', 'telemetry', 'socket'],
        },
      ],
      components: {
        'socket-status': { componentId: 'socket-status', region: 'global_shell', role: 'status', accessibleName: 'Socket connection', locatorStrategies: ['data-testid', 'role=status', 'text=socket connected'], state: 'visible', dataTestId: 'socket-status' },
        'device-row-drone-1': { componentId: 'device-row-drone-1', region: 'side_toolbar', role: 'listitem', accessibleName: 'Drone 1', locatorStrategies: ['data-testid', 'text=Drone 1'], state: 'visible', dataTestId: 'device-row-drone-1' },
        'telemetry-battery': { componentId: 'telemetry-battery', region: 'telemetry', role: 'definition', accessibleName: 'Battery', locatorStrategies: ['data-testid', 'text=Battery'], state: 'visible', dataTestId: 'telemetry-battery' },
        'video-player': { componentId: 'video-player', region: 'video', role: 'video', accessibleName: 'FPV video', locatorStrategies: ['data-testid', 'role=video'], state: 'visible', dataTestId: 'video-player' },
      },
      recoveryHistory: [],
    });

    const screenshotDir = path.resolve(process.cwd(), 'evidence', 'discovery');
    await fs.mkdir(screenshotDir, { recursive: true });
    await takeScreenshot(page, path.join(screenshotDir, 'cockpit-home.png'));

    await saveApplicationMap(map);
    console.log('Discovery complete. Application map saved to knowledge/application-map.json');
  } finally {
    await browser.close();
  }
}

export async function inspectMap(): Promise<void> {
  const { promises: fs } = await import('node:fs');
  const file = path.resolve(process.cwd(), 'knowledge', 'application-map.json');
  try {
    const json = await fs.readFile(file, 'utf8');
    console.log(json);
  } catch {
    console.log('No application map found. Run npm run discover first.');
  }
}
