// OSPARK Starter: self-contained browser UI, original demonstration code.
// No frameworks, external fonts, cloud calls, microphone or device permissions.
const $ = (id) => document.getElementById(id)
const ui = {
  app: $('app'), canvas: $('cosmos'), phase: $('phase-label'), mode: $('mode-chip'),
  status: $('service-list'), verified: $('verified-at'), errors: $('health-errors'),
  errorList: $('error-list'), mission: $('mc-state'), metrics: $('mc-metrics'),
  briefings: $('briefing-count'), briefText: $('briefing-detail'),
  scenarioWrapper: $('scenario-control'), scenario: $('scenario'),
  transcript: $('transcript'), prompt: $('prompt'), send: $('send'),
  hint: $('hint'), review: $('review-dialog'), reviewContent: $('review-content'),
  signal: $('signal-fill'), signalNumber: $('signal-number'), boot: $('boot'), bars: $('progress-bars'),
}
let mode = 'demo'
let chatEnabled = false
let currentSnapshot = null
let lastVerifiedMs = 0
let hasHealthFailure = false
let scenario = 'healthy'
let busy = false
let phase = 'standby'
const stateNames = { running: 'RUNNING', degraded: 'DEGRADED', unavailable: 'UNAVAILABLE', unconfigured: 'UNCONFIGURED', checking: 'CHECKING', stale: 'STALE', capability: 'CAPABILITY', unknown: 'UNKNOWN' }
const serviceNames = [
  ['core', 'OSPARK CORE'], ['gateway', 'HERMES GATEWAY'],
  ['flint', 'FLINT INFERENCE'], ['missionControl', 'MISSION CONTROL'], ['web', 'WEB'],
]
const hints = [
  '“Spark, explain the system architecture.”',
  '“Spark, what does degraded mean?”',
  '“Spark, describe owner approval gates.”',
  '“Spark, show me a delegation review.”',
]

function setPhase(value) {
  phase = value
  ui.app.dataset.phase = value
  ui.phase.textContent = ({ standby: 'STANDBY · TEXT MODE', processing: 'PROCESSING', responding: 'RESPONDING', tooling: 'ACCESSING SYSTEMS' })[value] ?? value.toUpperCase()
}

function statusLabel(name, rawState, stale) {
  const v = stale && name !== 'web' ? 'stale' : (rawState || 'unknown')
  return { code: v, text: stateNames[v] || 'UNKNOWN' }
}

function renderHealth(snapshot) {
  currentSnapshot = snapshot
  if (snapshot?.verifiedAt) lastVerifiedMs = Date.parse(snapshot.verifiedAt) || Date.now()
  const stale = hasHealthFailure || !lastVerifiedMs || Date.now() - lastVerifiedMs > 48_000
  ui.status.replaceChildren()
  for (const [name, label] of serviceNames) {
    const info = snapshot?.services?.[name] || { state: 'unknown' }
    const value = statusLabel(name, info.state, stale)
    const row = document.createElement('div')
    row.className = 'status-row'
    row.title = info.detail || 'No verified reading'
    const title = document.createElement('span')
    title.textContent = label
    const status = document.createElement('span')
    status.className = 'status-value'
    status.dataset.state = value.code
    status.textContent = value.text
    row.append(title, status)
    ui.status.append(row)
  }
  ui.verified.textContent = lastVerifiedMs
    ? `${stale ? 'STALE SINCE' : 'VERIFIED'} ${new Date(lastVerifiedMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'NOT YET VERIFIED'
  ui.mode.textContent = mode === 'demo' ? 'DEMO MODE · SIMULATED DATA' : 'CONNECTED MODE · READ-ONLY HEALTH'
  const mc = snapshot?.missionControl || {}
  const mcState = stale ? 'stale' : snapshot?.services?.missionControl?.state || 'unknown'
  ui.mission.dataset.state = mcState
  ui.mission.textContent = stateNames[mcState] || 'UNKNOWN'
  const show = n => Number.isInteger(n) ? String(n) : '—'
  ui.metrics.replaceChildren()
  const data = [
    `${show(mc.agentsWorking)} of ${show(mc.agentsTotal)} agents working`,
    `${show(mc.tasksReported)} tasks reported`,
    `latest activity: ${mc.recentActivity || 'unavailable'}`,
  ]
  for (const line of data) {
    const row = document.createElement('span')
    row.textContent = line
    ui.metrics.append(row)
  }
  ui.briefings.textContent = show(mc.verifiedBriefings)
  ui.briefText.textContent = mode === 'demo'
    ? 'SIMULATED record. Open Delegation Reviews above to inspect an example acceptance record.'
    : 'Only aggregate counts are shown. No private report content is exposed.'
  const errors = Object.entries(mc.sources || {}).filter(([, v]) => !v?.ok)
  ui.errors.hidden = errors.length === 0
  ui.errors.querySelector('summary').textContent = `▸ MISSION CONTROL SOURCE ERRORS (${errors.length})`
  ui.errorList.replaceChildren()
  for (const [name, result] of errors) {
    const line = document.createElement('p')
    line.className = 'error-detail'
    line.textContent = `${name.toUpperCase()}: ${String(result?.error || 'unavailable').slice(0, 140)}`
    ui.errorList.append(line)
  }
}

async function refresh() {
  const url = '/api/health' + (mode === 'demo' ? `?scenario=${encodeURIComponent(scenario)}` : '')
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(14000) })
    if (!response.ok) throw Error('Health API unavailable')
    const data = await response.json()
    if (!data?.services || !data.verifiedAt) throw Error('Invalid health response')
    hasHealthFailure = false
    renderHealth(data)
  } catch {
    // Never advertise an unverified dependency as RUNNING after a failed poll.
    hasHealthFailure = true
    renderHealth(currentSnapshot)
    ui.verified.textContent = 'HEALTH CHECK FAILED · RETRYING'
  }
}

function addMessage(role, text) {
  const el = document.createElement('div')
  el.className = `message ${role}`
  const who = document.createElement('span')
  who.className = 'role'
  who.textContent = role === 'user' ? 'YOU' : 'SPARK'
  const content = document.createElement('span')
  content.className = 'content'
  content.textContent = text
  el.append(who, content)
  ui.transcript.append(el)
  while (ui.transcript.children.length > 8) ui.transcript.firstChild.remove()
  ui.transcript.scrollTop = ui.transcript.scrollHeight
}

function demoResponse(text) {
  const q = text.toLowerCase()
  if (/status|health|running|service/.test(q)) return 'SIMULATED RESPONSE: The left rail shows an illustrative local-first status model. Change the scenario selector to demonstrate outages and recovery. In connected mode these statuses come from bounded service probes.'
  if (/delegat|approval|acceptance|workflow|artifact/.test(q)) return 'SIMULATED RESPONSE: An agent proposes work, an owner reviews the scope, and execution occurs only within explicit permissions. Evidence and artifacts then return for acceptance. This starter has no dispatch or approval controls.'
  if (/architect|how|built|work|system/.test(q)) return 'SIMULATED RESPONSE: This public starter separates a lightweight browser interface, a loopback HTTP gateway adapter, and read-only health aggregation. A real agent runtime is an optional external dependency, not bundled in this demonstration.'
  if (/mission|degrad|error/.test(q)) return 'SIMULATED RESPONSE: DEGRADED means the health endpoint responded but one or more required sources did not. Use the source-error disclosure to see which reading failed. Status refreshes every 30 seconds.'
  return 'SIMULATED RESPONSE: I am the public OSPARK Starter demonstration, not a live AI model. Ask about the architecture, status, or delegation review. To connect real inference, follow docs/local-setup.md and enable an explicitly tool-free local model endpoint.'
}

async function submitMessage(input) {
  const text = input.trim()
  if (!text || busy) return
  busy = true
  ui.prompt.value = ''
  ui.send.disabled = true
  addMessage('user', text)
  ui.hint.textContent = mode === 'demo' ? 'SIMULATED RESPONSE · NO MODEL CALLED' : 'CONNECTED LOCAL MODEL · TOOLS DISABLED IN REQUEST'
  setPhase('processing')
  try {
    let reply
    if (mode === 'demo') {
      await new Promise(r => setTimeout(r, 540))
      reply = demoResponse(text)
    } else if (!chatEnabled) {
      reply = 'Local chat is disabled. Health monitoring is still connected. Read docs/local-setup.md to enable chat only with a plain model-serving endpoint that has no tools.'
    } else {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
      const body = await res.json()
      reply = res.ok ? body.reply : `Local model unavailable: ${body.error || 'unknown error'}`
    }
    setPhase('responding')
    addMessage('assistant', reply)
    await new Promise(r => setTimeout(r, 1150))
  } catch {
    addMessage('assistant', 'Local chat request failed. Check the local adapter configuration; no agent task was started.')
  } finally {
    busy = false
    ui.send.disabled = false
    setPhase('standby')
    ui.prompt.focus()
  }
}

async function showReview() {
  try {
    const res = await fetch('/api/review', { cache: 'no-store' })
    const result = await res.json()
    ui.reviewContent.replaceChildren()
    const p = (message, cls = '') => {
      const el = document.createElement('p')
      el.className = cls
      el.textContent = message
      ui.reviewContent.append(el)
    }
    if (!result.review) {
      p('No review records connected. This public starter intentionally does not expose private evidence, owner acceptance, or task mutations.')
    } else {
      const record = result.review
      p(`${record.title} · ${record.state}`, 'warning')
      p(`Example task: ${record.task}`)
      for (const output of record.outputs) p(`${output.name} · ${output.sha}`)
      p(record.limitations, 'warning')
    }
  } catch { ui.reviewContent.textContent = 'Read-only sample unavailable.' }
  ui.review.showModal()
}

// Canvas2D orbital visual: no WebGL dependency, shaders, external textures or media.
const canvas = ui.canvas
const ctx = canvas.getContext('2d', { alpha: false })
let width = 0, height = 0, scale = 1
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const particles = []
const random = (min, max) => min + Math.random() * (max - min)
for (let i = 0; i < 950; i++) particles.push({
  theta: random(0, Math.PI * 2), radius: random(.23, 1.32),
  velocity: random(-.00007, .00009), drift: random(.00004, .00017),
  size: random(.4, 3.0), alpha: random(.045, .52), tint: Math.random(),
})
function resize() {
  width = canvas.clientWidth
  height = canvas.clientHeight
  scale = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
}
window.addEventListener('resize', resize, { passive: true })
resize()

function drawRing(cx, cy, r, time, tint) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const ringPath = new Path2D()
  const steps = 280
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI * 2 * k / steps
    const jitter = 1.5 * Math.sin(13 * a + time * .0008) + 2.3 * Math.sin(29 * a - time * .0011) + .85 * Math.sin(76 * a + time * .0002)
    const R = r + jitter
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R
    if (!k) ringPath.moveTo(x, y)
    else ringPath.lineTo(x, y)
  }
  const grad = ctx.createLinearGradient(cx-r, cy-r, cx+r, cy+r)
  grad.addColorStop(0, '#e9ffff')
  grad.addColorStop(.20, tint)
  grad.addColorStop(.48, '#1c788e')
  grad.addColorStop(.69, tint)
  grad.addColorStop(.90, '#efffff')
  grad.addColorStop(1, '#4dffff')
  ctx.strokeStyle = grad
  ctx.shadowColor = tint
  ctx.shadowBlur = 32
  ctx.globalAlpha = .50
  ctx.lineWidth = 12
  ctx.stroke(ringPath)
  ctx.shadowBlur = 12
  ctx.globalAlpha = .95
  ctx.lineWidth = 3.8
  ctx.stroke(ringPath)
  ctx.shadowBlur = 0
  ctx.globalAlpha = .86
  ctx.lineWidth = 1.8
  ctx.strokeStyle = '#edffff'
  ctx.stroke(ringPath)
  ctx.restore()
}

function render(time) {
  const t = reduced ? 1000 : time
  const cx = width * .5, cy = height * (width < 760 ? .41 : .50)
  const r = width < 760
    ? Math.min(width * .33, height * .19, 190)
    : Math.min(width * .19, height * .305, 300)
  const tint = phase === 'processing' ? '#f2ab4e' : phase === 'responding' ? '#57ffe4' : phase === 'tooling' ? '#ba80fa' : '#5de6ee'
  ctx.fillStyle = '#020a0e'
  ctx.fillRect(0, 0, width, height)
  const halo = ctx.createRadialGradient(cx,cy,r*.15,cx,cy,r*1.80)
  halo.addColorStop(0,'rgba(8,56,68,.12)')
  halo.addColorStop(.45,'rgba(10,54,66,.1)')
  halo.addColorStop(.62,'rgba(8,42,53,.055)')
  halo.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.beginPath(); ctx.arc(cx,cy,r*1.82,0,7); ctx.fill()

  for (const p of particles) {
    const rr = p.radius * r * 2.1
    const angle = p.theta + t * p.velocity
    const wobble = 1 + .055 * Math.sin(t*.0004 + p.theta * 3)
    const x = cx + Math.cos(angle) * rr * wobble, y = cy + Math.sin(angle) * rr * wobble*.83
    if (x < -15 || x > width+15 || y < -15 || y > height+15) continue
    ctx.fillStyle = p.tint > .72 ? `rgba(50,158,70,${p.alpha*.52})` : `rgba(24,129,161,${p.alpha})`
    ctx.beginPath(); ctx.arc(x,y,p.size * (p.radius < .3 ? .42 : 1),0,Math.PI*2); ctx.fill()
  }
  ctx.save()
  for (const f of [.55, .74, .85, 1.00]) {
    ctx.beginPath(); ctx.arc(cx,cy,r*f,0,Math.PI*2)
    ctx.strokeStyle = `rgba(45,188,207,${f===1?.20:.25})`
    ctx.lineWidth = f === .55 ? 2.5 : 1
    ctx.stroke()
  }
  for (let i = 0; i < 90; i++) {
    const a = i * (Math.PI*2/90) + t * .000025
    ctx.beginPath()
    ctx.moveTo(cx+Math.cos(a)*r*.26, cy+Math.sin(a)*r*.26)
    ctx.lineTo(cx+Math.cos(a)*r*.52, cy+Math.sin(a)*r*.52)
    ctx.strokeStyle = `rgba(58,214,226,${.022+.026*Math.sin(i*.6+t*.0003)**2})`
    ctx.lineWidth = .7; ctx.stroke()
  }
  const core = ctx.createRadialGradient(cx,cy,r*.04,cx,cy,r*.2)
  core.addColorStop(0, 'rgba(140,255,255,.18)')
  core.addColorStop(.3, 'rgba(35,138,166,.1)')
  core.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx,cy,r*.20,0,7); ctx.fill()
  ctx.beginPath(); ctx.arc(cx,cy,r*.13,0,7)
  ctx.shadowBlur = 13; ctx.shadowColor = tint; ctx.strokeStyle = tint; ctx.globalAlpha=.52; ctx.lineWidth=5; ctx.stroke()
  ctx.restore()
  drawRing(cx,cy,r,t,tint)
  ctx.save()
  ctx.translate(cx,cy)
  ctx.rotate(t*.00017)
  ctx.beginPath(); ctx.arc(0,0,r+1,.32, .32+.24)
  ctx.shadowColor='#f4ffff';ctx.shadowBlur=14;ctx.lineWidth=5;ctx.strokeStyle='#f4ffff';ctx.stroke()
  ctx.restore()
  ui.signal.style.height = `${busy ? 63 : 8 + Math.round(10*Math.sin(t*.0008)**2)}%`
  ui.signalNumber.textContent = String(busy ? 63 : Math.round(10*Math.sin(t*.0008)**2)).padStart(3,'0') + '%'
  if (!reduced) requestAnimationFrame(render)
}
requestAnimationFrame(render)

async function boot() {
  if (reduced) { ui.boot.classList.add('done'); setTimeout(() => ui.boot.remove(), 100); return }
  for (let i = 0; i < 20; i++) {
    const bar = document.createElement('div')
    ui.bars.append(bar)
  }
  for (let i = 0; i <= 20; i++) {
    if (i < 20) ui.bars.children[i].classList.add('active')
    await new Promise(r => setTimeout(r, 65))
  }
  await new Promise(r => setTimeout(r, 400))
  ui.boot.classList.add('done')
  setTimeout(() => ui.boot.remove(), 800)
}

async function initialize() {
  try {
    const r = await fetch('/api/capabilities', { cache: 'no-store' })
    if (!r.ok) throw Error('Capabilities unavailable')
    const info = await r.json()
    mode = info.mode === 'connected' ? 'connected' : 'demo'
    chatEnabled = info.chatEnabled === true
    if (mode === 'demo') {
      ui.scenarioWrapper.hidden = false
      for (const [key, label] of Object.entries(info.scenarios || {})) {
        const opt = document.createElement('option')
        opt.value = key; opt.textContent = label
        ui.scenario.append(opt)
      }
    }
  } catch { mode = 'connected'; chatEnabled = false }
  await refresh()
  setInterval(() => void refresh(), 30_000)
  setInterval(() => { if (currentSnapshot) renderHealth(currentSnapshot) }, 5_000)
  let i=0
  setInterval(() => {
    if (ui.transcript.childElementCount === 0) ui.hint.textContent = hints[++i % hints.length]
  }, 6500)
  void boot()
}
ui.scenario.addEventListener('change', () => { scenario = ui.scenario.value; void refresh() })
$('refresh-health').addEventListener('click', () => void refresh())
$('command-form').addEventListener('submit', (e) => { e.preventDefault(); void submitMessage(ui.prompt.value) })
$('review-toggle').addEventListener('click', () => void showReview())
$('close-review').addEventListener('click', () => ui.review.close())
ui.review.addEventListener('click', e => { if (e.target === ui.review) ui.review.close() })
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target !== ui.prompt && !ui.review.open && !e.repeat) {
    e.preventDefault(); ui.prompt.focus()
  }
})
void initialize()
