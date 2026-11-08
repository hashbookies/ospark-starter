import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dirs = ['scripts','packages/demo-data','packages/system-health','packages/gateway-adapter','apps/spark-ui/public','tests']
let count=0
for(const folder of dirs){
  for(const filename of readdirSync(resolve(root,folder))){
    if(!/\.(?:mjs|js)$/.test(filename)) continue
    const file=resolve(root,folder,filename)
    const p=spawnSync(process.execPath,['--check',file],{stdio:'inherit'})
    if(p.status!==0) process.exit(p.status||1)
    count++
  }
}
console.log(`PASS: Syntax checked ${count} JavaScript modules.`)
