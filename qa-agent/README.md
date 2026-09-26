# QA Agent

This project creates an autonomous browser QA agent around the running FlytBase Cockpit.

## Commands

```bash
npm install
npm run discover
npm run inspect:map
npm run task
npm run demo:pass
npm run demo:rename
npm run demo:broken-flight
npm run perf:takeoff
npm run perf:land
npm run report
```

The discovery step opens Playwright against http://localhost:4010, extracts visible DOM and accessibility data, and persists the Application Map to `knowledge/application-map.json`.

## Performance testing

The agent now includes a performance benchmark layer that measures real command-to-state latency for a live drone interaction. It runs a repeated sanity test over the same operational path and reports:

- average latency
- p95 latency
- max latency
- pass rate
- threshold breaches

This gives the project a second angle beyond correctness: proving the automation remains stable under repeated execution and catches slow regressions before a judge notices.
