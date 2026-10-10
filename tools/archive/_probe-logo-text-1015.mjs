/**
 * 探针(2026-10-15):登录本地系统后,报告**左侧 logo 区实际显示什么文字**。
 * 用途:用户要按「logo 系统名从 轻MES → 银嘉数字化平台」重截两个文档的图,
 *   先确认运行中的系统确实已改名(而不是只改了源码没进包)。
 * 只读(登录 + 读 DOM),不写业务数据。
 * 用法: node tools/archive/_probe-logo-text-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'edge-logo-'))
const port = 9340
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
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
await send('Page.navigate', { url: host + '/#/login' })
await sleep(4000)
console.log('=== 登录页品牌文字 ===')
console.log(await ev(`document.body.innerText.split('\\n').filter(s=>s.trim()).slice(0,12).join(' | ')`))

const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))}); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(7000)

console.log('\n=== 进系统后:左上/侧栏 logo 区文字 ===')
const info = await ev(`(() => {
  const hit = [];
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent || '').trim();
    if (!t || t.length > 30) continue;
    if (!el.children.length || el.children.length <= 1) {
      if (/轻\\s*MES|银嘉|YINJIA|数字化平台/i.test(t)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) hit.push({ text: t, cls: (el.className||'').toString().slice(0,40), x: Math.round(r.x), y: Math.round(r.y) });
      }
    }
  }
  return JSON.stringify(hit.slice(0, 12), null, 1);
})()`)
console.log(info)
try { edge.kill() } catch {}
process.exit(0)
