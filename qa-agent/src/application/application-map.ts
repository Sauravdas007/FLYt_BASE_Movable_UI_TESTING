import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ApplicationMapSchema, type ApplicationMap, type RecoveryHistoryEntry } from './schema.ts';

const APP_MAP_PATH = path.resolve(process.cwd(), 'knowledge', 'application-map.json');

export async function loadApplicationMap(): Promise<ApplicationMap | null> {
  try {
    const raw = await fs.readFile(APP_MAP_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return ApplicationMapSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function saveApplicationMap(map: ApplicationMap): Promise<void> {
  const validated = ApplicationMapSchema.parse(map);
  await fs.mkdir(path.dirname(APP_MAP_PATH), { recursive: true });
  await fs.writeFile(APP_MAP_PATH, JSON.stringify(validated, null, 2), 'utf8');
}

export async function recordRecoveryHistory(entry: RecoveryHistoryEntry): Promise<void> {
  const map = (await loadApplicationMap()) ?? {
    generatedAt: new Date().toISOString(),
    app: 'FlytBase Cockpit',
    url: 'http://localhost:4010',
    regions: {},
    entities: [],
    intents: [],
    components: {},
    recoveryHistory: [],
  } as ApplicationMap;

  const nextMap: ApplicationMap = {
    ...map,
    generatedAt: new Date().toISOString(),
    recoveryHistory: [...map.recoveryHistory.filter((item) => !(item.intentId === entry.intentId && item.originalLocator === entry.originalLocator)), entry],
  };

  await saveApplicationMap(nextMap);
}

export async function prettyPrintApplicationMap(): Promise<void> {
  const map = await loadApplicationMap();
  if (!map) {
    console.log('No application map found yet. Run npm run discover first.');
    return;
  }
  console.log(JSON.stringify(map, null, 2));
}
