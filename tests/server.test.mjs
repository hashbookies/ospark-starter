import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildHandler } from '../packages/gateway-adapter/server.mjs'
import { chatOnce } from '../packages/gateway-adapter/chat.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function withServer(mode, fn) {
  const server = createServer(buildHandler({ root, mode, config: { gateway:'', flint:'', missionControl:'', allowChat:false } }))
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  try { return await fn(`http://127.0.0.1:${server.address().port}`) }
  finally { await new Promise(r => server.close(r)) }
}

test('zero-dependency demo serves HTML and CSP', () => withServer('demo', async url => {
  const response = await fetch(url)
  const html = await response.text()
  assert.equal(response.status, 200)
  assert.match(html, /O\.S\.P\.A\.R\.K/)
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/)
  assert.doesNotMatch(html, /<script[^>]+https:/)
}))

test('demo API includes clear simulated marker and health scenario', () => withServer('demo', async url => {
  const response = await fetch(url + '/api/health?scenario=degraded')
  const body = await response.json()
  assert.equal(body.simulated, true)
  assert.equal(body.services.missionControl.state, 'degraded')
  assert.equal(body.missionControl.sources.tasks.ok, false)
}))

test('connected mode does not invent running dependencies', () => withServer('connected', async url => {
  const response = await fetch(url + '/api/health')
  const body = await response.json()
  assert.equal(body.simulated, false)
  assert.equal(body.services.gateway.state, 'unconfigured')
  assert.equal(body.services.missionControl.state, 'unconfigured')
}))

test('real review records are never exposed in the starter', () => withServer('connected', async url => {
  const r = await fetch(url + '/api/review')
  const body = await r.json()
  assert.equal(body.review, null)
}))

test('demo review evidence is marked synthetic and cannot assert real acceptance', () => withServer('demo', async url => {
  const r = await fetch(url + '/api/review')
  const body = await r.json()
  assert.equal(body.simulated, true)
  assert.match(body.review.state, /SIMULATED/)
  assert.match(body.review.outputs[0].sha, /not-a-real-hash/)
}))

test('local chat is disabled by default and refuses cross-origin requests', () => withServer('connected', async url => {
  const bad = await fetch(url + '/api/chat', { method:'POST', headers: { 'content-type':'application/json', origin:'https://malicious.example' }, body:JSON.stringify({text:'hello'}) })
  assert.equal(bad.status, 403)
  const disabled = await fetch(url + '/api/chat', { method:'POST', headers: { 'content-type':'application/json', origin:url }, body:JSON.stringify({text:'hello'}) })
  assert.equal(disabled.status, 403)
}))

test('model chat cannot make upstream requests while disabled', async () => {
  let networkCalls = 0
  const result = await chatOnce({ allowChat: false }, 'hello', { fetchFn: () => { networkCalls++; throw Error('Should never run') } })
  assert.equal(result.ok, false)
  assert.equal(networkCalls, 0)
})

test('tool-free completion request is explicit and tool calls are refused', async () => {
  const result = await chatOnce({allowChat:true,modelUrl:'http://127.0.0.1:8081',modelId:'test'}, 'Hi', {
    fetchFn: async (_url, opts) => {
      const body = JSON.parse(opts.body)
      assert.equal(body.tool_choice, 'none')
      assert.equal(body.stream, false)
      assert.deepEqual(body.messages.map(x=>x.role), ['system','user'])
      return new Response(JSON.stringify({choices:[{message:{content:'Hello!'}}]}), {status:200})
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.reply, 'Hello!')
  const bad = await chatOnce({allowChat:true,modelUrl:'http://127.0.0.1:8081',modelId:'test'}, 'Hi', {
    fetchFn: async () => new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'x'}]}}]}), {status:200}),
  })
  assert.equal(bad.ok, false)
})

test('server refuses unsupported HTTP paths and methods', () => withServer('demo', async url => {
  const missing = await fetch(url + '/secret.env')
  assert.equal(missing.status, 404)
  const forbidden = await fetch(url + '/.env')
  assert.equal(forbidden.status, 403)
  const method = await fetch(url + '/api/health', { method: 'DELETE' })
  assert.equal(method.status, 405)
}))
