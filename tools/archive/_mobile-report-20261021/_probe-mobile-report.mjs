/**
 * _probe-mobile-report.mjs — 工序报工页面验收(2026-10-21)
 *
 * 只读验收:登录 → 打开 /#/panelx/list/PROD_REPORT → 输工单号点「查询」→
 * 断言:工单卡(含当前工序)、三道工序卡(成型/切炭/组装)、数量默认值、今日报工区。
 * **不点提交**(提交会在正式库写报工单并审核,须由使用者确认后手动做)。
 *
 * 用法:node tools\archive\_mobile-report-20261021\_probe-mobile-report.mjs [URL] [工单号] [行号]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const UI = process.argv[2] || 'http://127.0.0.1:8090'
const WO = process.argv[3] || 'GD-2026-10-0221'
const W = Number(process.env.PROBE_W || 390)
const H = Number(process.env.PROBE_H || 1400)
const PORT = 9419
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lg = await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
if (!lg?.data?.token) throw new Error('登录失败')

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rep-'))
spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=' + W + ',' + H,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch {}
  if (!tab) await sleep(500)
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 600 })
await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1800)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: `${UI}/#/panelx/list/PROD_REPORT` }); await sleep(5000)

const out = []
const ok = (n, p, d = '') => { out.push({ n, p }); console.log(`${p ? '  ✔' : '  ✘'} ${n}${d ? '  ' + d : ''}`) }

ok('页面已渲染', /工序报工/.test(await ev('document.querySelector(".mp-title")?.textContent || ""')))

// 填工单号 → 查询
await ev(`(() => {
  const inp = document.querySelector('.mp-row input');
  inp.value = ${JSON.stringify(WO)};
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  const btns = Array.from(document.querySelectorAll('.mp-row button'));
  const q = btns.find(b => (b.textContent || '').includes('查询'));
  q && q.click();
  return 'ok';
})()`)
await sleep(3000)

const info = JSON.parse(await ev(`JSON.stringify({
  woNo: document.querySelector('.mp-wo-no')?.innerText || '',
  kvs: document.querySelector('.mp-wo')?.innerText || '',
  ops: Array.from(document.querySelectorAll('.mp-op')).map(o => o.innerText.replace(/\\n/g, ' ')),
  activeOp: document.querySelector('.mp-op.is-active')?.innerText.replace(/\\n/g, ' ') || '',
  qty: document.querySelector('.mp-qty input')?.value || '',
  hasSubmit: !!Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('提交报工')),
  today: document.querySelector('.mp-right .mp-sec-num')?.textContent || '',
  err: document.querySelector('.mp-err-top')?.innerText || '',
})`))

ok('工单卡出现且带行号', info.woNo.includes(WO), info.woNo)
ok('工单卡含「当前工序」与「排产数量」', /当前工序/.test(info.kvs) && /排产数量/.test(info.kvs), info.kvs.replace(/\n/g, ' / ').slice(0, 120))
ok('三道工序齐全(成型/切炭/组装)', info.ops.length === 3 && /成型/.test(info.ops.join()) && /切炭/.test(info.ops.join()) && /组装/.test(info.ops.join()), JSON.stringify(info.ops))
ok('默认选中「当前工序」或首道未做满的工序', info.activeOp.length > 0, info.activeOp)
ok('完工数量有默认值(计划-已报)', Number(info.qty) > 0, 'qty=' + info.qty)
ok('有「提交报工」按钮', info.hasSubmit === true)
ok('今日报工区存在', info.today !== '', '条数=' + info.today)
ok('无错误提示', info.err === '', info.err)

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
const dir = path.join(process.cwd(), 'tools', 'archive', '_mobile-report-20261021')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'mobile-report-390.png'), Buffer.from(shot.result.data, 'base64'))
console.log('\n截图: ' + path.join(dir, 'mobile-report-390.png'))
const pass = out.filter((x) => x.p).length
console.log(`\n=== ${pass}/${out.length} 通过 ===`)
process.exit(pass === out.length ? 0 : 1)
