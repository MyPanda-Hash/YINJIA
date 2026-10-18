/**
 * _probe-ui-1020.mjs — 库存台账/收发存汇总 查询弹窗的**实机取证**(带控制台错误捕获 + DOM 细节)
 *
 * 目的(2026-10-20 第二轮):上一版 _probe-dialog-1020.mjs 在真实浏览器里跑出两个疑点 ——
 *   ① 台账页 4 个步骤全是 dialogs=0 / rows=0(面板像没渲染)
 *   ② 汇总页点「取消」后 dialogs=2(两个「查询」弹窗叠着)
 * 本脚本把每个弹窗的可见性、父级 overlay、teleport 归属、以及页面控制台报错全部打出来,
 * 用来分清「真 bug」与「探针误判」。
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_probe-ui-1020.mjs [host]
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

const profile = mkdtempSync(join(tmpdir(), 'edge-ui1020-'))
const port = 9385
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1680,1000', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
      }
      break
    }
  } catch { /* retry */ }
  await sleep(500)
}
if (!ws) { console.error('[FATAL] 连不上 Edge CDP'); process.exit(1) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')

// 收集控制台报错
const consoleErrs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrs.push('EXC: ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || '').split('\n')[0])
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
    consoleErrs.push('ERR: ' + (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 200))
  }
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
    consoleErrs.push('LOG: ' + String(m.params.entry.text).slice(0, 200))
  }
})

await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: host + '/#/login' })
await sleep(4000)

const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
if (!lg?.data?.token) { console.error('[FATAL] 登录失败'); process.exit(1) }
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(8000)

/** 详细 DOM:每个 .el-dialog 是否可见、父级 overlay 的 display、是否在 body 下(teleport)、标题 */
const dumpDialogs = () => ev(`(() => {
  const all = [...document.querySelectorAll('.el-dialog')]
  const info = all.map((d, i) => {
    const cs = getComputedStyle(d)
    const ov = d.closest('.el-overlay')
    const ovCs = ov ? getComputedStyle(ov) : null
    return {
      i,
      title: (d.querySelector('.el-dialog__title')?.innerText || '').trim(),
      selfDisplay: cs.display,
      selfVisibility: cs.visibility,
      offsetParentNull: d.offsetParent === null,
      overlayDisplay: ovCs ? ovCs.display : '(no-overlay)',
      overlayZ: ovCs ? ovCs.zIndex : '',
      parentIsBody: d.parentElement === document.body || d.parentElement?.parentElement === document.body,
    }
  })
  return {
    total: all.length,
    visible: info.filter(x => x.selfDisplay !== 'none' && x.selfVisibility !== 'hidden' && x.overlayDisplay !== 'none' && !x.offsetParentNull).length,
    info,
    hash: location.hash,
    tableRows: document.querySelectorAll('.el-table__body tbody tr').length,
    hasQueryBtn: [...document.querySelectorAll('.el-dialog button')].some(b => (b.innerText||'').trim() === '查询'),
  }
})()`)

const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r.result?.data) writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
}

const lines = []
const say = (s) => { console.log(s); lines.push(s) }

for (const code of ['STOCK_LEDGER', 'STOCK_SUMMARY']) {
  say(`\n########## ${code} ##########`)
  consoleErrs.length = 0
  await ev(`location.hash = '#/dashboard'; 'ok'`)
  await sleep(3000)
  await ev(`location.hash = '#/panelx/list/${code}'; 'ok'`)
  await sleep(9000)
  const d1 = await dumpDialogs()
  say(`① 进入面板: total=${d1.total} visible=${d1.visible} hash=${d1.hash} rows=${d1.tableRows}`)
  say(`   细节: ${JSON.stringify(d1.info)}`)
  say(`   控制台错误: ${consoleErrs.length ? JSON.stringify(consoleErrs.slice(0, 5)) : '(无)'}`)
  await shot(`ui1020-${code}-1-enter.png`)

  // 日期段默认值
  const range = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null)
    if (!d) return null
    return [...d.querySelectorAll('.el-date-editor input')].map(i => i.value)
  })()`)
  say(`   日期段默认值: ${JSON.stringify(range)}`)
}

writeFileSync(join(OUT, 'probe-ui.out'), lines.join('\n') + '\n')
try { edge.kill() } catch { /* ignore */ }
process.exit(0)
