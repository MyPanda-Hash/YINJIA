/**
 * 一次性探针(2026-10-15):三出库面板左栏「单据选择」的**截图存证** + en 语言走查。
 * 产物: tools/archive/_probe-3out-rail-shots/*.png
 * 用法: node tools/archive/_probe-3out-rail-shots-1015.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = 'http://localhost:5173'
const API = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_probe-3out-rail-shots'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

const profile = mkdtempSync(join(tmpdir(), 'edge-shot-'))
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9336/json/list')).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch {}
  await sleep(500)
}
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)

async function shoot(code, locale, tag) {
  await ev(`localStorage.setItem('mes_locale', ${JSON.stringify(locale)}); 'ok'`)
  await send('Page.navigate', { url: UI + '/#/panelx/list/' + code })
  await sleep(1500)
  await send('Page.reload', { ignoreCache: true })
  await sleep(6000)
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  for (let i = 0; i < 30; i++) {
    if (await ev(`!!document.querySelector('.doc-select-rail')`)) break
    await sleep(500)
  }
  await sleep(1800)
  const heads = await ev(`[...document.querySelectorAll('.doc-select-rail thead th')].map(th=>th.innerText.trim())`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const data = shot.result?.data
  if (data) writeFileSync(join(OUT, `${code}-${tag}.png`), Buffer.from(data, 'base64'))
  console.log(`[${code}/${tag}] 列头 = ${JSON.stringify(heads)}  -> ${OUT}/${code}-${tag}.png`)
  return heads
}

for (const code of ['FINISH_IN', 'SALE_OUT', 'MATERIAL_OUT', 'SO_ORDER']) {
  await shoot(code, 'zh-CN', 'zh')
}
console.log('\n--- 切 en 走查(多语言:新功能不得显示中文)---')
for (const code of ['FINISH_IN', 'SALE_OUT', 'MATERIAL_OUT']) {
  await shoot(code, 'en', 'en')
}
// 复位到中文,别把用户界面留在英文
await ev(`localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)
try { edge.kill() } catch {}
process.exit(0)
