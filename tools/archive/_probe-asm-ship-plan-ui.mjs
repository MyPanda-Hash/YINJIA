/*
 * _probe-asm-ship-plan-ui.mjs — 组装成品检验单「检验项目维护 → 来源②出货检验计划」界面就位检查
 *
 * 验(只读,不点保存):① QC_ASM_INSP 打开「检验项目/检验方案」后,弹窗顶部出现来源切换
 *   「检验标准库 / 出货检验计划」;② 切到「出货检验计划」后按本单产品编码取到计划,
 *   表格出现计划里**已填**的 4 行(检验类别 必测项/型式检验 + 表区 外观/重要尺寸/重量/性能
 *   + 检查频率);③ 勾选后「带入明细」把 4 行写进本单明细,列上带着 检验要求/检验方法/检查频率;
 *   ④ 全程无未捕获异常。
 *
 * 前置夹具(仅测试账套):tools/archive/_probe-asm-ship-plan-fixture.sql
 * 用法:node tools/archive/_probe-asm-ship-plan-ui.mjs [base]   默认 http://localhost:5173
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const PORT = 9494
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败(测试账套 YJ_TEST)'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-asmship-'))
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
  let seq = 0; const pend = new Map(); const errs = []; const reqs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
    if (m.method === 'Network.requestWillBeSent' && String(m.params.request?.url || '').includes('fromShipPlan')) {
      reqs.push(m.params.request.url)
    }
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_ASM_INSP` })
  for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(3000)
  // 关掉可能的弹窗/告示
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(800)

  // 等「当前单据」就位:dev(5173)比打包版(8090)慢,3 秒固定等待会拿到空产品编码 ⇒ 请求根本不发,
  // 表现为一大堆假 FAIL。故轮询到列表带出单据号为止;一直不出来就点一下列表首行(点行即打开该单)。
  let docNo = null
  for (let i = 0; i < 50; i++) {
    await sleep(500)
    docNo = await ev(`(() => { const t=(document.querySelector('.panelx-list')||{}).innerText||''; const m=t.match(/ZJ-[0-9-]+/); return m?m[0]:null })()`)
    if (docNo) break
    if (i === 16) {
      const clicked = await ev(`(() => {
        const r = document.querySelector('.panelx-list .el-table__body .el-table__row')
        if (r) { r.click(); return true }
        return false
      })()`)
      console.log(`  (列表还没带出单据,点首行=${clicked})`)
    }
  }
  const head = await ev(`(() => {
    const list = document.querySelector('.panelx-list')
    return { hasPanel: !!list }
  })()`)
  console.log(`  当前单据=${docNo}`)
  ok('① 列表带出了当前单据(产品编码非空,计划才查得到)', !!docNo, `docNo=${docNo}`)

  // 展开工具栏下拉(动作在 .tb-menu 里,v-if 才进 DOM)
  await ev(`(() => { [...document.querySelectorAll('.panelx-list .tb-caret')].forEach((c) => c.click()); return 'ok' })()`)
  await sleep(500)
  const menu = await ev(`(() => [...document.querySelectorAll('.panelx-list .tb-menu .ctx-item')].map((e) => (e.innerText || '').trim()))()`)
  console.log(`  下拉动作=${JSON.stringify(menu)}`)
  ok('① 工具栏含「检验项目/检验方案」', JSON.stringify(menu).includes('检验项目/检验方案'), JSON.stringify(menu))

  // 点开维护弹窗
  const opened = await ev(`(() => {
    const el = [...document.querySelectorAll('.panelx-list .tb-menu .ctx-item')].find((e) => (e.innerText || '').trim() === '检验项目/检验方案')
    if (!el) return false
    el.click(); return true
  })()`)
  ok('① 点开了维护弹窗', opened)
  await sleep(2500)

  const dlg = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    if (!d) return { found: false }
    const radios = [...d.querySelectorAll('.el-radio-button__inner')].map((e) => (e.innerText || '').trim())
    return { found: true, radios, tip: (d.innerText || '').slice(0, 120) }
  })()`)
  console.log(`  弹窗=${dlg.found} 来源切换=${JSON.stringify(dlg.radios)}`)
  ok('① 弹窗渲染', dlg.found)
  ok('① 出现来源切换「检验标准库 / 出货检验计划」',
    dlg.found && dlg.radios.includes('检验标准库') && dlg.radios.includes('出货检验计划'), JSON.stringify(dlg.radios))

  // 切到「出货检验计划」
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const r = [...d.querySelectorAll('.el-radio-button__inner')].find((e) => (e.innerText || '').trim() === '出货检验计划')
    if (r) r.click()
    return 'ok'
  })()`)
  await sleep(3000)

  const ship = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    if (!d) return { found: false }
    const rows = [...d.querySelectorAll('.el-table__body .el-table__row')].map((r) =>
      [...r.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\\s+/g, ' ').trim()))
    return {
      found: true,
      header: [...d.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').trim()).filter(Boolean),
      rows,
      tips: (d.innerText || '').replace(/\\s+/g, ' ').slice(0, 400),
    }
  })()`)
  console.log(`  计划表头=${JSON.stringify(ship.header)}`)
  console.log(`  计划行数=${ship.rows?.length}`)
  ;(ship.rows || []).forEach((r, i) => console.log(`   行${i + 1}=${JSON.stringify(r)}`))
  ok('② 请求打到 /qc/inspPlan/fromShipPlan', reqs.some((u) => u.includes('productCode=20200040001')), JSON.stringify(reqs))
  ok('② 计划明细取到 4 行', (ship.rows || []).length === 4, `rows=${(ship.rows || []).length}`)
  // 2026-10-15 用户口径:「可获取的内容就是当前出货检验计划里填写的内容」⇒ 列与计划表界面一致
  const WANT_COLS = ['序号', '检验项目', '检验要求', '检验方法', '不合格应对措施', '检查频率', '备注']
  const gotCols = (ship.header || []).filter(Boolean)
  ok('② 弹窗列 = 计划表界面上那 7 列',
    WANT_COLS.every((c) => gotCols.includes(c)) && gotCols.length === WANT_COLS.length,
    `got=${JSON.stringify(gotCols)}`)
  ok('② 不多显示计划表里的隐藏列(检验类别/表区/检验仪器)',
    !gotCols.includes('检验类别') && !gotCols.includes('表区') && !gotCols.includes('检验仪器'),
    JSON.stringify(gotCols))
  const flat = JSON.stringify(ship.rows || [])
  ok('② 带出「序号」(计划里填的 10/20/30/40)',
    ['"10"', '"20"', '"30"', '"40"'].every((s) => flat.includes(s)), flat.slice(0, 200))
  ok('② 带出「备注」(计划里填的 每批首件必看 / 首件+巡检 / 半年一次)',
    ['每批首件必看', '首件+巡检', '半年一次'].every((k) => flat.includes(k)), '')
  ok('② 带出检查频率(1PCS/一个生产批次 · 型式检验)',
    flat.includes('1PCS/一个生产批次') && flat.includes('型式检验'), '')

  // 勾选全部 → 带入明细
  // 基线用「带进来的 4 个项目名在明细里出现几次」而不是行数:明细表分页/占位行会让总数不稳
  const NAMES = /外观-端盖两头|尺寸-外径|出货重量|余氯去除率/
  const beforeRows = await ev(`(() => [...document.querySelectorAll('.panelx-list .detail .el-table__body .el-table__row')]
    .map((r) => (r.innerText || '').replace(/\\s+/g, ' ').trim()))()`)
  const before = beforeRows.filter((r) => NAMES.test(r)).length
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const cb = d.querySelector('.el-table__header .el-checkbox')
    if (cb) cb.click()
    return 'ok'
  })()`)
  await sleep(700)
  const picked = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const t = (d.querySelector('.qcplan-count') || {}).innerText || ''
    const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.innerText || '').trim() === '带入明细')
    return { count: t.trim(), disabled: btn ? btn.disabled : null, hasBtn: !!btn }
  })()`)
  console.log(`  已选=${picked.count} 带入按钮=${picked.hasBtn} disabled=${picked.disabled}`)
  ok('③ 勾选后「带入明细」可用', picked.hasBtn && picked.disabled === false, JSON.stringify(picked))

  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('检验项目/检验方案'))
    const btn = [...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.innerText || '').trim() === '带入明细')
    if (btn) btn.click()
    return 'ok'
  })()`)
  await sleep(2500)

  const after = await ev(`(() => {
    const list = document.querySelector('.panelx-list')
    const rows = [...list.querySelectorAll('.detail .el-table__body .el-table__row')].map((r) => (r.innerText || '').replace(/\\s+/g, ' ').trim())
    return { n: rows.length, rows, msg: (document.querySelector('.el-message') || {}).innerText || '' }
  })()`)
  console.log(`  明细里计划项目 ${before} → ${after.rows.filter((r) => NAMES.test(r)).length};提示=${JSON.stringify(after.msg)}`)
  after.rows.slice(-6).forEach((r) => console.log(`   明细=${r.slice(0, 160)}`))
  ok('③ 明细新增 4 行计划项目', after.rows.filter((r) => NAMES.test(r)).length === 4,
    `before=${before} after=${after.rows.filter((r) => NAMES.test(r)).length}`)
  ok('③ 原有「数量判定」行未被覆盖', after.rows.some((r) => r.includes('数量判定')), '')
  const detailFlat = JSON.stringify(after.rows)
  ok('③ 明细里带上了计划的项目名', ['外观-端盖两头', '尺寸-外径', '出货重量', '余氯去除率'].every((k) => detailFlat.includes(k)), '')
  ok('③ 明细里带上了检验要求(控制标准及要求)', detailFlat.includes('44.5±0.5') || detailFlat.includes('44.5'), '')
  ok('③ 明细里带上了检查频率(本次新写的列)', detailFlat.includes('1PCS/一个生产批次'), '')
  // 表区不在弹窗里显示,但**带入时必须写**:组装成品检验单的打印报表按它分「外观/尺寸/重量」组
  // (计划表里它叫「检验内容」,是填了但界面上隐藏的列)。重要尺寸/性能 这两个值只可能来自它。
  ok('③ 表区仍按计划的「检验内容」写入(重要尺寸/性能 —— 报表分组靠它)',
    detailFlat.includes('重要尺寸') && detailFlat.includes('性能'), detailFlat.slice(-400))
  ok('④ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 组装成品检验单·出货检验计划来源:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
