import { validateLoopbackBase, getJson } from '../system-health/health.mjs'

/** Optional chat to a PLAIN LOCAL INFERENCE ENDPOINT only.
 * Never connect to an agent gateway with tools/workflows. A model API that ignores
 * tool_choice can still run server-side tools: this code cannot prevent that.
 */
export async function chatOnce(config, rawText, { fetchFn = fetch } = {}) {
  if (!config.allowChat) return { ok: false, code: 403, error: 'Local model chat is disabled' }
  const modelUrl = validateLoopbackBase(config.modelUrl || '')
  if (!modelUrl || !config.modelId) return { ok: false, code: 503, error: 'Configure MODEL_BASE_URL and MODEL_ID first' }
  if (typeof rawText !== 'string' || !rawText.trim() || rawText.length > 2000) {
    return { ok: false, code: 400, error: 'Text must be 1–2000 characters' }
  }
  const headers = { 'content-type': 'application/json', accept: 'application/json' }
  if (config.modelKey) headers.authorization = `Bearer ${config.modelKey}`
  try {
    const res = await fetchFn(`${modelUrl}/v1/chat/completions`, {
      method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: config.modelId, stream: false, temperature: 0.5, max_tokens: 350,
        tool_choice: 'none',
        messages: [
          { role: 'system', content: 'You are Spark, a helpful assistant in the OSPARK Starter reference application. This is a public example project, not a connected owner workflow. Give concise helpful answers. Do not claim access to local files, tools, accounts or agents. You cannot execute actions.' },
          { role: 'user', content: rawText.trim() },
        ],
      }),
    })
    if (!res.ok) return { ok: false, code: 502, error: `Local model returned HTTP ${res.status}` }
    const chunks = []
    let bytes = 0
    for await (const chunk of res.body) {
      bytes += chunk.length
      if (bytes > 120_000) return { ok: false, code: 502, error: 'Model response too large' }
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks).toString('utf8')
    const json = JSON.parse(body)
    const choice = json?.choices?.[0]
    if (choice?.message?.tool_calls?.length || choice?.finish_reason === 'tool_calls') {
      return { ok: false, code: 502, error: 'Tool calls are unsupported in starter mode' }
    }
    const message = choice?.message?.content
    if (typeof message !== 'string' || !message.trim()) return { ok: false, code: 502, error: 'No text returned' }
    return { ok: true, code: 200, reply: message.slice(0, 3000) }
  } catch {
    return { ok: false, code: 502, error: 'Local model unavailable or response malformed' }
  }
}
