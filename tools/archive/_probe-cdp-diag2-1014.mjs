/** 诊断2:复刻探针的启动参数与 target 选择,定位"不回帧"的确切条件(2026-10-14) */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/yinjia/tools/package.json')
const WebSocket = require('ws')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function trial(label, extraFlags, preferBlank) {
  const PORT = 9416 + trial.n++
  const PROFILE = path.resolve(`D:/workspace/yinjia/.probe-edge-diag${trial.n}`)
  fs.mkdirSync(PROFILE, { recursive: true })
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    ...extraFlags, `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' })
  let v = null
  for (let i = 0; i < 30 && !v; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch {} }
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const pages = targets.filter((t) => t.type === 'page')
  const tab = (preferBlank ? pages.find((t) => t.url === 'about:blank') : null) || pages[0]
  const picked = tab ? (tab.url.startsWith('edge://') ? tab.url.slice(0, 40) : tab.url) : '(none)'
  let reply = '(no-reply)'
  await new Promise((resolve) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false })
    const t = setTimeout(() => { reply = 'TIMEOUT'; try { ws.close() } catch {}; resolve() }, 10000)
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, method: 'Page.enable', params: {} })))
    ws.on('message', (d) => { clearTimeout(t); reply = String(d).slice(0, 90); try { ws.close() } catch {}; resolve() })
    ws.on('error', (e) => { clearTimeout(t); reply = 'ERR ' + e.message; resolve() })
  })
  console.log(`[${label}] pages=${pages.length} pick=${picked} => ${reply}`)
  try { edge.kill() } catch {}
  await sleep(800)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
}
trial.n = 0

await trial('A 原参数+首个page', [], false)
await trial('B 探针参数+优先about:blank', ['--disable-extensions', '--disable-sync',
  '--disable-features=msEdgeFirstRunExperience,msSyncConfirmationDialog'], true)
await trial('C 探针参数+首个page', ['--disable-extensions', '--disable-sync',
  '--disable-features=msEdgeFirstRunExperience,msSyncConfirmationDialog'], false)
