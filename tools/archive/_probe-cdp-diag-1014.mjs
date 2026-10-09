/** 诊断:CDP 连接哪一步不回帧(2026-10-14) */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/yinjia/tools/package.json')
const WebSocket = require('ws')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9415
const PROFILE = path.resolve('D:/workspace/yinjia/.probe-edge-diag')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(PROFILE, { recursive: true })
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' })
let v = null
for (let i = 0; i < 30 && !v; i++) { await sleep(500); try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch {} }
console.log('[version]', JSON.stringify(v))
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
console.log('[list]', JSON.stringify(list.map((t) => ({ type: t.type, url: t.url, ws: t.webSocketDebuggerUrl })), null, 1))

async function tryWs(label, url, method) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { perMessageDeflate: false })
    const t = setTimeout(() => { console.log(`[${label}] 超时未回帧`); try { ws.close() } catch {}; resolve(false) }, 8000)
    ws.on('open', () => { console.log(`[${label}] open`); ws.send(JSON.stringify({ id: 1, method, params: {} })) })
    ws.on('message', (d) => { console.log(`[${label}] 回帧:`, String(d).slice(0, 160)); clearTimeout(t); try { ws.close() } catch {}; resolve(true) })
    ws.on('error', (e) => { console.log(`[${label}] error:`, e.message); clearTimeout(t); resolve(false) })
    ws.on('close', () => { console.log(`[${label}] closed`) })
  })
}

const page = list.find((t) => t.type === 'page')
if (page) await tryWs('page-target', page.webSocketDebuggerUrl, 'Page.enable')
await tryWs('browser-target', v.webSocketDebuggerUrl, 'Target.getTargets')
try { edge.kill() } catch {}
await sleep(500)
try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
