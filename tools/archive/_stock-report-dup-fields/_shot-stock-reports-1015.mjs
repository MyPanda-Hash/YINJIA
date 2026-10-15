/**
 * _shot-stock-reports-1015.mjs — 修复后截图:库存报表组四张面板的列表列
 *
 * 背景:2026-10-15 用户报「库存状况表出现字段重复」——列表把 仓库编码/仓库/存货编码/存货 各显示两遍。
 *   清洗脚本 tools/migrate-stock-report-dup-fields-20261015.sql 已把重复行删掉(9/29/19 列)。
 *   本脚本用**正式账套**登录后在 8090 上截图存证(库改动与前端无关,5173 源码版看到的列一致)。
 *
 * 用法: node tools/archive/_stock-report-dup-fields/_shot-stock-reports-1015.mjs [host]
 *   默认 host = http://127.0.0.1:8090
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const OUT = 'tools/archive/_stock-report-dup-fields'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'edge-stockrep-'))
const port = 9351
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
if (!ws) { console.error('[FATAL] 连不上 Edge CDP'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: host + '/#/login' })
await sleep(3500)

const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
if (!lg?.data?.token) { console.error('[FATAL] 登录失败'); process.exit(1) }
console.log('[login] 正式账套 token 已取')

await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6000)

/** 表头文字(网格列) */
const headers = () => ev(`(() => [...document.querySelectorAll('.el-table__header th .cell')].map(e => e.innerText.trim()).filter(Boolean).join(' | '))()`)

/** 级联报表面板(台账/汇总)进页面先弹条件弹窗:填日期段 + 点查询 */
async function passQueryDialog() {
  const opened = await ev(`!!document.querySelector('.el-dialog__wrapper:not([style*="display: none"]) .el-date-editor')`)
  if (!opened) return 'no-dialog'
  await ev(`(() => { const i = document.querySelector('.el-date-editor input'); if (i) { i.focus(); i.click() } return 'ok' })()`)
  await sleep(500)
  for (const [text, enter] of [['2000-01-01', true], ['2030-12-31', true]]) {
    await send('Input.insertText', { text })
    if (enter) await send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter' })
    if (enter) await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13, key: 'Enter', code: 'Enter' })
    await sleep(400)
  }
  const clicked = await ev(`(() => {
    const btns = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')]
    const b = btns.find(x => (x.innerText || '').trim() === '查询')
    if (b) { b.click(); return 'clicked' } return 'no-button'
  })()`)
  await sleep(6000)
  return clicked
}

const panels = [
  ['STOCK_BALANCE', '库存状况表', false],
  ['STOCK_LEDGER', '库存台账', true],
  ['STOCK_SUMMARY', '收发存汇总表', true],
  ['STOCK_DETAIL', '库存明细', false],
]
const report = []
for (const [code, name, dialog] of panels) {
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  await sleep(6500)
  const dlg = dialog ? await passQueryDialog() : 'n/a'
  const h = await headers()
  const rows = await ev(`document.querySelectorAll('.el-table__body tbody tr').length`)
  console.log(`[${code}] 弹窗=${dlg} 列=${h} 行=${rows}`)
  report.push(`${code}\t${name}\t列: ${h}\t首屏行数=${rows}`)
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r.result?.data) {
    writeFileSync(join(OUT, `${code}.png`), Buffer.from(r.result.data, 'base64'))
    console.log(`[OK] 已存 ${code}.png`)
  }
}
writeFileSync(join(OUT, 'ui-columns-after.txt'), report.join('\n') + '\n')
try { edge.kill() } catch {}
process.exit(0)
