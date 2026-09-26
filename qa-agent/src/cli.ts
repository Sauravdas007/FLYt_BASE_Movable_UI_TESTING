#!/usr/bin/env node
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

import { runDiscovery, inspectMap } from './discovery/discovery-agent.ts';
import { runPhaseTwoDemo } from './executor/test-runner.ts';
import { runRecoveryDemo } from './executor/recovery-runner.ts';
import { runDemoScenario, runEndToEndTask, runMissionFlow } from './executor/task-runner.ts';
import { BrowserManager } from './browser/browser-manager.ts';
import { runPerformanceBenchmark } from './performance/performance-runner.ts';

const [, , command] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case 'discover':
      await runDiscovery();
      break;
    case 'inspect:map':
      await inspectMap();
      break;
    case 'phase2':
      await runPhaseTwoDemo();
      break;
    case 'recovery':
      await runRecoveryDemo();
      break;
    case 'task': {
      const browser = new BrowserManager();
      const page = await browser.launch('http://localhost:4010');
      try {
        const result = await runMissionFlow(page, 'drone-1');
        console.log(JSON.stringify(result, null, 2));
      } finally {
        await browser.close();
      }
      break;
    }
    case 'demo:pass': {
      const browser = new BrowserManager();
      const page = await browser.launch('http://localhost:4010');
      try {
        const result = await runDemoScenario(page, 'pass');
        console.log(JSON.stringify({ ...result, summary: `LLM calls: ${result.llmCalls}` }, null, 2));
      } finally {
        await browser.close();
      }
      break;
    }
    case 'demo:rename': {
      const browser = new BrowserManager();
      const page = await browser.launch('http://localhost:4010');
      try {
        const result = await runDemoScenario(page, 'rename');
        console.log(JSON.stringify({ ...result, summary: `LLM calls: ${result.llmCalls}` }, null, 2));
      } finally {
        await browser.close();
      }
      break;
    }
    case 'demo:broken-flight': {
      const browser = new BrowserManager();
      const page = await browser.launch('http://localhost:4010');
      try {
        const result = await runDemoScenario(page, 'broken-flight');
        console.log(JSON.stringify({ ...result, summary: `LLM calls: ${result.llmCalls}` }, null, 2));
      } finally {
        await browser.close();
      }
      break;
    }
    case 'perf:takeoff': {
      const browser = new BrowserManager();
      const page = await browser.launch('http://localhost:4010');
      try {
        const result = await runPerformanceBenchmark('takeoff', 2000, async () => {
          const mission = await runEndToEndTask(page, 'start_flight', 'in_flight', 'Take off');
          return mission.verificationPassed;
        }, 5);
        console.log(JSON.stringify(result, null, 2));
      } finally {
        await browser.close();
      }
      break;
    }
    case 'perf:land': {
      const browser = new BrowserManager();
      const page = await browser.launch('http://localhost:4010');
      try {
        const result = await runPerformanceBenchmark('land', 2500, async () => {
          const mission = await runEndToEndTask(page, 'land', 'standby', 'Land');
          return mission.verificationPassed;
        }, 5);
        console.log(JSON.stringify(result, null, 2));
      } finally {
        await browser.close();
      }
      break;
    }
    case 'report':
      console.log('Report generation is not implemented yet. Run discovery first.');
      break;
    default:
      console.log('Usage: npm run discover | npm run inspect:map | npm run phase2 | npm run recovery | npm run task | npm run demo:pass | npm run demo:rename | npm run demo:broken-flight | npm run perf:takeoff | npm run perf:land | npm run report');
      break;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
