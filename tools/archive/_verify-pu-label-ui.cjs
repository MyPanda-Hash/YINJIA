/**
 * _verify-pu-label-ui.cjs — 材料码打印 + **隔离行**的界面验证(2026-10-04 二次口径)
 *
 * 用户口径:「打印后的那一行是**已经从原来数量隔离出来的**,没有作废之前是不会与生单有关联的,
 * 并且用它生单后打印弹窗会显示已经生单。」按此重做后的界面行为:
 *   ① 采购订单 →「打印」→「打印材料码」→ 弹窗:批次号按公式预填且**可改**;
 *   ② 改号 + 填量 + 「确定并打印」→ 库里真的登记了那张打印单;
 *   ③ 「生单」→「生成送料暂收单」弹窗是**上下两层**:
 *      · 上层 = 采购订单原行,「数量」已扣掉打印量(400→350),**没有**批次号列;
 *      · 下层(.bsd-printed「已打印待生单」)= 隔离行:批次号 = 材料码上的号、打印数量 = 打印量、状态 = 「已打印」;
 *   ④ 勾下层隔离行 → 顶部「批次号」自动**锁定**为该号(输入框 disabled);
 *   ⑤ 确定生单 → 暂收单批次号 = 材料码上的号;
 *   ⑥ **重新打开生单弹窗** → 该隔离行**仍在下层表里**,状态变「已生单」、未生单 0、**勾选框不可点**。
 *
 * 跑在**测试账套**(factory=YJ_TEST),自己造数据、跑完清理。
 * 用法:node tools/archive/_verify-pu-label-ui.cjs   (env: YJ_HEADLESS=0 可开有头)
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { createRequire } = require('node:module')

const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const BASE = API.replace(/\/api$/, '')
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'
const PORT = Number(process.env.YJ_CDP_PORT || 9372)
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
  const one = async (s) => (await q(s))[0] || null
  const dstr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d || new Date()).replace(/-/g, '')

  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!lj?.data?.token) { console.error('登录失败'); await pool.close(); process.exit(1) }
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (url, body) => {
    const j = await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
    if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 240)}`)
    return j.data
  }
  const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f || {}, buttonParam: {} })

  let pick = null
  for (const r of ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [])) {
    if (N(r['单据状态']) !== '已审核') continue
    const no = N(r['单据编号'])
    let ls; try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }) } catch { continue }
    const line = (ls?.lines || []).find((x) => x.rowKind === 'order' && Number(x.剩余数量) >= 20 && Number(x.可送上限) >= 20)
    if (line) { pick = { no, line, supplier: N(r['供应商编码']) }; break }
  }
  if (!pick) { console.error('找不到合适的采购订单'); await pool.close(); process.exit(1) }
  const EXPECT_AUTO = `${String(pick.supplier || '').replace(/^YJ-/i, '')}-${dstr()}`
  const MY_BATCH = `隔离-${dstr()}`
  const ORDER_QTY = Number(pick.line.订单数量 ?? pick.line.数量)
  const PRINT_QTY = Math.min(50, Number(pick.line.可送上限))
  console.log(`=== 采购订单 ${pick.no}(供应商 ${pick.supplier})行 ${pick.line.行号} 订单数量 ${ORDER_QTY} ===`)
  console.log(`    公式预填号 ${EXPECT_AUTO} / 本探针改用的号 ${MY_BATCH} / 打印量 ${PRINT_QTY}`)

  const created = []
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mlq-'))
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
      // 打印会开新窗口,headless 下可能被拦 → alert 会**阻塞页面**,自动关掉免得探针挂死
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
        const n = await ev(`document.querySelectorAll('.header-fields .field').length`)
        if (n > 0) { await sleep(1500); return n }
        await sleep(300)
      }
      return 0
    }
    const clickToolbar = async (group, item) => {
      const r = await ev(`(function(){
        const g = Array.from(document.querySelectorAll('.tb-group'))
          .find(function(x){ const n = x.querySelector('.tb-main .act-name'); return n && n.textContent.trim() === ${JSON.stringify(group)} })
        if (!g) return 'no-group'
        const caret = g.querySelector('.tb-caret')
        if (caret) caret.click(); else g.querySelector('.tb-main').click()
        return 'ok'
      })()`)
      await sleep(800)
      if (item) {
        const r2 = await ev(`(function(){
          const it = Array.from(document.querySelectorAll('.tb-menu .ctx-item'))
            .find(function(x){ return x.textContent.trim() === ${JSON.stringify(item)} })
          if (!it) return 'no-item'
          it.click(); return 'ok'
        })()`)
        await sleep(900)
        return `${r}/${r2}`
      }
      return r
    }
    /** 读**一张** el-table:列头 + 每行「列头 → 单元格文本」+ 勾选框是否禁用
     *  (el-table 渲染成**两张独立 table**:表头一张、表体一张,所以要分开取 thead/tbody) */
    const readTable = (sel) => ev(`(function(){
      const t = document.querySelector(${JSON.stringify(sel)})
      if (!t) return null
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
      const trs = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })
      return JSON.stringify({ ths: ths, rows: trs.map(function(tr){
        const tds = Array.from(tr.querySelectorAll('td'))
        const o = {}
        ths.forEach(function(h, i){ if (h && tds[i]) o[h] = tds[i].textContent.trim() })
        o.禁勾 = !!tr.querySelector('.el-checkbox.is-disabled')
        return o
      }) })
    })()`)
    /** 生单弹窗是**上下两层**:上层 .bsd 里的表 = 原行;下层 .bsd-printed 里的表 = 已打印隔离行 */
    const readSendTable = async () => {
      const [top, bottom] = await Promise.all([
        readTable('.bsd > .el-table'),
        readTable('.bsd-printed .el-table'),
      ])
      return JSON.stringify({ top: JSON.parse(top || 'null'), 下: JSON.parse(bottom || 'null') })
    }
    /** 在下层「已打印待生单」表里勾选指定批次号那一行 */
    const checkPrintedRow = (batch) => ev(`(function(){
      const t = document.querySelector('.bsd-printed .el-table')
      if (!t) return 'no-table'
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
      const i = ths.findIndex(function(x){ return x.indexOf('批次号') >= 0 })
      const trs = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })
      const tr = trs.find(function(r){ const td = r.querySelectorAll('td')[i]; return td && td.textContent.trim() === ${JSON.stringify(batch)} })
      if (!tr) return 'no-row'
      const cbx = tr.querySelector('.el-checkbox')
      if (!cbx) return 'no-checkbox'
      cbx.click(); return 'checked'
    })()`)

    // ============ ① 打印材料码弹窗 ============
    console.log('\n=== ① 采购订单 →「打印」→「打印材料码」→ 弹窗 ===')
    await openPanel('PU_ORDER', pick.no)
    info(`点击工具栏:${await clickToolbar('打印', '打印材料码')}`)
    let dlg = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      dlg = await ev(`(function(){ const i = document.querySelector('.mlq-batch-inp input'); return i ? i.value : null })()`)
      if (dlg !== null && dlg !== undefined) break
    }
    ok(N(dlg) === EXPECT_AUTO, `「批次号」按公式**预填** = ${EXPECT_AUTO}(实得 ${JSON.stringify(dlg)})`)

    // ============ ② 改号 + 选一行填量 + 确定并打印(2026-10-04 起**单选**:一次只打一行) ============
    console.log('\n=== ② 改批次号 → 选一行填量 → 确定并打印 → 库里真的登记了 ===')
    const typed = await ev(`(function(){
      const i = document.querySelector('.mlq-batch-inp input')
      if (!i) return 'no-input'
      if (i.disabled || i.readOnly) return 'locked'
      i.value = ${JSON.stringify(MY_BATCH)}
      i.dispatchEvent(new Event('input', { bubbles: true }))
      i.dispatchEvent(new Event('change', { bubbles: true }))
      return i.value
    })()`)
    ok(N(typed) === MY_BATCH, `「批次号」**可改**,已改成 ${MY_BATCH}`)
    // ⚠ 打印弹窗**默认全选**有可打量的行 ⇒ 先「清空」再只勾第一行(2026-10-04 探针首版就栽在这)
    await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.el-dialog button')).find(function(x){ return x.textContent.trim() === '清空' })
      if (b) b.click(); return b ? 'cleared' : 'no-btn' })()`)
    await sleep(500)
    const pickRow = (idx) => ev(`(function(){
      const t = document.querySelector('.mlq .el-table')
      const trs = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })
      const tr = trs[${idx}]
      if (!tr) return 'no-row'
      const cbx = tr.querySelector('.el-checkbox')
      if (!cbx) return 'no-checkbox'
      cbx.click(); return 'clicked'
    })()`)
    info(`勾第 1 行:${await pickRow(0)}`)
    await sleep(500)
    const checkedState = () => ev(`(function(){
      const t = document.querySelector('.mlq .el-table')
      const trs = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })
      return JSON.stringify(trs.map(function(tr){ return !!tr.querySelector('.el-checkbox.is-checked') }))
    })()`)
    info(`勾选态:${await checkedState()}`)
    const setQty2 = await ev(`(function(){
      const t = document.querySelector('.mlq .el-table')
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
      const i = ths.findIndex(function(x){ return x.indexOf('本次打印数量') >= 0 })
      const tr = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })[0]
      if (!tr) return 'no-row'
      const inp = tr.querySelectorAll('td')[i].querySelector('input')
      if (!inp) return 'no-input'
      inp.value = ${JSON.stringify(String(PRINT_QTY))}
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      return inp.value
    })()`)
    info(`本次打印数量设为 ${setQty2}`)
    info(`点击「确定并打印」:${await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.el-dialog button')).find(function(x){ return x.textContent.trim() === '确定并打印' })
      if (!b) return 'no-btn'; b.click(); return 'ok' })()`)}`)
    await sleep(3000)
    const made = await one(`SELECT TOP 1 单据编号 no, 批次号 b FROM bd_pu_label
      WHERE 采购订单号=N'${pick.no}' AND 批次号=N'${MY_BATCH}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`)
    ok(N(made?.b) === MY_BATCH, `界面上改的号登记成了打印单(${JSON.stringify(made?.no)} → ${JSON.stringify(made?.b)})`)
    ok(Number((await one(`SELECT COUNT(*) n FROM bd_pu_label WHERE 采购订单号=N'${pick.no}' AND ISNULL(asp_cancel,'N')<>'Y'`))?.n) === 1,
      `只勾一行 ⇒ **只出 1 张打印单**`)
    const madeQty = await one(`SELECT ISNULL(SUM(打印数量),0) q, COUNT(*) n FROM bl_pu_label WHERE 单据编号=N'${made?.no}' AND ISNULL(asp_cancel,'N')<>'Y'`)
    ok(Number(madeQty?.q) === PRINT_QTY && Number(madeQty?.n) === 1,
      `只登记了这一行、打印量 = ${PRINT_QTY}(实得 合计 ${madeQty?.q} / ${madeQty?.n} 行)`)
    ok(!(await one(`SELECT TOP 1 单据编号 no FROM bl_pu_label WHERE 单据编号=N'${made?.no}' AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([采购订单行id],0) <> ${Number(pick.line.id)}`)),
      `另一行**没有**被顺手打出去(只打印勾选的那一行)`)
    // ⑧ 打印弹窗记录里应显示「未生单 = 打印量」(此刻还没生单)
    {
      let rec = null
      for (let i = 0; i < 30; i++) {
        await sleep(400)
        rec = await ev(`(function(){
          const el = document.querySelector('.mlq-records .el-table')
          if (!el) return null
          const ths = Array.from(el.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
          const iP = ths.findIndex(function(x){ return x.indexOf('打印量') >= 0 })
          const iG = ths.findIndex(function(x){ return x.indexOf('已生单') >= 0 })
          const tr = Array.from(el.querySelectorAll('.el-table__body tbody tr')).find(function(r){ return r.textContent.trim() !== '' })
          if (!tr) return null
          const tds = Array.from(tr.querySelectorAll('td'))
          return JSON.stringify({ 打印量: tds[iP] && tds[iP].textContent.trim(), 已生单: tds[iG] && tds[iG].textContent.trim() })
        })()`)
        if (rec) break
      }
      const R0 = JSON.parse(rec || '{}')
      info(`打印弹窗「已打印记录」:${rec}`)
      ok(Number(R0.打印量) === PRINT_QTY && Number(R0.已生单) === 0,
        `记录里打印量 ${PRINT_QTY}、已生单 0(还没生单;实得 ${JSON.stringify(R0)})`)
    }

    // ②b 「重打」:同一张单原样再打一遍 ⇒ 打印次数 +1,**预约不变**(纸卡了/打歪了用这个,不是重新打一张)
    {
      const hit = await ev(`(function(){
        const el = document.querySelector('.mlq-records .el-table')
        if (!el) return 'no-table'
        const row = Array.from(el.querySelectorAll('.el-table__body tbody tr')).find(function(r){ return r.textContent.trim() !== '' })
        const btn = row && Array.from(row.querySelectorAll('button')).find(function(b){ return b.textContent.trim() === '重打' })
        if (!btn) return 'no-btn'
        btn.click(); return 'ok' })()`)
      info(`点记录行「重打」:${hit}`)
      await sleep(2500)
      const rp = await one(`SELECT ISNULL([打印次数],0) t FROM bd_pu_label WHERE [单据编号]=N'${made?.no}'`)
      ok(Number(rp?.t) === 2, `重打后 打印次数 = 2(实得 ${rp?.t})`)
      const rpQty = await one(`SELECT COUNT(*) n, ISNULL(SUM([打印数量]),0) q FROM bl_pu_label
        WHERE [单据编号]=N'${made?.no}' AND ISNULL(asp_cancel,'N')<>'Y'`)
      ok(Number(rpQty?.n) === 1 && Number(rpQty?.q) === PRINT_QTY,
        `重打**没有**多出打印行、数量不变(${rpQty?.n} 行 / 合计 ${rpQty?.q})`)
      const rpDlg = await one(`SELECT COUNT(*) n, ISNULL(SUM(l.[打印数量]),0) q FROM bl_pu_label l
        JOIN bd_pu_label h ON h.[单据编号]=l.[单据编号]
        WHERE h.[采购订单号]=N'${pick.no}' AND ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(l.asp_cancel,'N')<>'Y'
          AND l.[采购订单行id]=${Number(pick.line.id)}`)
      ok(Number(rpDlg?.n) === 1 && Number(rpDlg?.q) === PRINT_QTY,
        `重打**没有**新增预约(该行存活打印行仍 1 条 / 合计 ${PRINT_QTY};实得 ${rpDlg?.n} 条 / ${rpDlg?.q})`)
    }

    // ============ ③ 生单弹窗(上下两层):上层原行数量被切走 + 下层多出一行隔离行 ============
    console.log('\n=== ③ 生单弹窗:上层原行数量扣掉打印量 + 下层「已打印待生单」多出一行 ===')
    await openPanel('PU_ORDER', pick.no)
    info(`点击工具栏「生单」:${await clickToolbar('生单')}`)
    let T = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      T = JSON.parse((await readSendTable()) || 'null')
      if (T && T.top?.rows?.length >= 1 && T.下?.rows?.length >= 1) break
    }
    const topRows = T?.top?.rows || []
    const isoRows = T?.下?.rows || []
    ok(!!T?.top && topRows.length >= 1, `上层(原行)表渲染出来:${topRows.length} 行`)
    ok(!!T?.下 && isoRows.length >= 1, `下层(已打印待生单)表渲染出来:${isoRows.length} 行`)
    info(`上层列头:${JSON.stringify(T?.top?.ths)}`)
    info(`上层行:${JSON.stringify(topRows)}`)
    info(`下层列头:${JSON.stringify(T?.下?.ths)}`)
    info(`下层行:${JSON.stringify(isoRows)}`)
    const orderRow = topRows[0]
    const isoRow = isoRows.find((r) => N(r.批次号) === MY_BATCH)
    ok(!(T?.top?.ths || []).some((h) => h.indexOf('批次号') >= 0),
      `上层是**纯原行**:没有「批次号」列(列头 ${JSON.stringify(T?.top?.ths)})`)
    ok(Number(orderRow?.数量) === ORDER_QTY - PRINT_QTY,
      `上层原行「数量」已扣掉打印量:${ORDER_QTY} → ${orderRow?.数量}(| 隔离出去 ${PRINT_QTY})`)
    ok(!!isoRow, `下层**多出一行**隔离行,批次号 = 材料码上的号(${JSON.stringify(isoRow?.批次号)})`)
    ok(Number(isoRow?.['打印数量']) === PRINT_QTY, `隔离行「打印数量」= ${PRINT_QTY}(实得 ${isoRow?.['打印数量']})`)
    ok(Number(isoRow?.已生单) === 0 && Number(isoRow?.未生单) === PRINT_QTY,
      `隔离行「已生单 0 / 未生单 ${PRINT_QTY}」(实得 ${isoRow?.已生单}/${isoRow?.未生单})`)
    ok(N(isoRow?.状态) === '已打印', `隔离行状态 = 「已打印」(实得 ${JSON.stringify(isoRow?.状态)})`)
    ok(!isoRow?.禁勾, `隔离行此刻**可以勾**(还没生单:禁勾=${isoRow?.禁勾})`)

    // ============ ④ 勾下层隔离行 → 顶部批次号锁定 ============
    console.log('\n=== ④ 勾下层隔离行 → 顶部批次号**锁定**为材料码批次号 ===')
    info(`勾选下层「${MY_BATCH}」那一行:${await checkPrintedRow(MY_BATCH)}`)
    await sleep(800)
    const locked = JSON.parse(await ev(`(function(){
      const i = document.querySelector('.bsd-batch-inp input')
      return JSON.stringify({ disabled: i ? !!i.disabled : null, value: i ? i.value : null })
    })()`) || '{}')
    info(`顶部批次号:${JSON.stringify(locked)}`)
    ok(locked.disabled === true && N(locked.value) === MY_BATCH,
      `勾了隔离行 ⇒ 顶部批次号锁定为 ${MY_BATCH}(disabled=${locked.disabled},值=${JSON.stringify(locked.value)})`)

    // ============ ⑤ 确定生单 ============
    console.log('\n=== ⑤ 确定生单:暂收单批次号 = 材料码上的号 ===')
    info(`点击「确定生单」:${await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.el-dialog button')).find(function(x){ return x.textContent.trim() === '确定生单' })
      if (!b) return 'no-btn'; b.click(); return 'ok' })()`)}`)
    await sleep(3500)
    const after = await one(`SELECT TOP 1 单据编号 no, 批次号 b FROM sl_recv WHERE 批次号=N'${MY_BATCH}' ORDER BY id DESC`)
    ok(N(after?.b) === MY_BATCH, `新生成的暂收单批次号 = ${MY_BATCH}(${JSON.stringify(after?.no)})`)
    if (after?.no) created.push(['QC_RECV', N(after.no)])
    // ⑤b 勾了下层隔离行时,上层**默认勾选的原行**并进同一张单(用户拍板第 4 条:已打印量 + 未打印量整单同一个号)
    //     ⑤c **合并成一行明细**(2026-10-04 五次修订):同一条订单行的「隔离行 + 原行」在单据里只有一行、数量相加
    {
      const dl = await q(`SELECT [批次号] b, [数量] q FROM sl_recv_detail
        WHERE 单据编号=N'${after?.no}' AND ISNULL(asp_cancel,'N')<>'Y'`)
      const sameBatch = dl.length > 0 && dl.every((r) => N(r.b) === MY_BATCH)
      ok(sameBatch, `同一张单的 ${dl.length} 行**全部同号** ${MY_BATCH}(实得 ${JSON.stringify(dl.map((r) => N(r.b)))})`)
      const pickedOrderRows = topRows.filter((r) => Number(r.剩余) > 0)
      const expectQty = pickedOrderRows.reduce((s, r) => s + Number(r.剩余), 0) + PRINT_QTY
      const gotQty = dl.reduce((s, r) => s + Number(r.q ?? 0), 0)
      ok(gotQty === expectQty,
        `上层原行的未打印量**并进了这张单**:合计 ${gotQty}(期望 ${expectQty} = 原行剩余之和 + 隔离行 ${PRINT_QTY})`)
      // 合并:单据行数 = 勾中的订单行数(隔离行的量并进它本行,不再多出一行)
      ok(dl.length === pickedOrderRows.length,
        `**合并成一行明细**:单据 ${dl.length} 行 = 勾中的订单行数 ${pickedOrderRows.length}(隔离行 ${PRINT_QTY} 并进本行,不多出一行)`)
      const target = dl.find((r) => Number(r.q) === Number(topRows[0]?.剩余) + PRINT_QTY)
      ok(!!target, `该行的单据数量 = 原行剩余 ${topRows[0]?.剩余} + 已打印 ${PRINT_QTY}(实得 ${JSON.stringify(target?.q)})`)
    }

    // ============ ⑥ 重新打开生单弹窗:隔离行标「已生单」且不可勾 ============
    console.log('\n=== ⑥ 重新打开生单弹窗:下层隔离行标「已生单」、未生单 0、**不可再勾** ===')
    await openPanel('PU_ORDER', pick.no)
    await clickToolbar('生单')
    let T2 = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      T2 = JSON.parse((await readSendTable()) || 'null')
      if (T2 && T2.下?.rows?.length >= 1) break
    }
    info(`上层行:${JSON.stringify(T2?.top?.rows)}`)
    info(`下层行:${JSON.stringify(T2?.下?.rows)}`)
    const iso2 = (T2?.下?.rows || []).find((r) => N(r.批次号) === MY_BATCH)
    ok(!!iso2 && N(iso2.状态) === '已生单', `隔离行状态 = 「已生单」(实得 ${JSON.stringify(iso2?.状态)})`)
    ok(Number(iso2?.未生单) === 0 && Number(iso2?.已生单) === PRINT_QTY,
      `隔离行「已生单 ${PRINT_QTY} / 未生单 0」(实得 ${iso2?.已生单}/${iso2?.未生单})`)
    ok(iso2?.禁勾 === true, `隔离行的**勾选框已禁用**(禁勾=${iso2?.禁勾})`)
    // 隔离行**仍然留在列表里**(不是消失):用户口径「用它生单后...仍显示,只是标已生单」
    ok(!!iso2, `隔离行**没有消失**,还在下层表里(共 ${(T2?.下?.rows || []).length} 行)`)
    // 上层原行数量仍是扣掉打印量后的值(打印量不会因为生单又回到原行)
    ok(Number((T2?.top?.rows || [])[0]?.数量) === ORDER_QTY - PRINT_QTY,
      `上层原行数量仍是被切走后的 ${ORDER_QTY - PRINT_QTY}(实得 ${(T2?.top?.rows || [])[0]?.数量})`)
    // 打印弹窗也显示"已经生单"
    await openPanel('PU_ORDER', pick.no)
    await clickToolbar('打印', '打印材料码')
    let recTxt = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      recTxt = await ev(`(function(){
        const t = document.querySelectorAll('.mlq-records .el-table')
        const el = t && t[0]
        if (!el) return null
        const ths = Array.from(el.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
        const iAll = ths.findIndex(function(x){ return x.indexOf('已生单') >= 0 })
        const iP = ths.findIndex(function(x){ return x.indexOf('打印量') >= 0 })
        const tr = Array.from(el.querySelectorAll('.el-table__body tbody tr')).find(function(r){ return r.textContent.trim() !== '' })
        if (!tr) return null
        const tds = Array.from(tr.querySelectorAll('td'))
        return JSON.stringify({ ths: ths, 打印量: tds[iP] && tds[iP].textContent.trim(), 已生单: tds[iAll] && tds[iAll].textContent.trim() })
      })()`)
      if (recTxt) break
    }
    info(`打印弹窗「已打印记录」首行:${recTxt}`)
    const R = JSON.parse(recTxt || '{}')
    ok(Number(R.已生单) === PRINT_QTY, `打印弹窗记录里显示**已生单 ${PRINT_QTY}**(实得 ${JSON.stringify(R.已生单)})`)

    // ============ ⑦ 撤回一口径:一次可勾多行(每行各一张单) + 已生单可补打层 + 单头批次号锁定 ============
    console.log('\n=== ⑦ 一次可勾多行(每行一张单)/「已生单可补打」层/打印单生出来的单据批次号**只读** ===')
    // ⑦.1 单头批次号:这张暂收单是**由材料码明细生成的** ⇒ 草稿态也必须只读(带锁定角标)
    await openPanel('QC_RECV', after?.no)
    let lockUi = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      lockUi = await ev(`(function(){
        const fields = Array.from(document.querySelectorAll('.header-fields .field'))
        const f = fields.find(function(x){
          const l = x.querySelector('label'); return l && l.textContent.trim().indexOf('批次号') === 0 })
        if (!f) return null
        const inp = f.querySelector('input')
        const ro = f.querySelector('.field-readonly')
        // 草稿态渲染的是**输入框**(只是 disabled);审核后才是只读文本 —— 两种都算"锁住"
        if (!inp && !ro) return null
        return JSON.stringify({
          hasInput: !!inp, disabled: inp ? !!inp.disabled : null, inputValue: inp ? inp.value : null,
          readonlyText: ro ? ro.textContent.trim() : '',
          badge: !!f.querySelector('.field-lock-badge'),
        })
      })()`)
      if (lockUi) break
    }
    const L = JSON.parse(lockUi || '{}')
    info(`暂收单单头「批次号」:${lockUi}`)
    const lockedShape = (L.hasInput === true && L.disabled === true) || (!L.hasInput && L.readonlyText.indexOf(MY_BATCH) >= 0)
    ok(lockedShape, `由材料码生成的暂收单:草稿态单头批次号就**改不了**(实得 ${lockUi})`)
    ok(N(L.inputValue) === MY_BATCH || L.readonlyText.indexOf(MY_BATCH) >= 0,
      `且值就是材料码上的号 ${MY_BATCH}(输入框值 ${JSON.stringify(L.inputValue)} / 只读文本 ${JSON.stringify(L.readonlyText)})`)
    ok(L.badge === true, `并带「已按材料码批次号锁定」角标(badge=${L.badge})`)

    // ⑦.2 打印弹窗:一次勾两行 ⇒ 两张打印单;且下层出现「已生单可补打」
    await openPanel('PU_ORDER', pick.no)
    await clickToolbar('打印', '打印材料码')
    for (let i = 0; i < 40; i++) { await sleep(400); if (await ev(`!!document.querySelector('.mlq .el-table')`)) break }
    await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.el-dialog button')).find(function(x){ return x.textContent.trim() === '清空' })
      if (b) b.click(); return 'ok' })()`)
    await sleep(500)
    const SUP_LAYER = await ev(`(function(){
      const t = document.querySelector('.mlq-supp .el-table')
      if (!t) return null
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
      const tr = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })[0]
      const tds = tr ? Array.from(tr.querySelectorAll('td')).map(function(x){ return x.textContent.trim() }) : []
      return JSON.stringify({ ths: ths, first: tds })
    })()`)
    info(`下层「已生单可补打」:${SUP_LAYER}`)
    ok(!!SUP_LAYER, `打印弹窗出现下层「已生单可补打」表(已收但没打码的量)`)

    // 勾两行 ⇒ 服务端按行各建一张单
    const mvBefore = N((await one(`SELECT COUNT(*) n FROM bd_pu_label WHERE 采购订单号=N'${pick.no}' AND ISNULL(asp_cancel,'N')<>'Y'`))?.n)
    for (const idx of [0, 1]) {
      await ev(`(function(){
        const t = document.querySelector('.mlq .el-table')
        const trs = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })
        const tr = trs[${idx}]
        if (!tr) return 'no-row'
        const cbx = tr.querySelector('.el-checkbox')
        if (cbx) cbx.click()
        return 'ok' })()`)
      await sleep(400)
    }
    const mkQty = async (idx) => ev(`(function(){
      const t = document.querySelector('.mlq .el-table')
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
      const i = ths.findIndex(function(x){ return x.indexOf('本次打印数量') >= 0 })
      const tr = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })[${idx}]
      const inp = tr && tr.querySelectorAll('td')[i].querySelector('input')
      if (!inp) return 'no-input'
      inp.value = '5'
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      return inp.value })()`)
    info(`两行各设 5:${await mkQty(0)} / ${await mkQty(1)}`)
    await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.el-dialog button')).find(function(x){ return x.textContent.trim() === '确定并打印' })
      if (b) b.click(); return 'ok' })()`)
    await sleep(3500)
    const mvAfter = N((await one(`SELECT COUNT(*) n FROM bd_pu_label WHERE 采购订单号=N'${pick.no}' AND ISNULL(asp_cancel,'N')<>'Y'`))?.n)
    ok(Number(mvAfter) - Number(mvBefore) === 2,
      `一次勾两行 ⇒ **新增 2 张打印单**(打印单数 ${mvBefore} → ${mvAfter})—— 每行各一张,作废才不会连坐`)
    const mvDocs = await q(`SELECT 单据编号 no, (SELECT COUNT(*) FROM bl_pu_label l WHERE l.[单据编号]=h.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y') n
      FROM bd_pu_label h WHERE h.[采购订单号]=N'${pick.no}' AND ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.id`)
    ok(mvDocs.every((r) => Number(r.n) <= 1), `每张打印单**最多一行**(实得 ${JSON.stringify(mvDocs.map((r) => `${r.no}:${r.n}`))})`)
    // 打印弹窗记录里应能看出「用途」
    const recThs = await ev(`(function(){
      const el = document.querySelector('.mlq-records .el-table')
      if (!el) return null
      return JSON.stringify(Array.from(el.querySelectorAll('.el-table__header thead th')).map(function(x){ return x.textContent.trim() }))
    })()`)
    info(`记录表列头:${recThs}`)
    ok(String(recThs).indexOf('用途') >= 0, `「已打印记录」加了「用途」列区分 待生单 / 已生单补登`)
    console.log(`\n  留证:采购订单 ${pick.no} / 打印单 ${made?.no}(${MY_BATCH}) / 暂收单 ${after?.no}`)
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    try { edge.kill() } catch { /* ignore */ }
    console.log('\n=== 清理测试单据 ===')
    for (const [p, no] of created.slice().reverse()) {
      for (const b of ['弃审', '删除']) {
        try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ✓`) }
        catch (e) { console.log(`  ${p} ${no} ${b} 跳过:${String(e.message).slice(0, 80)}`) }
      }
    }
    const pd = await one(`SELECT TOP 1 单据编号 no FROM bd_pu_label WHERE 采购订单号=N'${pick.no}' AND ISNULL(asp_cancel,'N')<>'Y'`)
    if (pd?.no) {
      try { await post('/px/puLabel/void', { docNo: N(pd.no) }); console.log(`  ${pd.no} 打印记录作废 ✓`) }
      catch (e) { console.log(`  ${pd.no} 打印记录作废 跳过:${String(e.message).slice(0, 80)}`) }
    }
    // ⑦ 段可能又打了几张(多行打印),一并清掉,别在库里留预约
    for (const r of await q(`SELECT 单据编号 no FROM bd_pu_label WHERE 采购订单号=N'${pick.no}' AND ISNULL(asp_cancel,'N')<>'Y'`)) {
      try { await post('/px/puLabel/void', { docNo: N(r.no) }); console.log(`  ${N(r.no)} 打印记录作废 ✓`) }
      catch (e) { console.log(`  ${N(r.no)} 作废 跳过:${String(e.message).slice(0, 60)}`) }
    }
    await pool.close()
  }
  console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`)
  process.exit(fails ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:' + (e && e.stack || e)); process.exit(1) })
