/** A conservative, read-only health aggregator for local services.
 * Never treats 'configured' or HTTP 200 alone as complete agent readiness.
 * Never returns credentials, local paths, source record contents or raw responses.
 */

export function validateLoopbackBase(raw) {
  if (!raw || !raw.trim()) return null
  let url
  try { url = new URL(raw) } catch { throw new Error('Expected an absolute HTTP URL') }
  if (url.protocol !== 'http:') throw new Error('Only loopback HTTP endpoints are supported')
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing non-loopback service endpoint')
  }
  if (url.username || url.password || url.search || url.hash) throw new Error('No credentials, query or fragments in service base URLs')
  if (url.pathname !== '/' && url.pathname !== '/v1' && url.pathname !== '/v1/') {
    throw new Error('Service base URL must have no path or /v1')
  }
  return url.origin
}

export async function getJson(base, path, key = '', { timeoutMs = 2600, fetchFn = fetch } = {}) {
  const headers = { accept: 'application/json' }
  if (key) headers.authorization = `Bearer ${key}`
  try {
    const r = await fetchFn(base + path, { headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, data: null }
    const chunks = []
    let bytes = 0
    for await (const chunk of r.body) {
      bytes += chunk.length
      if (bytes > 65_536) return { ok: false, error: 'Response too large', data: null }
      chunks.push(chunk)
    }
    const text = Buffer.concat(chunks).toString('utf8')
    const data = JSON.parse(text)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response shape')
    return { ok: true, error: null, data }
  } catch (e) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'Timed out' : 'Unreachable or invalid JSON', data: null }
  }
}

function simple(state, detail) { return { state, detail } }
function source(ok, error = null) { return { ok, error } }

export async function collectConnectedStatus(config, now = new Date(), { fetchFn = fetch } = {}) {
  const endpoints = ['gateway', 'flint', 'missionControl']
  const resolved = {}
  for (const name of endpoints) {
    try { resolved[name] = validateLoopbackBase(config[name] ?? '') }
    catch { resolved[name] = null }
  }
  const services = {
    core: simple('running', 'Starter HTTP service responding'),
    gateway: simple(resolved.gateway ? 'checking' : 'unconfigured', resolved.gateway ? 'Checking configured service' : 'No gateway URL configured'),
    flint: simple(resolved.flint ? 'checking' : 'unconfigured', resolved.flint ? 'Checking configured service' : 'No inference URL configured'),
    missionControl: simple(resolved.missionControl ? 'checking' : 'unconfigured', resolved.missionControl ? 'Checking configured service' : 'No Mission Control URL configured'),
    web: simple('capability', 'Capability only; no web backend in starter'),
  }
  const mc = { agentsWorking: null, agentsTotal: null, tasksReported: null, recentActivity: null, verifiedBriefings: null, sources: null }
  const jobs = []

  if (resolved.gateway) jobs.push((async () => {
    const [health, models] = await Promise.all([
      getJson(resolved.gateway, '/health', '', { fetchFn }),
      getJson(resolved.gateway, '/v1/models', config.gatewayKey ?? '', { fetchFn }),
    ])
    const modelArr = models.data?.data
    const hasModel = Array.isArray(modelArr) && modelArr.length > 0
    services.gateway = !health.ok && !models.ok
      ? simple('unavailable', `Health ${health.error}; models ${models.error}`)
      : health.ok && models.ok && hasModel
        ? simple('running', 'Gateway and model listing responding')
        : simple('degraded', models.ok && !hasModel ? 'No model listed' : `Partial response (${health.error ?? models.error ?? 'unknown'})`)
  })())

  if (resolved.flint) jobs.push((async () => {
    const models = await getJson(resolved.flint, '/v1/models', '', { fetchFn })
    const hasModel = Array.isArray(models.data?.data) && models.data.data.length > 0
    services.flint = models.ok && hasModel ? simple('running', 'Inference model available')
      : models.ok ? simple('degraded', 'Model listing is empty or invalid')
      : simple('unavailable', models.error)
  })())

  if (resolved.missionControl) jobs.push((async () => {
    const names = ['health', 'overview', 'agents', 'tasks', 'activity', 'briefings']
    const paths = ['/api/v1/health', '/api/v1/overview', '/api/v1/agent-registry', '/api/v1/tasks', '/api/v1/activity', '/api/v1/briefings']
    const results = await Promise.all(paths.map(path => getJson(resolved.missionControl, path, '', { fetchFn })))
    const checks = Object.fromEntries(names.map((n, i) => [n, source(results[i].ok, results[i].error)]))
    const [h, overview, agents, tasks, activity, briefings] = results

    if (h.ok && h.data?.service?.status !== 'ok') checks.health = source(false, 'Service status not ok')
    if (h.ok && h.data?.kanban?.status === 'error') checks.tasks = source(false, 'Kanban health error')
    if (h.ok && h.data?.activity?.status === 'error') checks.activity = source(false, 'Activity health error')
    if (overview.ok && overview.data?.kanban?.status === 'error') checks.overview = source(false, 'Overview Kanban error')
    if (overview.ok && overview.data?.activity?.status === 'error') checks.overview = source(false, 'Overview activity error')
    mc.sources = checks
    if (agents.ok && Array.isArray(agents.data?.agents)) {
      mc.agentsTotal = agents.data.agents.length
      mc.agentsWorking = agents.data.agents.filter(x => x?.work_state === 'working').length
    }
    if (tasks.ok && Array.isArray(tasks.data?.tasks)) mc.tasksReported = tasks.data.tasks.length
    if (activity.ok && Array.isArray(activity.data?.events)) mc.recentActivity = activity.data.events[0]?.event_type ?? null
    if (briefings.ok && Array.isArray(briefings.data?.briefings)) {
      mc.verifiedBriefings = briefings.data.briefings.filter(b => b?.state === 'accepted').length
    } else if (briefings.ok && briefings.data?.enabled === false) mc.verifiedBriefings = 0

    services.missionControl = !checks.health.ok
      ? simple('unavailable', checks.health.error ?? 'Health endpoint unavailable')
      : Object.values(checks).some(x => !x.ok)
        ? simple('degraded', 'One or more read-only sources unavailable')
        : simple('running', 'All six sources responding')
  })())

  await Promise.all(jobs)
  return { mode: 'connected', simulated: false, verifiedAt: now.toISOString(), services, missionControl: mc }
}
