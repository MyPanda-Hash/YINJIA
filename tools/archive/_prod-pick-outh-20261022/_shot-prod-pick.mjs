/**
 * 一次性探针（2026-10-22）：给新建的「生产领料」面板拍图 + 取证。
 *
 * 为什么打 5173（vite）：5173 是**源码即时生效**的地址，菜单项（menus.js）刚加过，
 * 只有它已带上新菜单；8090 的 jar 里还是旧静态产物（下次 rebuild 才会跟上）。
 * 5173 的 /api 代理到 8090（正式账套 HSDZ_MES），面板与数据都在正式库里。
 *
 * 产出：
 *   生产领料-正式账套.png        面板列表（真实 2094 行 / 487 张 SCLL 领料单）
 *   生产领料-左侧菜单.png        WMS管理系统 → 库存核算 → 单据 里的菜单项
 *   生产领料-英文.png            切换 en 后列头/菜单是否已译（多语言红线）
 *
 * 用法：node tools/archive/_prod-pick-outh-20261022/_shot-prod-pick.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_prod-pick-outh-20261022'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'edge-pick-'))
const port = 9362
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1680,1000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

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
if (!ws) { console.error('[FATAL] 连不上 Edge'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: host + '/#/login' })
await sleep(4000)

// 正式账套登录（YJ = HSDZ_MES；面板与 outh 数据都在这里）
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
if (!lg?.data?.token) { console.error('[FATAL] 正式账套登录失败:', JSON.stringify(lg).slice(0, 300)); edge.kill(); process.exit(1) }

async function seed(locale) {
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
    + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
    + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
    + `localStorage.setItem('mes_locale', ${JSON.stringify(locale)}); 'ok'`)
  await send('Page.reload', { ignoreCache: true })
  await sleep(9000)
}

async function st() {
  const raw = await ev(`(() => {
    const txt = document.body.innerText || '';
    const head = [...document.querySelectorAll('.el-table__header th')].map(th => (th.innerText||'').trim()).filter(Boolean);
    return JSON.stringify({
      rows: document.querySelectorAll('.el-table__body tbody tr').length,
      head: head.slice(0, 16),
      total: (txt.match(/共\\s*(\\d+)\\s*条/) || [])[1] || '',
      failed: /加载失败|请求失败|服务异常|面板不存在/.test(txt),
    });
  })()`)
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r.result?.data) { console.log(`[FAIL] ${file} 截图失败`); return false }
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
  return true
}

// ── 1. 中文：面板列表 ────────────────────────────────────────────────────
await seed('zh-CN')
await send('Page.navigate', { url: host + '/#/panelx/list/PROD_PICK_LIST' })
let last = {}
for (let i = 0; i < 25; i++) {
  await sleep(1200)
  last = await st()
  if (last.failed || last.rows > 0) break
}
await sleep(1500)
await shot('生产领料-正式账套.png')
console.log(`[1] 中文面板  rows=${last.rows}  total=${last.total}  failed=${last.failed}  head=${(last.head || []).join('|')}`)

// ── 2. 左侧菜单：WMS管理系统 → 库存核算 → 单据 ───────────────────────────
// 注意：从上面那个面板页进来时，WMS 组**已经是展开态**（当前路由在其中），
// 再点一次 nav-group 反而会把它收起来（第一版就踩了这个），所以先看有没有 .nav-module。
const nav = await ev(`(() => {
  const mods = document.querySelectorAll('.nav-module');
  if (mods.length) return 'ALREADY-EXPANDED';
  const g = [...document.querySelectorAll('.nav-group')]
    .find(e => (e.innerText || '').trim().replace(/\\s+/g, '') === 'WMS管理系统');
  if (!g) return 'NO-GROUP';
  g.click();
  return 'CLICKED-GROUP';
})()`)
await sleep(1500)
const mod = await ev(`(() => {
  const m = [...document.querySelectorAll('.nav-module')]
    .find(e => (e.innerText || '').trim().replace(/\\s+/g, '') === '库存核算');
  if (!m) return 'NO-MODULE:' + [...document.querySelectorAll('.nav-module')].map(e => e.innerText.trim()).join(',');
  const r = m.getBoundingClientRect();
  m.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: r.left + 20, clientY: r.top + 10 }));
  m.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: r.left + 20, clientY: r.top + 10 }));
  return 'HOVERED-MODULE';
})()`)
await sleep(2000)
const card = await ev(`(() => {
  const c = document.querySelector('.fly-card');
  if (!c) return 'NO-CARD';
  const items = [...c.querySelectorAll('.card-item')].map(e => (e.innerText || '').trim());
  return JSON.stringify({ items, hasPick: items.some(t => t.includes('生产领料')) });
})()`)
await shot('生产领料-左侧菜单.png')
console.log(`[2] 菜单 ${nav} / ${mod} / card=${card}`)

// ── 3. 英文：面板列表（多语言红线：切 en 后列头与菜单是新译名） ─────────────
await seed('en')
await send('Page.navigate', { url: host + '/#/panelx/list/PROD_PICK_LIST' })
let en = {}
for (let i = 0; i < 25; i++) {
  await sleep(1200)
  en = await st()
  if (en.failed || en.rows > 0) break
}
await sleep(2000)
await shot('生产领料-英文.png')
console.log(`[3] 英文面板  rows=${en.rows}  head=${(en.head || []).join('|')}`)

try { edge.kill() } catch {}
process.exit(0)
