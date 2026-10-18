/**
 * _q-print-layer-check.mjs —— 打印层「懒渲染」改造的功能守恒校验(CDP,只读)
 *
 * 改造:档案面板(几千行)的 `.doc-print` A4 打印层不再常驻渲染,改成打印时才挂进 DOM;
 * 普通单据面板(行数 ≤ 300)照旧常驻。必须证明**打印输出没变**:
 *   A. 档案面板(INV):进页面时 `.doc-print` **不存在**(省掉 23 万节点);
 *   B. 触发 Ctrl+P(拦截路径):`.doc-print` 被挂上、`body.doc-printing` 生效、行数=全部明细行;
 *   C. 普通单据面板(PURCHASE_IN):`.doc-print` **当场就在**(常驻路径零变化)。
 *
 * 用法: node tools/archive/_perf-sweep-20261016/_q-print-layer-check.mjs [uiBase]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9406
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ✔ ${n}${d ? ' — ' + d : ''}`) } else { fail++; console.log(`  ✘ ${n}${d ? ' — ' + d : ''}`) } }

const lg = JSON.parse(await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).text())

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-print-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1440,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* 等 */ }
  if (!tab) await sleep(500)
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
/* 把 window.print 换成探针(headless 里真调打印会挂) */
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__printed = 0; window.print = function () { window.__printed++ };`,
})

const openPanel = async (panel) => {
  await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${UI}/#/panelx/list/${panel}` })
  for (let i = 0; i < 120; i++) {
    await sleep(150)
    const n = await ev(`document.querySelectorAll('.el-table__body tr').length`)
    if (n > 1) break
  }
  await sleep(1500)
}

console.log(`== 打印层懒渲染守恒校验 @ ${UI} ==`)

/* A. 档案面板 INV:进页面不该有打印层 */
await openPanel('INV')
const invLazy = await ev(`!!document.querySelector('.doc-print')`)
const invDom = await ev(`document.querySelectorAll('*').length`)
check('A 档案面板(INV)进页面时打印层未渲染', invLazy === false, invLazy ? '仍存在' : '已省掉')
check('A INV DOM 节点数已降下来', invDom < 20000, `实际 ${invDom} 个节点`)

/* B. 触发 Ctrl+P 拦截路径 */
const rowsBefore = await ev(`document.querySelectorAll('.el-table__body tr').length`)
const printed = await ev(`(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true }))
  return 1
})()`)
await sleep(1500)
const afterPrint = await ev(`JSON.stringify({
  layer: !!document.querySelector('.doc-print'),
  bodyCls: document.body.classList.contains('doc-printing'),
  rows: document.querySelectorAll('.doc-print tbody tr').length,
  cols: document.querySelectorAll('.doc-print thead th').length,
  printed: window.__printed,
  pageRule: (document.getElementById('doc-print-page') || {}).textContent || ''
})`)
const ap = JSON.parse(afterPrint || '{}')
console.log(`  · Ctrl+P 后: 打印层=${ap.layer} body.doc-printing=${ap.bodyCls} 行=${ap.rows} 列=${ap.cols} window.print 调用=${ap.printed}`)
console.log(`  · 注入的 @page: ${String(ap.pageRule).trim()}`)
check('B 打印层被挂上且行数=全部明细行', ap.layer === true && ap.rows > 3000, `行 ${ap.rows}(表格页 ${rowsBefore} 行)`)
check('B body.doc-printing 生效(打印时隐藏屏幕区、只出打印层)', ap.bodyCls === true)
check('B 调用了 window.print', ap.printed >= 1, `${ap.printed} 次`)
check('B @page 规则已注入(列数≥8 走横向)', /A4 landscape/.test(String(ap.pageRule)), String(ap.pageRule).trim())

/* C. 普通单据面板:常驻路径不变 */
await openPanel('PURCHASE_IN')
const docEager = await ev(`JSON.stringify({ layer: !!document.querySelector('.doc-print'), rows: document.querySelectorAll('.doc-print tbody tr').length })`)
const de = JSON.parse(docEager || '{}')
check('C 单据面板(PURCHASE_IN)打印层照旧常驻(未触发打印即在)', de.layer === true, `行 ${de.rows}`)

ws.close(); edge.kill()
console.log(`\n=== 打印层校验:PASS ${pass} / FAIL ${fail} ===`)
process.exit(fail ? 1 : 0)
