import type { ElementObservation } from '../browser/observation.ts';
import type { Region } from '../application/schema.ts';

export interface PageInventory {
  pageTitle: string;
  url: string;
  regions: Record<Region, { label: string; count: number; elements: ElementObservation[] }>;
  elements: ElementObservation[];
  buttons: ElementObservation[];
  links: ElementObservation[];
  testIds: string[];
  headingText: string[];
  ariaNames: string[];
}

export function analyzeDom(elements: ElementObservation[]): PageInventory {
  const regionDefaults: Record<Region, { label: string; count: number; elements: ElementObservation[] }> = {
    global_shell: { label: 'Global shell', count: 0, elements: [] },
    map: { label: 'Map', count: 0, elements: [] },
    video: { label: 'Video', count: 0, elements: [] },
    dock_video: { label: 'Dock video', count: 0, elements: [] },
    mission_controls: { label: 'Mission controls', count: 0, elements: [] },
    telemetry: { label: 'Telemetry', count: 0, elements: [] },
    side_toolbar: { label: 'Side toolbar', count: 0, elements: [] },
  };

  for (const element of elements) {
    const region = inferRegion(element);
    regionDefaults[region].elements.push(element);
    regionDefaults[region].count += 1;
  }

  const buttons = elements.filter((el) => el.tagName === 'button' || el.role === 'button');
  const links = elements.filter((el) => el.tagName === 'a');
  const testIds = Array.from(new Set(elements.map((el) => el.testId).filter((v): v is string => Boolean(v))));
  const headingText = elements.filter((el) => /^h[1-6]$/.test(el.tagName)).map((el) => el.name || el.text).filter(Boolean);
  const ariaNames = elements.map((el) => el.ariaLabel || el.name).filter((v) => Boolean(v));

  return {
    pageTitle: 'FlytBase Cockpit',
    url: 'http://localhost:4010',
    regions: regionDefaults,
    elements,
    buttons,
    links,
    testIds,
    headingText,
    ariaNames,
  };
}

function inferRegion(element: ElementObservation): Region {
  const combined = `${element.role} ${element.name} ${element.text}`.toLowerCase();
  if (combined.includes('map')) return 'map';
  if (combined.includes('video')) return 'video';
  if (combined.includes('telemetry') || combined.includes('battery') || combined.includes('altitude')) return 'telemetry';
  if (combined.includes('dock')) return 'dock_video';
  if (combined.includes('take off') || combined.includes('land')) return 'mission_controls';
  if (combined.includes('device') || combined.includes('drone')) return 'side_toolbar';
  return 'global_shell';
}
