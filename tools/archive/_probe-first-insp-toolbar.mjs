/*
 * _probe-first-insp-toolbar.mjs — 首件检验单「工具栏三件事」界面验收(2026-10-16 第四轮)
 *
 * 用户口径:「让当前取成型工艺清单的按钮实现的时候能够带入当前其对应列内填写的数据内容。
 *   然后去除当前首件检验单中检验项目/检验方案的按钮,然后让当前的首件检验单也可以选择到生产工单。
 *   当前制程检验单中存在实现方式,可以参照制程检验单的实现方式进行。」
 *
 * 验什么(全程在**测试账套**上跑,造出来的单跑完删掉):
 *   ① 工具栏:有「取成型工艺清单」「选生产工单」,**没有**「检验项目/检验方案」;
 *   ② 取成型工艺清单:**按列合并** —— 先填两支样品的外径,再点带入 ⇒ 已填数据**还在**、列数不翻倍,
 *      提示里如实报出「保留已填数据 N 格」;
 *   ③ 选生产工单:弹窗能开、列出生产工单行、提示语是**首件检验单**、选中一行能建出首件检验单草稿,
 *      且该单表头带 工单号/工单行号、明细按成型工艺清单预铺(与自动出单同源)。
 *
 * 用法: node tools/archive/_probe-first-insp-toolbar.mjs [base] [factory]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const FACTORY = process.argv[3] || 'YJ_TEST'
const DB = FACTORY === 'YJ_TEST' ? 'HSDZ_MES_TEST' : 'HSDZ_MES'
const PORT = 9494
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fit-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let created = ''
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  const clickByText = async (text) => ev(`(() => {
    const el = [...document.querySelectorAll('button, .as-side-btn, [class*=as-side] span, .el-button')]
      .find((e) => (e.innerText || '').trim() === ${JSON.stringify(text)})
    if (!el) return false
    el.click(); return true
  })()`)
  const setInput = (selExpr, v) => ev(`(() => {
    const inp = ${selExpr}
    if (!inp) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, ${JSON.stringify(v)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  const cellOf = (colName, rowIdx) => `(() => {
    const label = (th) => (th.innerText || '') + ' ' + [...th.querySelectorAll('input')].map((i) => i.value).join(' ')
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    const idx = heads.findIndex((th) => label(th).includes(${JSON.stringify(colName)}))
    const tr = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')][${rowIdx}]
    return tr ? [...tr.querySelectorAll('td')][idx] : null
  })()`

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(3000)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(800)

  // ── ① 工具栏:该有的有、该没的没有 ─────────────────────────────────────────
  const actions = await ev(`(() => [...document.querySelectorAll('.approval-side [class*=as-side], .approval-side button')]
    .map((e) => (e.innerText || '').trim()).filter(Boolean))()`)
  console.log(`  工具栏=${JSON.stringify(actions)}`)
  ok('① 工具栏有「取成型工艺清单」', (actions || []).includes('取成型工艺清单'), JSON.stringify(actions))
  ok('① 工具栏有「选生产工单」', (actions || []).includes('选生产工单'), JSON.stringify(actions))
  ok('① 工具栏**没有**「检验项目/检验方案」', !(actions || []).includes('检验项目/检验方案'), JSON.stringify(actions))

  // 起一张新草稿(带图纸上的 10 列)
  await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
  await sleep(2800)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(900)

  // ── ② 取成型工艺清单:按列合并,已填数据保留 ───────────────────────────────
  const colsBefore = await ev(`document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head').length`)
  await setInput(`${cellOf('炭棒外径', 0)}.querySelector('input')`, '34.2')
  await setInput(`${cellOf('炭棒外径', 1)}.querySelector('input')`, '34.4')
  // 产品编号(表头第一格)→ 测试账套里有工艺清单的演示产品
  await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-head')
    const ths = [...t.querySelectorAll('th')]
    const i = ths.findIndex((th) => (th.innerText || '').trim() === '产品编号')
    const inp = [...t.querySelectorAll('td')][i].querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, 'DEMO-A-001'); inp.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
  await sleep(400)
  const clicked = await clickByText('取成型工艺清单')
  await sleep(2500)
  const msg = await ev(`[...document.querySelectorAll('.el-message')].map((m) => (m.innerText || '').trim()).join(' | ')`)
  console.log(`  带入提示=${JSON.stringify(String(msg).slice(0, 120))}`)
  ok('② 点得到「取成型工艺清单」', clicked === true, String(clicked))
  const v1 = await ev(`${cellOf('炭棒外径', 0)}?.querySelector('input')?.value`)
  const v2 = await ev(`${cellOf('炭棒外径', 1)}?.querySelector('input')?.value`)
  ok('② 带入后已填的实测数值**还在**(1# 34.2)', String(v1) === '34.2', `1#=${JSON.stringify(v1)}`)
  ok('② 带入后已填的实测数值**还在**(2# 34.4)', String(v2) === '34.4', `2#=${JSON.stringify(v2)}`)
  const colsAfter = await ev(`document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head').length`)
  ok('② 列数没翻倍(同名列是合并、不是又加一批)', Number(colsAfter) === Number(colsBefore),
    `带入前 ${colsBefore} 列 / 带入后 ${colsAfter} 列`)
  ok('② 提示里如实报出「保留已填数据」', /保留已填数据/.test(String(msg)), String(msg).slice(0, 120))
  // 出图(可选):带入后的纸面 + 顶部提示
  const shotIdx = process.argv.indexOf('--shot')
  const shotPrefix = shotIdx > 0 ? process.argv[shotIdx + 1] : ''
  const shoot = async (suffix) => {
    if (!shotPrefix) return
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(`${shotPrefix}-${suffix}.png`, Buffer.from(s.result.data, 'base64'))
    console.log(`  截图:${shotPrefix}-${suffix}.png`)
  }
  await shoot('merge')

  // ── ③ 选生产工单 → 建首件检验单草稿 ───────────────────────────────────────
  const opened = await clickByText('选生产工单')
  await sleep(2200)
  const tip = await ev(`(document.querySelector('.wopick-tip')?.innerText || '')`)
  ok('③ 弹出「选生产工单」且提示语是**首件检验单**', opened === true && /首件检验单/.test(String(tip)),
    `${opened} / ${String(tip).slice(0, 60)}`)
  const pickRows = await ev(`document.querySelectorAll('.el-dialog .el-table__body tbody tr').length`)
  ok('③ 弹窗列出了生产工单行', Number(pickRows) > 0, String(pickRows))
  await shoot('picker')
  // 选中第一行 → 确定
  await ev(`(() => { const tr=document.querySelector('.el-dialog .el-table__body tbody tr'); if(tr) tr.click(); return 'ok' })()`)
  await sleep(600)
  await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button')].find((x)=>(x.innerText||'').trim()==='确定'); if(b) b.click(); return 'ok' })()`)
  await sleep(3000)
  const msg2 = await ev(`[...document.querySelectorAll('.el-message')].map((m) => (m.innerText || '').trim()).join(' | ')`)
  console.log(`  建单提示=${JSON.stringify(String(msg2).slice(0, 120))}`)
  ok('③ 选中工单行 ⇒ 建出首件检验单(或命中已有)', /首件检验单/.test(String(msg2)), String(msg2).slice(0, 120))
  created = (String(msg2).match(/SJ-[0-9A-Za-z-]+/) || [''])[0]
  // 库里核对:表头带工单行键、明细按工艺清单预铺
  if (created) {
    const h = (await q(`SELECT ISNULL(工单号,'') AS 工单号, ISNULL(工单行号,0) AS 工单行号,
        ISNULL(产品编码,'') AS 产品编码 FROM dbo.qc_first_insp_head WHERE 单据编号=N'${created}'`))[0]
    ok('③ 新单绑了 工单号 + 工单行号', !!h && h.工单号 !== '' && Number(h.工单行号) > 0, JSON.stringify(h || {}))
    const n = (await q(`SELECT COUNT(*) AS n FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${created}'`))[0]?.n
    ok('③ 新单明细按成型工艺清单预铺(>0 行)', Number(n) > 0, `明细 ${n} 行`)
  } else {
    ok('③ 能从提示里取到新单号(便于清场)', false, String(msg2).slice(0, 120))
  }
  ok('④ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
  if (created) {
    await q(`DELETE FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${created}';
             DELETE FROM dbo.qc_first_insp_head WHERE 单据编号=N'${created}'`)
    console.log(`  清场:删掉探针建的 ${created}`)
  }
  await pool.close()
}
console.log(`\n== 首件检验单工具栏三件事:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
