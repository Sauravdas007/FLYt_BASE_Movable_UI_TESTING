import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface RecoveryMemoryEntry {
  originalLocator: string;
  recoveredLocator: string;
  confidence: number;
  usedAt: string;
  llmInvoked: boolean;
}

export class MemoryStore {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.resolve(process.cwd(), 'knowledge', 'recovery-memory.json');
  }

  async load(): Promise<RecoveryMemoryEntry[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as RecoveryMemoryEntry[];
    } catch {
      return [];
    }
  }

  async save(entries: RecoveryMemoryEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(entries, null, 2), 'utf8');
  }
}
