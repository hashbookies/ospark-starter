export const DEFAULT_SCENARIO = 'healthy'
export const SCENARIO_NAMES = Object.freeze({
  healthy: 'All systems nominal',
  degraded: 'Mission Control degraded',
  inference: 'Flint unavailable',
  offline: 'All dependencies unavailable',
})

function source(ok, error = null) { return { ok, error } }

export function demoSnapshot(scenario = DEFAULT_SCENARIO, time = new Date()) {
  const chosen = Object.hasOwn(SCENARIO_NAMES, scenario) ? scenario : DEFAULT_SCENARIO
  const mcDegraded = chosen === 'degraded' || chosen === 'offline'
  const flintDown = chosen === 'inference' || chosen === 'offline'
  const gatewayDown = chosen === 'offline'
  const missionControlSources = {
    health: source(!gatewayDown),
    overview: source(!mcDegraded, mcDegraded ? 'source temporarily unavailable' : null),
    agents: source(true),
    tasks: source(!mcDegraded, mcDegraded ? 'HTTP 503 from Kanban source' : null),
    activity: source(true),
    briefings: source(true),
  }
  return {
    mode: 'demo',
    simulated: true,
    verifiedAt: time.toISOString(),
    scenario: chosen,
    services: {
      core: { state: 'running', detail: 'Local starter responding' },
      gateway: { state: gatewayDown ? 'unavailable' : 'running', detail: gatewayDown ? 'Simulated gateway outage' : 'Simulated gateway' },
      flint: { state: flintDown ? 'unavailable' : 'running', detail: flintDown ? 'Simulated inference outage' : 'Simulated local inference' },
      missionControl: { state: gatewayDown ? 'unavailable' : mcDegraded ? 'degraded' : 'running', detail: 'Simulated read-only adapter' },
      web: { state: 'capability', detail: 'Not a verified service' },
    },
    missionControl: {
      agentsWorking: 0,
      agentsTotal: 6,
      tasksReported: mcDegraded ? null : 10,
      recentActivity: 'agent_end',
      verifiedBriefings: 1,
      sources: missionControlSources,
    },
  }
}

export const SAMPLE_REVIEW = Object.freeze({
  title: 'Visitor-market evidence brief',
  state: 'ACCEPTED (SIMULATED)',
  task: 'demo_task_001',
  outputs: [
    { name: '10-findings.md', sha: 'demo-example-not-a-real-hash' },
    { name: '20-evidence.json', sha: 'demo-example-not-a-real-hash' },
  ],
  limitations: 'Illustrative only: no real agent, source files, or acceptance decision.',
})
