/**
 * 截图续(2026-10-15):补《MES管理系统-界面截图.docx》第 15–18 张。
 *  15 检验数据记录-2 · 16 我的桌面 · 17 我的桌面·生产管理 · 18 我的桌面·研发管理
 *
 * 为什么单独一个脚本:上一次全量跑在第 15 张卡住(检验数据记录面板切换后长时间不返回),
 *   拆开跑便于定位与重试;结果与 _shot-mes-doc-1015.mjs 同一输出目录,文件名一致可覆盖。
 *
 * ⚠ 桌面三视图是**同一路由 /dashboard 的不同模块页签**(概览/生产/研发管理),
 *   由前端 MODULES 常量决定,需点页签切换 —— 不是三个 URL。
 *
 * 用法: node tools/archive/_shot-mes-doc-rest-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_shots-mes-1015'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'edge-rest-'))
const port = 9342
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

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
if (!ws) { console.error('[FATAL] 连不上 Edge CDP'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6500)
console.log('[boot] 已登录\n')

const shot = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r.result?.data) { console.log('  [FAIL] ' + file); return false }
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
  console.log('  [OK] ' + file)
  return true
}

let ok = 0

// 15 检验数据记录-2
await ev(`location.hash = '#/panelx/list/QC_INSP_REC'; 'ok'`)
await sleep(6000)
console.log('[15] 检验数据记录-2')
if (await shot('15-检验数据记录-2.png')) ok++

// 16–18 我的桌面三视图:同路由三个模块页签
async function desk(mod, label, file) {
  await ev(`location.hash = '#/dashboard'; 'ok'`)
  await sleep(4500)
  const clicked = await ev(`(() => {
    const all = [...document.querySelectorAll('div,span,button,a')];
    const t = all.reverse().find(e => (e.textContent||'').trim() === ${JSON.stringify(label)} && e.children.length <= 1);
    if (t) { t.click(); return true }
    return false;
  })()`)
  await sleep(4000)
  console.log(`[desk:${mod}] 页签「${label}」点击=${clicked}`)
  return await shot(file)
}
console.log('[16] 我的桌面(概览)')
if (await desk('overview', '概览', '16-我的桌面.png')) ok++
console.log('[17] 我的桌面·生产管理')
if (await desk('prod', '生产', '17-我的桌面-生产管理.png')) ok++
console.log('[18] 我的桌面·研发管理')
if (await desk('rd', '研发管理', '18-我的桌面-研发管理.png')) ok++

console.log(`\n补图完成 ${ok}/4 -> ${OUT}`)
try { edge.kill() } catch {}
process.exit(0)
