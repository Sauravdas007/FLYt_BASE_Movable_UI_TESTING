import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizePerformanceSamples } from '../src/performance/performance-runner.ts';

describe('summarizePerformanceSamples', () => {
  it('computes average, p95, pass rate and threshold breach flags', () => {
    const summary = summarizePerformanceSamples([
      { label: 'takeoff', durationMs: 1200, passed: true, state: 'in_flight', thresholdMs: 2000 },
      { label: 'takeoff', durationMs: 1900, passed: true, state: 'in_flight', thresholdMs: 2000 },
      { label: 'takeoff', durationMs: 3500, passed: false, state: 'standby', thresholdMs: 2000 },
      { label: 'land', durationMs: 1600, passed: true, state: 'standby', thresholdMs: 2500 },
    ]);

    assert.equal(summary.iterations, 4);
    assert.equal(summary.passRate, 0.75);
    assert.equal(summary.averageMs, 2050);
    assert.equal(summary.p95Ms, 3500);
    assert.equal(summary.maxMs, 3500);
    assert.equal(summary.thresholdBreaches, 1);
  });
});
