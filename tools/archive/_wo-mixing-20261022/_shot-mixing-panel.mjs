/**
 * 一次性探针（2026-10-22）：给新建的「混料记录」面板拍图，并与「报工记录」对照。
 *
 * 为什么用**测试账套**：wo_mixing_list 只在服务器上有；本地为了能看效果，
 * 在 HSDZ_MES_TEST 放了一张同形状的假数据表（见 _fixture-wo-mixing-list.sql）。
 * 8090 跑的还是旧前端（菜单里没有新项），但 /panelx/list/<面板码> 是通用路由，
 * 直接用面板码访问即可验证"面板本身"渲染成什么样。
 *
 * 用法：node tools/archive/_wo-mixing-20261022/_shot-mixing-panel.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_wo-mixing-20261022'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const SHOTS = [
  { file: '混料记录-测试账套.png', url: '/#/panelx/list/WO_MIXING_LIST', minRows: 1 },
  { file: '对照-报工记录-测试账套.png', url: '/#/panelx/list/WO_REPORT_LIST', minRows: 0 },
]

const profile = mkdtempSync(join(tmpdir(), 'edge-mix-'))
const port = 9361
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
if (!ws) { console.error('[FATAL] 连不上 Edge'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)

// 测试账套登录（两账套账号独立，HSDZ_MES_TEST 是正式库快照，admin/123456 同样有效）
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
if (!lg?.data?.token) { console.error('[FATAL] 测试账套登录失败:', JSON.stringify(lg).slice(0, 300)); edge.kill(); process.exit(1) }

await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(7000)

async function st() {
  const raw = await ev(`(() => {
    const txt = document.body.innerText || '';
    const head = [...document.querySelectorAll('.el-table__header th')].map(th => (th.innerText||'').trim()).filter(Boolean);
    return JSON.stringify({
      rows: document.querySelectorAll('.el-table__body tbody tr').length,
      len: txt.length,
      head: head.slice(0, 14),
      failed: /加载失败|请求失败|服务异常|面板不存在/.test(txt),
      title: (document.querySelector('.page-title,.panel-title,h2,h1')?.innerText || '').trim(),
    });
  })()`)
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

for (const s of SHOTS) {
  await send('Page.navigate', { url: host + s.url })
  const t0 = Date.now()
  let last = {}
  while (Date.now() - t0 < 30000) {
    await sleep(1200)
    last = await st()
    if (last.failed) break
    if (last.rows > s.minRows || last.rows >= Math.max(1, s.minRows)) break
  }
  await sleep(1200)
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r.result?.data) {
    writeFileSync(join(OUT, s.file), Buffer.from(r.result.data, 'base64'))
    console.log(`[OK] ${s.file}  rows=${last.rows}  failed=${last.failed}  head=${(last.head || []).join('|')}`)
  } else {
    console.log(`[FAIL] ${s.file} rows=${last.rows} failed=${last.failed}`)
  }
}
try { edge.kill() } catch {}
process.exit(0)
