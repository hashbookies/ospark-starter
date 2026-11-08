import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { demoSnapshot, SAMPLE_REVIEW, SCENARIO_NAMES } from '../demo-data/scenarios.mjs'
import { collectConnectedStatus } from '../system-health/health.mjs'
import { chatOnce } from './chat.mjs'

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
})
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
}
const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { ...SEC_HEADERS, 'Content-Type': type })
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body)
}

export function loadConfig() {
  return {
    gateway: process.env.HERMES_BASE_URL || '',
    flint: process.env.FLINT_BASE_URL || '',
    missionControl: process.env.MISSION_CONTROL_BASE_URL || '',
    gatewayKey: process.env.HERMES_API_KEY || '',
    allowChat: process.env.ALLOW_LOCAL_CHAT === '1',
    modelUrl: process.env.MODEL_BASE_URL || '',
    modelId: process.env.MODEL_ID || '',
    modelKey: process.env.MODEL_API_KEY || '',
  }
}

async function receiveJson(req) {
  let size = 0
  let body = ''
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8192) throw new Error('Request too large')
    body += chunk.toString('utf8')
  }
  try { return JSON.parse(body) } catch { throw new Error('Invalid JSON') }
}

export function buildHandler({ root, mode, config = loadConfig() }) {
  const publicRoot = resolve(root, 'apps', 'spark-ui', 'public')
  let cache = null
  let cacheAt = 0
  let inflight = null
  async function connectedStatus() {
    if (cache && Date.now() - cacheAt < 8000) return cache
    if (!inflight) inflight = collectConnectedStatus(config).then(value => {
      cache = value; cacheAt = Date.now(); return value
    }).finally(() => { inflight = null })
    return inflight
  }

  return async function handler(req, res) {
    try {
      const path = new URL(req.url || '/', 'http://127.0.0.1').pathname
      if (req.method === 'GET' && path === '/api/health') {
        const result = mode === 'demo'
          ? demoSnapshot(new URL(req.url, 'http://127.0.0.1').searchParams.get('scenario') ?? 'healthy')
          : await connectedStatus()
        return send(res, 200, result)
      }
      if (req.method === 'GET' && path === '/api/review') {
        return send(res, 200, mode === 'demo'
          ? { simulated: true, review: SAMPLE_REVIEW }
          : { simulated: false, review: null, reason: 'Review data is not exposed by this starter' })
      }
      if (req.method === 'GET' && path === '/api/capabilities') {
        return send(res, 200, { mode, simulated: mode === 'demo', chatEnabled: mode === 'connected' && config.allowChat, scenarios: mode === 'demo' ? SCENARIO_NAMES : {} })
      }
      if (req.method === 'POST' && path === '/api/chat') {
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(res, 415, { error: 'JSON required' })
        const origin = req.headers.origin
        // Defend the otherwise unauthenticated local-chat endpoint against malicious webpages.
        const expectedOrigin = `http://${req.headers.host || ''}`
        if (!origin || origin !== expectedOrigin || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(expectedOrigin)) {
          return send(res, 403, { error: 'Same-origin browser request required' })
        }
        const body = await receiveJson(req)
        if (mode !== 'connected') return send(res, 403, { error: 'Demo chat is simulated in the browser' })
        const result = await chatOnce(config, body?.text)
        return send(res, result.code, result.ok ? { reply: result.reply } : { error: result.error })
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' })
      if (path.startsWith('/api/')) return send(res, 404, { error: 'Not found' })
      if (/\0|\\|%2e|%2f|%5c/i.test(req.url || '') || path.split('/').some(p => p.startsWith('.'))) {
        return send(res, 403, { error: 'Forbidden path' })
      }
      const filePath = resolve(publicRoot, '.' + (path === '/' ? '/index.html' : path))
      if (filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) return send(res, 403, { error: 'Forbidden path' })
      const info = await stat(filePath).catch(() => null)
      if (!info?.isFile()) return send(res, 404, { error: 'Not found' })
      const type = MIME[extname(filePath)]
      if (!type) return send(res, 403, { error: 'Unsupported content type' })
      const contents = await readFile(filePath)
      res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': type })
      res.end(req.method === 'HEAD' ? undefined : contents)
    } catch (e) {
      // Don't reflect raw file paths or upstream errors into public responses.
      if (e?.message === 'Invalid JSON' || e?.message === 'Request too large') return send(res, 400, { error: e.message })
      return send(res, 500, { error: 'Internal starter error' })
    }
  }
}

export function startServer({ root, mode }) {
  const port = Number(process.env.PORT || 4173)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be 1024–65535')
  const server = createServer(buildHandler({ root, mode }))
  server.listen(port, '127.0.0.1', () => {
    console.log(`\nOSPARK Starter v0.1.0 — ${mode.toUpperCase()} mode`)
    console.log(`Open http://127.0.0.1:${port}`)
    console.log('Loopback only. No writes, agent dispatch, or filesystem tools.')
    if (mode === 'demo') console.log('All statuses and review records are labelled simulated.')
    if (mode === 'connected') console.log('Configured local endpoints only. Unconfigured services stay UNKNOWN.')
    console.log('Press Ctrl+C to stop.\n')
  })
  return server
}
