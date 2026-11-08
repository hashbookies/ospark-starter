import test from 'node:test'
import assert from 'node:assert/strict'
import { demoSnapshot } from '../packages/demo-data/scenarios.mjs'
import { collectConnectedStatus, validateLoopbackBase, getJson } from '../packages/system-health/health.mjs'

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('demo clearly labels simulated data and never fabricates accepted evidence', () => {
  const result = demoSnapshot('healthy', new Date('2026-11-03T00:00:00Z'))
  assert.equal(result.simulated, true)
  assert.equal(result.mode, 'demo')
  assert.equal(result.services.web.state, 'capability')
  assert.equal(result.services.missionControl.state, 'running')
  assert.equal(result.verifiedAt, '2026-11-03T00:00:00.000Z')
})

test('a missing Kanban source degrades only Mission Control in demo mode', () => {
  const result = demoSnapshot('degraded')
  assert.equal(result.services.core.state, 'running')
  assert.equal(result.services.missionControl.state, 'degraded')
  assert.equal(result.missionControl.sources.tasks.ok, false)
  assert.equal(result.missionControl.tasksReported, null)
})

test('inference outage is not confused with gateway health', () => {
  const result = demoSnapshot('inference')
  assert.equal(result.services.flint.state, 'unavailable')
  assert.equal(result.services.gateway.state, 'running')
})

test('connected mode never marks unconfigured services green', async () => {
  const result = await collectConnectedStatus({ gateway: '', flint: '', missionControl: '' })
  assert.equal(result.simulated, false)
  assert.equal(result.services.core.state, 'running')
  assert.equal(result.services.gateway.state, 'unconfigured')
  assert.equal(result.services.flint.state, 'unconfigured')
  assert.equal(result.services.missionControl.state, 'unconfigured')
  assert.equal(result.services.web.state, 'capability')
})

test('service URLs are loopback only; no credential or path injection', () => {
  assert.equal(validateLoopbackBase('http://127.0.0.1:8642'), 'http://127.0.0.1:8642')
  assert.equal(validateLoopbackBase('http://localhost:8080'), 'http://localhost:8080')
  for (const url of [
    'http://8.8.8.8:8642', 'http://192.168.1.4:8080',
    'https://127.0.0.1:8642', 'http://user:secret@127.0.0.1:8642',
    'http://127.0.0.1:8080/private', 'file:///etc/passwd',
  ]) assert.throws(() => validateLoopbackBase(url), url)
})

test('connected mode uses bounded allowlisted read-only health probes', async () => {
  const seen = []
  const fetchFn = async (url, options) => {
    seen.push({ url, method: options.method ?? 'GET' })
    if (url.endsWith('/v1/models')) return reply({ data: [{ id: 'local-model' }] })
    if (url.endsWith('/health')) return reply({ service: { status: 'ok' }, kanban: { status: 'ok' }, activity: { status: 'ok' } })
    if (url.endsWith('/overview')) return reply({ kanban: { status: 'ok' }, activity: { status: 'ok' } })
    if (url.endsWith('/agent-registry')) return reply({ agents: [{ work_state: 'working', title: 'private never returned' }] })
    if (url.endsWith('/tasks')) return reply({ tasks: [{ title: 'private never returned' }] })
    if (url.endsWith('/activity')) return reply({ events: [{ event_type: 'agent_end', secret: 'not returned' }] })
    if (url.endsWith('/briefings')) return reply({ enabled: true, briefings: [{ state: 'accepted', report: 'private never returned' }] })
    return reply({}, 404)
  }
  const status = await collectConnectedStatus({ gateway: 'http://127.0.0.1:8642', flint: 'http://127.0.0.1:8081', missionControl: 'http://127.0.0.1:19465' }, new Date(), { fetchFn })
  assert.equal(status.services.gateway.state, 'running')
  assert.equal(status.services.flint.state, 'running')
  assert.equal(status.services.missionControl.state, 'running')
  assert.equal(status.missionControl.tasksReported, 1)
  assert.equal(status.missionControl.agentsWorking, 1)
  assert.equal(status.missionControl.verifiedBriefings, 1)
  assert.ok(seen.every(x => x.method === 'GET'))
  assert.ok(!JSON.stringify(status).includes('private never returned'))
})

test('a degraded Mission Control result lists the failed source truthfully', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/api/v1/tasks')) return reply({ error: 'source_unavailable' }, 503)
    if (url.endsWith('/api/v1/health')) return reply({ service: { status: 'ok' }, kanban: { status: 'error' } })
    if (url.endsWith('/api/v1/overview')) return reply({ kanban: { status: 'error' }, activity: { status: 'ok' } })
    if (url.endsWith('/api/v1/briefings')) return reply({ enabled: false, briefings: [] })
    return reply({ agents: [], events: [] })
  }
  const data = await collectConnectedStatus({ missionControl: 'http://127.0.0.1:19465' }, new Date(), { fetchFn })
  assert.equal(data.services.missionControl.state, 'degraded')
  assert.equal(data.missionControl.sources.tasks.ok, false)
  assert.equal(data.missionControl.tasksReported, null)
})
