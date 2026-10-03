/**
 * _verify-batch-no-ui.cjs — 批次号口径的**界面**验证(2026-10-04)
 *
 * 为什么要有这个探针:后端接口探针(_verify-batch-no-on-generate.mjs)只能证明数据落得对,
 * 证明不了"用户看到的格子能不能改"。本探针开一个真实浏览器(Edge + CDP,零外部依赖 ——
 * Node 24 自带全局 WebSocket),断言的是**渲染结果**:
 *   ① 送料暂收单**草稿态**:单头「批次号」渲染为可编辑输入框(值 = 生单时取的号);
 *   ② 送料暂收单**明细行**「批次号」:渲染为只读格 `.cell-locked`,**点了也不出编辑器**
 *      (新增的 detailBatchLocked 闸门;旧版明细格只读 computed、恒为假 ⇒ 点得进去);
 *   ③ 送料暂收单**审核后**:单头「批次号」退化为只读文本 `.field-readonly`,
 *      整单不可编辑(用户口径「一旦审批…不能修改」);
 *   ④ 来料检验单(下游,元数据 editable=0):**草稿态**单头批次号就已只读,明细格同样锁定,
 *      且值 = 上游继承来的同一个号(界面上"头行一致"看得见)。
 *
 * 跑在**测试账套**(登录 factory=YJ_TEST),自己在测试库造单、跑完清理。
 * 用法:node tools/archive/_verify-batch-no-ui.cjs   (env: YJ_API / YJ_HEADLESS=0 可开有头)
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { createRequire } = require('node:module')

const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const BASE = API.replace(/\/api$/, '')
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'
const PORT = Number(process.env.YJ_CDP_PORT || 9358)
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const HEADLESS = process.env.YJ_HEADLESS !== '0'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++ }
const info = (msg) => console.log(`         ${msg}`)

async function main() {
  if (!EDGE) { console.error('未找到 Edge,无法做界面验证'); process.exit(1) }
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const q = async (s) => (await new mssql.Request(pool).query(s)).recordset
  const one = async (s) => (await q(s))[0] || null
  const N = (v) => (v === null || v === undefined ? null : String(v).trim())
  const dstr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d || new Date()).replace(/-/g, '')

  // ---------- ① 拿测试账套令牌 + 造一张草稿暂收单 ----------
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!lj?.data?.token) { console.error('登录失败(测试账套):' + JSON.stringify(lj).slice(0, 200)); await pool.close(); process.exit(1) }
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (url, body) => {
    const j = await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
    if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 260)}`)
    return j.data
  }
  const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} })

  const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || []
  let pick = null
  for (const r of list) {
    if (N(r['单据状态']) !== '已审核') continue
    let ls
    try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: N(r['单据编号']) }) } catch { continue }
    const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 5)
    if (line) { pick = { no: N(r['单据编号']), line, supplier: N(r['供应商编码']) }; break }
  }
  if (!pick) { console.error('找不到合适的已审核采购订单'); await pool.close(); process.exit(1) }
  const EXPECT = `${String(pick.supplier || '').replace(/^YJ-/i, '')}-${dstr()}`
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: pick.line.lineKey, qty: 5 }],
  })
  const recv = N(gen['编号'])
  const created = [['QC_RECV', recv]]
  console.log(`=== 测试账套造单:送料暂收单 ${recv}(批次号 ${EXPECT}) ===`)

  // ---------- ② 起 Edge(CDP) ----------
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-batch-ui-'))
  const args = ['--no-first-run', '--window-size=1500,950', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, 'about:blank']
  if (HEADLESS) args.unshift('--headless=new')
  const edge = spawn(EDGE, args, { stdio: 'ignore' })
  let ws
  try {
    let tab = null
    for (let i = 0; i < 40 && !tab; i++) {
      await sleep(400)
      try { tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json() } catch { /* 还没起来 */ }
    }
    if (!tab) throw new Error('CDP 未就绪')
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (d) => {
      let m; try { m = JSON.parse(typeof d.data === 'string' ? d.data : d.data.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) throw new Error('页面求值异常:' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
      return r.result?.result?.value
    }
    await send('Page.enable'); await send('Runtime.enable')

    // 登录页先落个 origin,再把令牌塞进 localStorage(等价于已登录会话;令牌来自真实登录接口)
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
    await ev(`(function(){
      localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
      localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify('YJ_TEST'))});
      return 'ok'
    })()`)

    let bootSeq = 0
    /**
     * 打开面板并等渲染稳定。
     * ⚠ 必须**整页重载**(URL 上加唯一 query,换 hash 只改 hash 不会重载):pinia 的 user store 只在
     *   应用启动时读一次 localStorage,注入令牌后若不重载,路由守卫看到的仍是"未登录" ⇒ 一直跳回 /#/login
     *   (2026-10-04 探针首版就栽在这:页面标题一直是"登录 · YINJIA-MES",表头/明细都查不到)。
     */
    const openPanel = async (panel, docNo) => {
      const url = `${BASE}/?_boot=${++bootSeq}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}`
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break }
      // 等表头字段与明细行都出来(el-table 的行在 .el-table__body 里)
      for (let i = 0; i < 80; i++) {
        const n = await ev(`document.querySelectorAll('.header-fields .field').length + '|' + document.querySelectorAll('.el-table__body tbody tr').length`)
        if (n && !n.startsWith('0|')) { await sleep(1500); return n }
        await sleep(300)
      }
      return await ev(`document.querySelectorAll('.header-fields .field').length + '|' + document.querySelectorAll('.el-table__body tbody tr').length`)
    }

    /**
     * 页面侧断言脚本:找「批次号」表头格 + 明细表「批次号」列,回报渲染形态。
     * 只读**渲染结果**(input/.field-readonly/.cell-locked/.cell-lazy),不读内部状态。
     *
     * 两种"不可改"的形态都要认(2026-10-04 对照实测):
     *   · 非草稿(整单只读) → 该格渲染成 `.field-readonly` 纯文本(模板 `v-else`);
     *   · 草稿但字段级只读(元数据 editable=0 → readonly) → 仍渲染 el-input,但 **disabled**。
     * 故判定"可改"= hasInput && !inputDisabled;其余一律视为不可改。
     */
    const probePage = () => ev(`(function(){
      const TT = '批次号'
      const out = { header: null, tables: [], locked: [], lazyCells: document.querySelectorAll('.cell-lazy').length }
      const cellsOf = (tr) => Array.from(tr.querySelectorAll('td'))
      // ---- 表头 ----
      for (const f of document.querySelectorAll('.header-fields .field')) {
        const lb = f.querySelector('label')
        if (!lb || !lb.textContent.trim().startsWith(TT)) continue
        const inp = f.querySelector('input')
        const ro = f.querySelector('.field-readonly')
        out.header = {
          label: lb.textContent.trim(),
          hasInput: !!inp,
          inputDisabled: inp ? !!inp.disabled : null,
          inputValue: inp ? inp.value : null,
          readOnlyText: ro ? ro.textContent.trim() : null,
        }
        break
      }
      // ---- 明细表:el-table 把表头/表体渲染成**两张独立的 table**
      //      (.el-table__header 有 thead th、.el-table__body 有 tbody tr,彼此不同表)——
      //      必须在同一个 .el-table 里配对取列头与行,否则永远匹配不到行(2026-10-04 探针踩到)。
      for (const el of document.querySelectorAll('.body .el-table')) {
        const ths = Array.from(el.querySelectorAll('.el-table__header thead th')).map((x) => x.textContent.trim())
        const idx = ths.findIndex((x) => x.startsWith(TT))
        const trs = Array.from(el.querySelectorAll('.el-table__body tbody tr'))
        const rec = { ths, batchIdx: idx, rows: trs.length, batchCells: [] }
        if (idx >= 0) {
          for (const tr of trs) {
            const tds = cellsOf(tr)
            const td = tds[idx]
            // el-table 会为填满固定行高补若干**空占位行**(36 个空 td)——
            // 用整行文本是否为空把它们剔掉,否则"每行都锁"这类断言会被空行判假(2026-10-04 探针踩到)。
            const rowEmpty = tr.textContent.trim() === ''
            if (!td) { rec.batchCells.push({ missing: true, rowEmpty, tdCount: tds.length, thCount: ths.length }); continue }
            rec.batchCells.push({
              rowEmpty,
              text: td.textContent.trim(),
              locked: !!td.querySelector('.cell-locked'),
              lazy: !!td.querySelector('.cell-lazy'),
              hasInput: !!td.querySelector('input'),
            })
          }
        }
        out.tables.push(rec)
      }
      // ---- 全页 .cell-locked:回报它落在哪一列(列名交叉验证"锁的就是批次号列") ----
      for (const el of document.querySelectorAll('.cell-locked')) {
        const td = el.closest('td'); const tr = td && td.closest('tr'); const box = tr && tr.closest('.el-table')
        const ths = box ? Array.from(box.querySelectorAll('.el-table__header thead th')).map((x) => x.textContent.trim()) : []
        const ci = td && tr ? Array.prototype.indexOf.call(tr.querySelectorAll('td'), td) : -1
        out.locked.push({ text: el.textContent.trim(), colHeader: ci >= 0 ? ths[ci] : null })
      }
      return JSON.stringify(out)
    })()`)

    /** 点一下被锁的明细格,再看它有没有变成编辑器(activateCell 闸门) */
    const clickLocked = () => ev(`(function(){
      const el = document.querySelector('.cell-locked')
      if (!el) return 'no-locked-cell'
      el.click()
      return 'clicked'
    })()`)

    // 明细行批次号列:从 tables 里挑出"列头含批次号"的那张表;**只看有数据的行**(剔 el-table 的空占位行)
    const batchTable = (p) => (p.tables || []).find((t) => t.batchIdx >= 0) || null
    const dataCells = (p) => ((batchTable(p)?.batchCells) || []).filter((c) => !c.rowEmpty)

    // ============ ③ 送料暂收单·草稿 ============
    console.log('\n=== ① 送料暂收单**草稿态**:单头可编辑 + 明细行批次号只读 ===')
    const domN = await openPanel('QC_RECV', recv)
    info(`表头字段数|明细行数 = ${domN}`)
    let p = JSON.parse(await probePage())
    info(`表头 = ${JSON.stringify(p.header)}`)
    ok(p.header && p.header.hasInput && !p.header.inputDisabled, '单头「批次号」渲染为**可编辑输入框**(草稿态可改)')
    ok(N(p.header?.inputValue) === EXPECT, `单头输入框的值 = 生单时取的号 ${EXPECT}(实得 ${JSON.stringify(p.header?.inputValue)})`)
    const bt = batchTable(p)
    info(`批次号列(${bt?.batchIdx})各格(含空占位行)= ${JSON.stringify(bt?.batchCells)}`)
    ok(bt && bt.batchIdx >= 0, `明细表存在「批次号」列(第 ${bt?.batchIdx} 列)`)
    const cells = dataCells(p)
    ok(cells.length > 0 && cells.every((c) => c.locked && !c.hasInput),
      `明细行批次号格全部为**只读格 .cell-locked**(${cells.filter((c) => c.locked).length}/${cells.length} 行;el-table 空占位行已剔除)`)
    ok(cells.every((c) => c.text === EXPECT), `明细行批次号值 = 单头的号 ${EXPECT}(头行一致,界面上看得见)`)
    ok((p.locked || []).length > 0 && (p.locked || []).every((x) => String(x.colHeader || '').startsWith('批次号')),
      `全页 .cell-locked 都落在「批次号」列(实得列名 ${JSON.stringify([...new Set((p.locked || []).map((x) => x.colHeader))])})`)
    await clickLocked(); await sleep(600)
    const cells2 = dataCells(JSON.parse(await probePage()))
    ok(cells2.length > 0 && cells2.every((c) => c.locked && !c.hasInput),
      '**点击**只读格之后仍不出编辑器(activateCell 已拦;旧版这里会变成输入框)')

    // ============ ④ 审核后:整单只读 ============
    console.log('\n=== ② 送料暂收单**审核后**:单头批次号退化为只读文本 ===')
    await cb('QC_RECV', '审核', { 编号: recv })
    await sleep(800)
    await openPanel('QC_RECV', recv)
    const p3 = JSON.parse(await probePage())
    info(`表头 = ${JSON.stringify(p3.header)}`)
    ok(p3.header && !p3.header.hasInput && N(p3.header.readOnlyText) === EXPECT,
      `单头「批次号」变成只读文本 .field-readonly = ${EXPECT}(实得 ${JSON.stringify(p3.header?.readOnlyText)})`)
    const cells3 = dataCells(p3)
    // 审核后整单只读 ⇒ 明细表整块走 v-else 纯文本分支(既不是 .cell-locked 也不出编辑器)。
    // 断言"不可编辑"这个**结果**,不锁死具体分支:无 input 且值仍是同一个号。
    ok(cells3.length > 0 && cells3.every((c) => !c.hasInput && c.text === EXPECT),
      `审核后明细行批次号不可编辑且值不变(${cells3.map((c) => `${c.locked ? 'locked' : 'text'}:${c.text}`).join(', ')};共 ${cells3.length} 行)`)

    // ============ ⑤ 下游:来料检验单(草稿) ============
    console.log('\n=== ③ 来料检验单(**下游**,草稿态):单头不可改 + 明细锁定 + 值继承上游 ===')
    const insp = N((await cb('QC_RECV', '生成来料检验单', { 编号: recv }))['编号'])
    created.push(['QC_INSP', insp])
    await openPanel('QC_INSP', insp)
    const p4 = JSON.parse(await probePage())
    info(`表头 = ${JSON.stringify(p4.header)}`)
    // 草稿 + 元数据 editable=0 ⇒ 仍是 input 但 disabled(整单只读态才退化成 .field-readonly)
    const inspEditable = !!(p4.header && p4.header.hasInput && !p4.header.inputDisabled)
    ok(p4.header && !inspEditable,
      `草稿态单头批次号**不可改**(元数据 editable=0 ⇒ 输入框 disabled;实得 ${JSON.stringify(p4.header)})`)
    ok(N(p4.header?.inputValue ?? p4.header?.readOnlyText) === EXPECT,
      `其值 = 上游继承的号 ${EXPECT}(实得 ${JSON.stringify(p4.header?.inputValue ?? p4.header?.readOnlyText)})`)
    const cells4 = dataCells(p4)
    ok(cells4.length > 0 && cells4.every((c) => c.locked && !c.hasInput && c.text === EXPECT),
      `明细行只读且值 = 上游继承的号(${cells4.filter((c) => c.locked).length}/${cells4.length} 行)`)
    console.log(`\n  留证:暂收单 ${recv} / 检验单 ${insp} / 批次号 ${EXPECT}`)
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    try { edge.kill() } catch { /* ignore */ }
    // ---------- 清理测试单据 ----------
    console.log('\n=== 清理测试单据(反序 弃审 → 删除) ===')
    for (const [panel, no] of created.slice().reverse()) {
      for (const b of ['弃审', '删除']) {
        try { await cb(panel, b, { 编号: no }); console.log(`  ${panel} ${no} ${b} ✓`) }
        catch (e) { console.log(`  ${panel} ${no} ${b} 跳过:${String(e.message).slice(0, 90)}`) }
      }
    }
    await pool.close()
  }
  console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`)
  process.exit(fails ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:' + (e && e.stack || e)); process.exit(1) })
