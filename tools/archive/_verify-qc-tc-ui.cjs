/**
 * _verify-qc-tc-ui.cjs — 特采(暂收退料单明细 bool 字段)的**界面**验证(2026-10-04,含同日修订)
 *
 * 用户口径(修订后):「应该是**一个明细的 bool 字段**不是按钮,删除按钮。」—— 在暂收退料单上。
 * 后端链路已由 _verify-qc-tc-via-return.ps1 覆盖;本探针只看界面:
 *   ① 暂收退料单**工具栏已经没有**「特采」按钮了;
 *   ② 明细表里**有「特采」列**(是否开关)与只读「送检数量」列,值 = 来料检验单送检数量;
 *   ③ 在界面上**真勾一次**那个开关 → 点工具栏「保存」→ 库里 特采=1(证明字段可见、可勾、能落库);
 *   ④ 界面上点「审核」→(确认弹窗)库里自动生成特采单(勾选→审核→特采 这条链在界面上跑通);
 *   ⑤ 来料检验单明细**没有**「特采」列;
 *   ⑥ 切英语后「特采」列头 = Special acceptance(多语言)。
 * 跑在**测试账套**(factory=YJ_TEST),自己造数据。
 * 用法:node tools/archive/_verify-qc-tc-ui.cjs     (env: YJ_HEADLESS=0 可开有头)
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { createRequire } = require('node:module')

const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const BASE = API.replace(/\/api$/, '')
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'
const PORT = Number(process.env.YJ_CDP_PORT || 9379)
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const HEADLESS = process.env.YJ_HEADLESS !== '0'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++ }
const info = (msg) => console.log(`         ${msg}`)
const N = (v) => (v === null || v === undefined ? null : String(v).trim())

async function main() {
  if (!EDGE) { console.error('未找到 Edge'); process.exit(1) }
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const q = async (s) => (await new mssql.Request(pool).query(s)).recordset

  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!lj?.data?.token) { console.error('登录失败'); await pool.close(); process.exit(1) }
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (url, body) => {
    const j = await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
    if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`)
    return j.data
  }
  const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f || {}, buttonParam: {} })

  // ── 造数:检验单(1 不良行,送检 30 / 不合格 10)→ 审核 → 暂收退料单**草稿**(留给人来勾特采)──
  const inv = (await q(`SELECT TOP 1 存货编码 FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' AND 存货名称 IS NOT NULL`))[0]['存货编码']
  const inspNo = (await cb('QC_INSP', '保存', {})).编号
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  await cb('QC_INSP', '保存为草稿', {
    编号: inspNo, 单据日期: today, 供应商: '界面验证供应商', 业务员: 'admin',
    detail: { items: [
      { 物料编码: inv, 物料名称: '界面验证料', 规格型号: 'UI-SPEC', 送检数量: 30, 合格数量: 0, 不合格数量: 10, 计量单位: 'kg', 单价: 1 },
    ] },
  })
  await cb('QC_INSP', '审核', { 编号: inspNo })
  const l = (await q(`SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP'
    AND source_form_no='${inspNo}' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'`))[0]
  if (!l) { console.error('造数失败:检验单审核没生成暂收退料单'); await pool.close(); process.exit(1) }
  const thNo = N(l.target_form_no)
  console.log(`=== 暂收退料单 ${thNo}(草稿,来源检验单 ${inspNo},送检 30 / 不合格 10)===`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-tcui-'))
  const args = ['--no-first-run', '--window-size=1560,980', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank']
  if (HEADLESS) args.unshift('--headless=new')
  const edge = spawn(EDGE, args, { stdio: 'ignore' })
  let ws
  try {
    let tab = null
    for (let i = 0; i < 40 && !tab; i++) { await sleep(400); try { tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json() } catch { /* 未就绪 */ } }
    if (!tab) throw new Error('CDP 未就绪')
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (d) => {
      let m; try { m = JSON.parse(typeof d.data === 'string' ? d.data : d.data.toString()) } catch { return }
      if (m.method === 'Page.javascriptDialogOpening') { send('Page.handleJavaScriptDialog', { accept: true }); return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) throw new Error('页面求值异常:' + JSON.stringify(r.result.exceptionDetails).slice(0, 260))
      return r.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
    await ev(`(function(){
      localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
      localStorage.setItem('mes_factory', '"YJ_TEST"'); return 'ok' })()`)

    let bootSeq = 0
    const openPanel = async (panel, docNo) => {
      const url = `${BASE}/?_boot=${++bootSeq}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}`
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break }
      for (let i = 0; i < 80; i++) {
        const n = await ev(`document.querySelectorAll('.tb-group').length`)
        if (n > 0) { await sleep(1800); return n }
        await sleep(300)
      }
      return 0
    }
    const toolbar = () => ev(`(function(){
      return JSON.stringify(Array.from(document.querySelectorAll('.tb-group')).map(function(g){
        const main = g.querySelector('.tb-main')
        return { name: (main.querySelector('.act-name')||{}).textContent ? main.querySelector('.act-name').textContent.trim() : '',
                 disabled: main.classList.contains('disabled') }
      })) })()`)
    /**
     * 点工具栏某个动作:先找**主按钮显示名**就等于该动作的组;找不到就逐组展开下拉找同名项。
     * ⚠ 不能拿「审批」组的主按钮当「审核」—— normalizeApprovalGroups 合并后的组主按钮取 actions[0],
     *   实测那一下点的是**提交审批**(会把单据送到审批中,而不是审核)。所以一律走下拉开找。
     */
    const clickAction = async (action) => {
      const r1 = await ev(`(function(){
        const g = Array.from(document.querySelectorAll('.tb-group'))
          .find(function(x){ const n = x.querySelector('.tb-main .act-name'); return n && n.textContent.trim() === ${JSON.stringify(action)} })
        if (!g) return 'no-group'
        if (g.querySelector('.tb-main').classList.contains('disabled')) return 'disabled'
        g.querySelector('.tb-main').click(); return 'ok-main' })()`)
      if (r1 === 'ok-main') { await sleep(1200); return r1 }
      // 下发扫描:⚠ 必须**一次点击一次求值**(中间给 Vue 一个 tick),
      //   把 caret.click() 与查 .tb-menu 写在同一个表达式里时 DOM 还没渲染出来 → 永远 no-item(踩过)
      const caretCount = await ev(`document.querySelectorAll('.tb-group .tb-caret').length`)
      for (let i = 0; i < caretCount; i++) {
        const opened = await ev(`(function(){
          const c = document.querySelectorAll('.tb-group .tb-caret')[${i}]
          if (!c) return 'no-caret'
          c.click(); return 'opened' })()`)
        if (opened !== 'opened') continue
        await sleep(450)
        const hit = await ev(`(function(){
          const it = Array.from(document.querySelectorAll('.tb-menu .ctx-item'))
            .find(function(x){ return x.textContent.trim() === ${JSON.stringify(action)} })
          if (!it) return 'miss'
          it.click(); return 'ok-menu' })()`)
        if (hit === 'ok-menu') { await sleep(1500); return hit }
        await ev(`(function(){
          const c = document.querySelectorAll('.tb-group .tb-caret')[${i}]
          if (c) c.click(); return 'closed' })()`)
        await sleep(250)
      }
      return 'no-item'
    }
    /** 关掉 ElMessageBox 确认弹窗(点主按钮) */
    const confirmBox = async () => {
      for (let i = 0; i < 30; i++) {
        const r = await ev(`(function(){
          const b = document.querySelector('.el-message-box__btns button.el-button--primary')
          if (!b) return 'none'
          b.click(); return 'clicked' })()`)
        if (r === 'clicked') { await sleep(1500); return true }
        await sleep(300)
      }
      return false
    }
    /** 读明细表:列头 + 首行文本 + 指定列是不是 el-switch */
    const strip = (s) => String(s).replace(/[⇅↕▲▼]+/g, '').trim()
    const readGrid = (colName) => ev(`(function(){
      const t = document.querySelector('.el-table')
      if (!t) return null
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()}).filter(Boolean)
      const tr = Array.from(t.querySelectorAll('.el-table__body tbody tr')).find(function(r){ return r.textContent.trim() !== '' })
      const cells = tr ? Array.from(tr.querySelectorAll('td')) : []
      const i = ths.map(function(x){ return x.replace(/[⇅↕▲▼]+/g,'').trim() }).indexOf(${JSON.stringify(colName)})
      return JSON.stringify({ ths: ths,
        first: cells.map(function(x){ return x.textContent.trim() }),
        switchCount: cells.length && i >= 0 && cells[i] ? cells[i].querySelectorAll('.el-switch').length : -1 }) })()`)
    /**
     * 点明细首行指定列的开关。
     * ⚠ 平台是**编辑器懒渲染**(PanelxList `<template v-else-if="isActiveCell(...)">`):
     *   单元格平时只显示纯文本(是/否),**先点一下单元格**才会挂载 el-switch。所以这里两步走。
     */
    const toggleSwitch = async (colName) => {
      const cell = `(function(){
        const t = document.querySelector('.el-table')
        if (!t) return null
        const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){ return x.textContent.trim().replace(/[⇅↕▲▼]+/g,'').trim() })
        const i = ths.indexOf(${JSON.stringify(colName)})
        if (i < 0) return null
        const tr = Array.from(t.querySelectorAll('.el-table__body tbody tr')).find(function(r){ return r.textContent.trim() !== '' })
        if (!tr) return null
        const td = tr.querySelectorAll('td')[i]
        return td || null })()`
      const r1 = await ev(`(function(){
        const td = ${cell}
        if (!td) return 'no-cell'
        const sw = td.querySelector('.el-switch')
        if (sw) { sw.click(); return 'clicked-switch' }
        const lazy = td.querySelector('.cell-lazy')
        if (lazy) { lazy.click(); return 'activated' }
        return 'no-target' })()`)
      if (r1 === 'clicked-switch') { await sleep(800); return 'clicked' }
      if (r1 !== 'activated') return r1
      await sleep(700)
      const r2 = await ev(`(function(){
        const td = ${cell}
        if (!td) return 'no-cell'
        const sw = td.querySelector('.el-switch')
        if (!sw) return 'no-switch-after-activate'
        sw.click(); return 'clicked' })()`)
      await sleep(800)
      return r2
    }
    const toast = () => ev(`(function(){ const m = document.querySelector('.el-message'); return m ? m.textContent.trim() : null })()`)

    console.log('\n=== ① 暂收退料单:工具栏已无「特采」按钮 ===')
    await openPanel('QC_RETURN', thNo)
    const tb = JSON.parse(await toolbar())
    info('工具栏: ' + tb.map((x) => x.name + (x.disabled ? '(灰)' : '')).join(' / '))
    ok(!tb.some((x) => x.name === '特采'), '工具栏没有「特采」按钮(已按口径删除)')
    ok(tb.some((x) => x.name === '保存' && !x.disabled), '草稿单的「保存」可点')

    console.log('\n=== ② 明细表:「特采」是可勾的字段(不是按钮),旁边就是只读「送检数量」 ===')
    const g1 = JSON.parse(await readGrid('特采') || 'null')
    if (!g1) { ok(false, '没读到明细表') } else {
      g1.ths = g1.ths.map(strip)
      info('明细列: ' + g1.ths.join('/'))
      ok(g1.ths.includes('特采'), '明细有「特采」列')
      // ⚠ 平台是**编辑器懒渲染**:未激活的单元格只显示纯文本(是/否),点一下才挂载 el-switch。
      //   故这里只断言"该列在、且初始是 是否 文本";真正可勾由 ③(点单元格→开关→保存→落库)证明。
      const ti = g1.ths.indexOf('特采')
      const tv = ti >= 0 ? N(g1.first[ti]) : null
      ok(tv === '否' || tv === '是', `「特采」列初值是 是否 文本(实得 ${JSON.stringify(tv)}),点单元格后挂开关`) 
      const i = g1.ths.indexOf('送检数量')
      ok(i >= 0, '明细有「送检数量」列')
      if (i >= 0) ok(Number(N(g1.first[i])) === 30, `「送检数量」值 = ${N(g1.first[i])}(应为 30)`)
    }

    console.log('\n=== ③ 界面上真勾一次「特采」→ 点工具栏「保存」→ 库里落 1 ===')
    const clicked = await toggleSwitch('特采')
    ok(clicked === 'clicked', `勾选「特采」开关(${clicked})`)
    ok((await clickAction('保存')) !== 'no-group', '点了工具栏「保存」')
    let flag = null
    for (let i = 0; i < 30; i++) {
      await sleep(500)
      flag = N((await q(`SELECT CAST(ISNULL(特采,0) AS int) AS f FROM qc_return_detail WHERE 单据编号='${thNo}'`))[0]?.f)
      if (flag === '1') break
    }
    ok(flag === '1', `库里 qc_return_detail.特采 = ${flag}(界面勾选→保存 这条路走得通)`)

    console.log('\n=== ④ 界面上点「审核」→ 自动生成特采单 ===')
    const audited = await clickAction('审核')
    info('点「审核」返回: ' + audited)
    await confirmBox()
    let tcNo = null
    for (let i = 0; i < 30; i++) {
      await sleep(500)
      tcNo = N((await q(`SELECT target_form_no AS n FROM form_flow_link WHERE source_panel_code='QC_RETURN'
        AND source_form_no='${thNo}' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'`))[0]?.n)
      if (tcNo) break
    }
    ok(!!tcNo, `审核后自动生成特采单 ${N(tcNo)}`)
    if (tcNo) {
      const t = (await q(`SELECT 总数量, 不合格品数量, 暂收退料单号 FROM qc_tc_in WHERE 单据编号='${tcNo}'`))[0]
      info(`特采单 ${tcNo} 总数量=${N(t?.总数量)} 不合格品数量=${N(t?.不合格品数量)} 暂收退料单号=${N(t?.暂收退料单号)}`)
      ok(Number(String(t?.总数量).replace(/[^\d.]/g, '')) === 30, '特采单总数量 = 退料行送检数量 30')
      ok(N(t?.暂收退料单号) === thNo, '特采单头记录暂收退料单号')
    }

    console.log('\n=== ⑤ 来料检验单:明细已无「特采」列 ===')
    await openPanel('QC_INSP', inspNo)
    const g2 = JSON.parse(await readGrid('送检数量') || 'null')
    if (!g2) { ok(false, '没读到检验单明细表') } else {
      g2.ths = g2.ths.map(strip)
      ok(!g2.ths.includes('特采'), `检验单明细无「特采」列(列头: ${g2.ths.join('/')})`)
    }

    console.log('\n=== ⑥ 多语言:切英语后「特采」列头 = Special acceptance ===')
    await ev(`(function(){ localStorage.setItem('mes_locale','en'); return 'ok' })()`)
    await openPanel('QC_RETURN', thNo)
    const g3 = JSON.parse(await readGrid('Special acceptance') || 'null')
    if (!g3) { ok(false, '英语下没读到明细表') } else {
      g3.ths = g3.ths.map(strip)
      info('EN 明细列: ' + g3.ths.join('/'))
      ok(g3.ths.includes('Special acceptance'), '「特采」在英语下 = Special acceptance')
      ok(!g3.ths.includes('特采'), '英语下没有残留中文列头「特采」')
    }
  } finally {
    try { ws && ws.close() } catch { /* ignore */ }
    try { edge.kill() } catch { /* ignore */ }
    await pool.close()
  }
  console.log('')
  if (fails === 0) { console.log('RESULT: PASS'); process.exit(0) }
  console.log(`RESULT: FAIL-${fails}`); process.exit(1)
}

main().catch((e) => { console.error('探针异常:', e); process.exit(1) })
