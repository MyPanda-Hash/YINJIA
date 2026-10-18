/**
 * _probe-dialog-1020.mjs — 库存台账/收发存汇总「重复弹窗 + 查询」实机取证(无头 Edge + CDP)
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_probe-dialog-1020.mjs [host]
 *   默认 host = http://127.0.0.1:8090
 *
 * 观测点(每步都记):
 *   ① 进入面板后可见的 el-dialog / el-overlay 计数与标题
 *   ② 取消/✕ 关闭首个弹窗后:是否又冒出一个、数量、地址栏 hash
 *   ③ 重新进入 → 填日期段 → 点「查询」:可见弹窗计数是否归零、列表行数、后端请求
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

const profile = mkdtempSync(join(tmpdir(), 'edge-stockdlg-'))
const port = 9361
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
  } catch { /* retry */ }
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
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6000)

/** 观测:可见弹窗/遮罩数量、标题、地址栏 hash、列表行数 */
const observe = () => ev(`(() => {
  const vis = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null }
  const overlays = [...document.querySelectorAll('.el-overlay')].filter(vis)
  const dialogs = [...document.querySelectorAll('.el-dialog')].filter(vis)
  return {
    overlays: overlays.length,
    dialogs: dialogs.length,
    titles: dialogs.map(d => (d.querySelector('.el-dialog__title')?.innerText || '').trim()),
    hash: location.hash,
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    messages: [...document.querySelectorAll('.el-message')].map(m => m.innerText.trim()),
  }
})()`)

const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r.result?.data) writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
}

/** 网络:记 px/* 请求 */
const net = []
await send('Network.enable')
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Network.requestWillBeSent' && /\/api\/px\//.test(m.params?.request?.url || '')) {
    net.push(m.params.request.url.replace(host, ''))
  }
})

const lines = []
const say = (s) => { console.log(s); lines.push(s) }

/** 打开面板并观察「进入即弹窗」 */
async function enterPanel(code) {
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  await sleep(7000)
  return observe()
}

/** 点弹窗按钮(按文字) */
const clickDialogBtn = (text) => ev(`(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null)
  for (const d of dlgs) {
    const b = [...d.querySelectorAll('button, .el-button')].find(x => (x.innerText || '').trim() === ${JSON.stringify(text)})
    if (b) { b.click(); return 'clicked' }
  }
  return 'not-found'
})()`)

/** 弹窗 ✕ 关闭 */
const clickDialogClose = () => ev(`(() => {
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null)
  const d = dlgs[0]
  if (!d) return 'no-dialog'
  const x = d.querySelector('.el-dialog__headerbtn')
  if (x) { x.click(); return 'clicked' }
  return 'no-close'
})()`)

/** 填日期段(弹窗内置 el-date-picker daterange) */
async function fillDateRange(start, end) {
  return ev(`(() => {
    const dlgs = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null)
    const d = dlgs[0]
    if (!d) return 'no-dialog'
    const inputs = [...d.querySelectorAll('.el-date-editor input')]
    if (inputs.length < 2) return 'no-range-inputs'
    const setV = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('blur', { bubbles: true }))
    }
    setV(inputs[0], ${JSON.stringify(start)})
    setV(inputs[1], ${JSON.stringify(end)})
    return 'filled'
  })()`)
}

for (const [code, name] of [['STOCK_LEDGER', '库存台账'], ['STOCK_SUMMARY', '收发存汇总表']]) {
  say(`\n########## ${name} ${code} ##########`)
  await ev(`location.hash = '#/dashboard'; 'ok'`); await sleep(2500)
  const o1 = await enterPanel(code)
  say(`① 进入面板: ${JSON.stringify(o1)}`)
  await shot(`01-${code}-enter.png`)

  // 点「取消」关闭
  const c1 = await clickDialogBtn('取消')
  await sleep(3000)
  const o2 = await observe()
  say(`② 点「取消」(${c1}) 后: ${JSON.stringify(o2)}`)
  await shot(`02-${code}-after-cancel.png`)

  // 再进入 → 点 ✕
  await ev(`location.hash = '#/dashboard'; 'ok'`); await sleep(2500)
  const o3 = await enterPanel(code)
  const c2 = await clickDialogClose()
  await sleep(3000)
  const o4 = await observe()
  say(`③ 再进入 ${JSON.stringify(o3)} → 点✕(${c2}) 后: ${JSON.stringify(o4)}`)
  await shot(`03-${code}-after-x.png`)

  // 再进入 → 填日期段 → 查询
  await ev(`location.hash = '#/dashboard'; 'ok'`); await sleep(2500)
  const o5 = await enterPanel(code)
  const f = await fillDateRange('2000-01-01', '2030-12-31')
  await sleep(600)
  const before = net.length
  const c3 = await clickDialogBtn('查询')
  await sleep(8000)
  const o6 = await observe()
  say(`④ 再进入 ${JSON.stringify(o5)} → 填日期(${f}) → 点查询(${c3}): ${JSON.stringify(o6)}`)
  say(`   本次查询期间 px 请求: ${JSON.stringify(net.slice(before))}`)
  await shot(`04-${code}-after-query.png`)
}

writeFileSync(join(OUT, 'probe-dialog.out'), lines.join('\n') + '\n')
try { edge.kill() } catch { /* ignore */ }
process.exit(0)
