import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { startServer } from '../packages/gateway-adapter/server.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Deliberately minimal local .env reader: no shell evaluation, expansion or execution.
// Existing process variables win over .env values.
const envPath = resolve(root, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z_0-9]*)=(.*)$/.exec(line)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

const mode = process.argv[2] === 'connected' ? 'connected' : 'demo'
startServer({ root, mode })
