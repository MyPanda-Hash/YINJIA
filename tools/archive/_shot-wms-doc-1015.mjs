/**
 * 截图(2026-10-15):按《WMS管理系统-界面截图.docx》的 8 张图**重新截图**(新 logo)。
 *
 * 关键发现(逐张读旧图确认的):该文档标题虽写"条码管理/库内管理",但图里拍的**其实是 MES 的真实面板**,
 *   并非另有一套 WMS 系统:
 *     wms1 采购入库单(材料仓库条码管理)
 *     wms2 商品(材料仓库条码管理之一)
 *     wms3 库存状况表(半成品仓库条码管理)
 *     wms4 产成品入库单(成品仓库条码管理)
 *     wms5 (成品仓库条码管理之二)— 旧图为销售出库单
 *     wms6 库存状况表(库内管理)
 *     wms7 (库内管理之二)— 旧图为库存台账/仓库
 *     wms8 ERP导入日志(ERP系统集成模块)
 *   ⇒ 全部可用当前系统重截,不存在"面板缺失"问题。
 *
 * 尺寸:旧图 3200×2000(2× 缩放)→ 本脚本用 deviceScaleFactor=2 + 1600×1000 视口对齐观感。
 * 用法: node tools/archive/_shot-wms-doc-1015.mjs [host]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_shots-wms-1015'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

// 顺序按文档:wms1..wms8
const SHOTS = [
  { n: 1, name: '材料仓库条码管理-采购入库单', hash: '#/panelx/list/PURCHASE_IN' },
  { n: 2, name: '材料仓库条码管理-商品', hash: '#/panelx/list/INV' },
  { n: 3, name: '半成品仓库条码管理-库存状况表', hash: '#/panelx/list/STOCK_STATUS' },
  { n: 4, name: '成品仓库条码管理-产成品入库单', hash: '#/panelx/list/FINISH_IN' },
  { n: 5, name: '成品仓库条码管理-销售出库单', hash: '#/panelx/list/SALE_OUT' },
  { n: 6, name: '库内管理-库存状况表', hash: '#/panelx/list/STOCK_STATUS' },
  { n: 7, name: '库内管理-库存台账', hash: '#/panelx/list/STOCK_LEDGER' },
  { n: 8, name: 'ERP系统集成模块-ERP导入日志', hash: '#/panelx/list/ERPLG' },
]

const profile = mkdtempSync(join(tmpdir(), 'edge-wms-'))
const port = 9345
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', '--force-device-scale-factor=2', 'about:blank'], { stdio: 'ignore' })

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
// 旧图 3200×2000 = 1600×1000 @2x
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false })

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

let ok = 0
for (const s of SHOTS) {
  await ev(`location.hash = ${JSON.stringify(s.hash)}; 'ok'`)
  await sleep(4500)
  const file = `wms${s.n}-${s.name}.png`
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r.result?.data) {
    writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
    const txt = await ev(`(document.body.innerText||'').length`)
    console.log(`[${s.n}/8] ${file}  (页面文字 ${txt})`)
    ok++
  } else {
    console.log(`[FAIL] ${file}`)
  }
}
console.log(`\n完成 ${ok}/8 -> ${OUT}`)
try { edge.kill() } catch {}
process.exit(0)
