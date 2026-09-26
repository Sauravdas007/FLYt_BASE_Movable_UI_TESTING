export interface PerformanceSample {
  label: string;
  durationMs: number;
  passed: boolean;
  state: string;
  thresholdMs: number;
}

export interface PerformanceSummary {
  iterations: number;
  passRate: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
  thresholdBreaches: number;
}

export function summarizePerformanceSamples(samples: PerformanceSample[]): PerformanceSummary {
  if (samples.length === 0) {
    return {
      iterations: 0,
      passRate: 0,
      averageMs: 0,
      p95Ms: 0,
      maxMs: 0,
      thresholdBreaches: 0,
    };
  }

  const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const averageMs = Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
  const p95Index = Math.max(0, Math.ceil(0.95 * durations.length) - 1);
  const p95Ms = durations[p95Index] ?? 0;
  const maxMs = durations[durations.length - 1] ?? 0;
  const passRate = samples.filter((s) => s.passed).length / samples.length;
  const thresholdBreaches = samples.filter((s) => s.durationMs > s.thresholdMs).length;

  return {
    iterations: samples.length,
    passRate,
    averageMs,
    p95Ms,
    maxMs,
    thresholdBreaches,
  };
}

export interface PerformanceBenchmarkResult {
  label: string;
  iterations: number;
  thresholdMs: number;
  summary: PerformanceSummary;
  samples: PerformanceSample[];
}

export async function runPerformanceBenchmark(
  label: string,
  thresholdMs: number,
  fn: () => Promise<boolean>,
  iterations = 10,
): Promise<PerformanceBenchmarkResult> {
  const samples: PerformanceSample[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const started = Date.now();
    const passed = await fn();
    const durationMs = Date.now() - started;
    samples.push({
      label,
      durationMs,
      passed,
      state: passed ? 'pass' : 'fail',
      thresholdMs,
    });
  }

  return {
    label,
    iterations,
    thresholdMs,
    summary: summarizePerformanceSamples(samples),
    samples,
  };
}
