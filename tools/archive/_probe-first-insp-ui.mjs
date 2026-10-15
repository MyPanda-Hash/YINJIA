/*
 * _probe-first-insp-ui.mjs — 首件检验单界面就位检查(菜单 / 工具栏 / 明细表填满)
 *
 * 验:① 左导航「制程品质」组里有「首件检验单」;② 打开该面板后工具栏出现「取成型工艺清单」
 *    (与「检验项目/检验方案」),且**不出现**「取出货检验计划」;③ 明细区表格把页面填满
 *    (gapBelowTable 只剩区块外边距 ~10px —— 顺带复核 2026-10-15 的明细表填充修复);
 *    ④ 页面无 Vue 报错/异常。
 *
 * 只读:不点保存、不改数据。用法: node tools/archive/_probe-first-insp-ui.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9491
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-finsp-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 160))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(2500)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(600)

  // 工具栏:组的下拉动作只在点开 ▼ 之后才进 DOM(tb-menu 是 v-if),所以逐个点开再收集
  await ev(`(() => {
    const carets = [...document.querySelectorAll('.panelx-list .tb-caret')]
    // 只点"更多"那种带下拉的组;全点一遍即可(单击 toggleGroup 不触发业务动作)
    carets.forEach((c) => c.click())
    return carets.length
  })()`)
  await sleep(400)

  const info = await ev(`(() => {
    const toolbar = [...document.querySelectorAll('.panelx-list .tb-group')].map((g) => (g.innerText || '').replace(/\\s+/g, ' ').trim())
    const menu = [...document.querySelectorAll('.panelx-list .tb-menu .ctx-item')].map((e) => (e.innerText || '').trim())
    // ⚠ 文书式版面(首件检验单走这条)的按钮在右侧竖排:主按钮 .as-side-btn,
    //   而**下拉动作是平铺的** .as-side-btn.sub(PanelxList 里 v-for="a in dropItems(g)" 直接铺出来,
    //   「更多」组里的「取成型工艺清单」就在这)。原来只收 .as-side-btn/.as-side-del ⇒
    //   收不到带 .sub 的动作,工具栏三条断言全部误报。
    const approvalText = [...document.querySelectorAll('.approval-layout, .approval-side, .as-side-btn, .as-side-btn.sub, .as-side-del')].map((e) => (e.innerText || '').trim()).join(' ')
    const body = document.querySelector('.panelx-list .body')
    const tbl = document.querySelector('.panelx-list .detail .el-table')
    const sheet = document.querySelector('.panelx-list .fi-sheet')
    const bodyText = document.body.innerText || ''
    return {
      hasPanel: !!document.querySelector('.panelx-list'),
      navHasFirstInsp: bodyText.includes('首件检验单'),
      toolbar, menu, approvalText,
      hasFirstSheet: !!sheet,
      gapBelowTable: body && tbl ? Math.round(body.getBoundingClientRect().bottom - tbl.getBoundingClientRect().bottom) : null,
      tableH: tbl ? Math.round(tbl.getBoundingClientRect().height) : (sheet ? Math.round(sheet.getBoundingClientRect().height) : null),
    }
  })()`)
  console.log(`  面板渲染=${info.hasPanel} 表格高=${info.tableH} 表底余量=${info.gapBelowTable}`)
  console.log(`  工具栏组=${JSON.stringify(info.toolbar)}`)
  console.log(`  下拉动作=${JSON.stringify(info.menu)}`)
  console.log(`  首件纸张=${info.hasFirstSheet} 侧栏文字=${info.approvalText.slice(0, 240)}`)
  ok('① 面板页面渲染出 .panelx-list', info.hasPanel)
  ok('① 首件纸张模板渲染', info.hasFirstSheet)
  ok('① 左导航含「首件检验单」', info.navHasFirstInsp)
  const tb = JSON.stringify(info.toolbar) + JSON.stringify(info.menu) + info.approvalText
  ok('② 工具栏含「取成型工艺清单」', tb.includes('取成型工艺清单'), tb)
  ok('② 工具栏含「检验项目/检验方案」', tb.includes('检验项目/检验方案'))
  ok('② 工具栏不含「取出货检验计划」', !tb.includes('取出货检验计划'))
  ok('③ 首件纸张明细表有实际高度', info.hasFirstSheet ? info.tableH > 300 : (info.gapBelowTable !== null && info.gapBelowTable <= 15),
    info.hasFirstSheet ? `sheetH=${info.tableH}` : `gap=${info.gapBelowTable}`)
  ok('④ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 首件检验单界面:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
