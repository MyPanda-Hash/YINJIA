/**
 * _shot-stock-reports-1020.mjs — 库存台账/收发存汇总「查询弹窗 → 查询」实拍(无头 Edge + CDP)
 *
 * ⚠ 本机(受限环境)Edge 起不来:`[FATAL] mojo platform_channel Check failed: 拒绝访问 (0x5)`
 *   —— 需在正常终端跑。脚本本身与 _stockreport-dialog-1020/README.md 的复跑清单一致。
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_shot-stock-reports-1020.mjs [host]
 *   默认 host = http://localhost:5173(源码版;改完前端即生效)或 http://127.0.0.1:8090(打包版)
 *
 * 观察点:
 *   ① 进入面板 → 弹窗数量(应 1)、日期区间已默认带出
 *   ② 关闭(✕/取消)后是否又冒出一个(修复后应为 0)
 *   ③ 填仓库/存货 + 日期 → 查询 → 明细行数(台账应 > 0,不再只有期初/期末两行)
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const host = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'edge-sr1020-'))
const port = 9371
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1680,1000',
  '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

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
  } catch { /* retry */ }
  await sleep(500)
}
if (!ws) { console.error('[FATAL] 连不上 Edge CDP(本机受限环境属已知:见 README)'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: host + '/#/login' })
await sleep(4000)

const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg?.data?.token || '')});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg?.data?.user || {}))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(7000)

const observe = () => ev(`(() => {
  const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null
  const dialogs = [...document.querySelectorAll('.el-dialog')].filter(vis)
  const rangeInputs = dialogs[0] ? [...dialogs[0].querySelectorAll('.el-date-editor input')].map(i => i.value) : []
  return {
    dialogs: dialogs.length,
    titles: dialogs.map(d => (d.querySelector('.el-dialog__title')?.innerText || '').trim()),
    range: rangeInputs,
    activeCond: dialogs[0]?.querySelector('.query-active-text')?.innerText || '',
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
  }
})()`)
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r.result?.data) writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
}
const lines = []
const say = (s) => { console.log(s); lines.push(s) }

for (const code of ['STOCK_LEDGER', 'STOCK_SUMMARY']) {
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  await sleep(8000)
  const a = await observe()
  say(`${code} ① 进入: ${JSON.stringify(a)}`)
  await shot(`sr1020-${code}-1-enter.png`)

  // 关闭 → 观察是否重弹
  await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null); d?.querySelector('.el-dialog__headerbtn')?.click(); return 1 })()`)
  await sleep(4000)
  const b = await observe()
  say(`${code} ② 关闭后: ${JSON.stringify(b)}(修复后 dialogs 应为 0)`)
  await shot(`sr1020-${code}-2-closed.png`)

  // 再进 → 查(日期默认已带;台账需选仓+存货,由人工在界面上补,脚本只点查询看校验提示)
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  await sleep(8000)
  await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null);
    const btn=[...(d?.querySelectorAll('button')||[])].find(x=>(x.innerText||'').trim()==='查询'); btn?.click(); return 1 })()`)
  await sleep(6000)
  const c = await observe()
  say(`${code} ③ 点查询后: ${JSON.stringify(c)}`)
  await shot(`sr1020-${code}-3-after-query.png`)
}

writeFileSync(join(OUT, 'shot-1020.out'), lines.join('\n') + '\n')
try { edge.kill() } catch { /* ignore */ }
process.exit(0)
