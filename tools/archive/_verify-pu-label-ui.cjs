/**
 * _verify-pu-label-ui.cjs — 材料码打印 + 「已打印待生单」的**界面**验证(2026-10-04)
 *
 * 走的就是用户描述的那条路(Edge + CDP 真浏览器,零外部依赖):
 *   ① 采购订单 → 工具栏「打印」→「打印材料码」→ 弹窗;
 *   ② 弹窗里「批次号」按公式预填且**可改**;明细有勾选列与「剩余可打」;
 *   ③ 改个号 + 填量 + 「确定并打印」→ 库里真的登记了那张打印单(批次号=改的号);
 *   ④ 回到采购订单 → 「生单」→「生成送料暂收单」→ 弹窗底部出现**「已打印待生单」**小表,
 *      勾上它 → 顶部「批次号」**自动锁定**为该材料码批次号(输入框 disabled);
 *   ⑤ 点「确定生单」→ 生成的送料暂收单 批次号 = 材料码上的那个号。
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
const PORT = Number(process.env.YJ_CDP_PORT || 9371)
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

  // ---------- 选一张已审核、余量够的采购订单 ----------
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
    const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 20 && Number(x.可送上限) >= 20 && Number(x.未生单预约合计 || 0) === 0)
    if (line) { pick = { no, line, supplier: N(r['供应商编码']) }; break }
  }
  if (!pick) { console.error('找不到合适的采购订单'); await pool.close(); process.exit(1) }
  const EXPECT_AUTO = `${String(pick.supplier || '').replace(/^YJ-/i, '')}-${dstr()}`
  const MY_BATCH = `弹窗改-${dstr()}`
  console.log(`=== 采购订单 ${pick.no}(供应商 ${pick.supplier})行 ${pick.line.行号} 剩余 ${pick.line.剩余数量} ===`)
  console.log(`    公式预填号 ${EXPECT_AUTO} / 本探针改用的号 ${MY_BATCH}`)

  const created = []          // [panel, no] 清理用
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mlq-'))
  const args = ['--no-first-run', '--window-size=1500,980', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank']
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
      // 打印会开新窗口,headless 下可能被拦 → alert 会**阻塞页面**,这里自动关掉,免得探针挂死
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
    /** 整页重载打开面板(pinia 的 user store 只在启动时读一次 localStorage,换 hash 不重载会被守卫踢回登录页) */
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
    /** 点工具栏某个组:单动作组直接点主按钮,多动作组先开 ▼ 再点菜单项 */
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
          if (!it) return 'no-item:' + Array.from(document.querySelectorAll('.tb-menu .ctx-item')).map(function(x){return x.textContent.trim()}).join('|')
          it.click(); return 'ok'
        })()`)
        await sleep(900)
        return `${r}/${r2}`
      }
      return r
    }

    // ============ ① 打印材料码弹窗 ============
    console.log('\n=== ① 采购订单 →「打印」→「打印材料码」→ 弹窗 ===')
    await openPanel('PU_ORDER', pick.no)
    const clicked = await clickToolbar('打印', '打印材料码')
    info(`点击工具栏:${clicked}`)
    let dlg = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      dlg = await ev(`(function(){ const i = document.querySelector('.mlq-batch-inp input'); return i ? i.value : null })()`)
      if (dlg !== null && dlg !== undefined) break
    }
    ok(dlg !== null && dlg !== undefined, `材料码打印弹窗已弹出(批次号输入框值 ${JSON.stringify(dlg)})`)
    ok(N(dlg) === EXPECT_AUTO, `「批次号」按公式**预填** = ${EXPECT_AUTO}(实得 ${JSON.stringify(dlg)})`)
    const tbl = await ev(`(function(){
      const t = document.querySelector('.mlq .el-table')
      if (!t) return null
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
      const trs = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })
      const idx = ths.findIndex(function(x){ return x.indexOf('剩余可打') >= 0 })
      return JSON.stringify({ ths: ths, rows: trs.length, capIdx: idx,
        cap: idx >= 0 && trs[0] ? (trs[0].querySelectorAll('td')[idx] || {}).textContent : null })
    })()`)
    info(`打印表:${tbl}`)
    const T = JSON.parse(tbl || '{}')
    ok((T.rows || 0) > 0, `明细表有 ${T.rows} 行可勾选`)
    ok(T.capIdx >= 0 && Number(String(T.cap).trim()) > 0, `有「剩余可打」列且首行有额度(${String(T.cap).trim()})`)

    // ============ ② 改号 + 填量 + 确定并打印 ============
    console.log('\n=== ② 改批次号 → 确定并打印 → 库里真的登记了 ===')
    const typed = await ev(`(function(){
      const i = document.querySelector('.mlq-batch-inp input')
      if (!i) return 'no-input'
      if (i.disabled || i.readOnly) return 'locked'
      i.value = ${JSON.stringify(MY_BATCH)}
      i.dispatchEvent(new Event('input', { bubbles: true }))
      i.dispatchEvent(new Event('change', { bubbles: true }))
      return i.value
    })()`)
    ok(N(typed) === MY_BATCH, `「批次号」**可改**,已改成 ${MY_BATCH}(实得 ${JSON.stringify(typed)})`)
    const pressed = await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.el-dialog__footer button, .el-dialog button'))
        .find(function(x){ return x.textContent.trim() === '确定并打印' })
      if (!b) return 'no-btn'
      b.click(); return 'ok'
    })()`)
    info(`点击「确定并打印」:${pressed}`)
    await sleep(3000)
    const made = await one(`SELECT TOP 1 单据编号 no, 批次号 b FROM bd_pu_label
      WHERE 采购订单号=N'${pick.no}' AND 批次号=N'${MY_BATCH}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`)
    ok(N(made?.b) === MY_BATCH, `界面上改的号登记成了打印单(${JSON.stringify(made?.no)} → ${JSON.stringify(made?.b)})`)
    const madeQty = await one(`SELECT ISNULL(SUM(打印数量),0) q FROM bl_pu_label
      WHERE 单据编号=N'${makeSqlStr(made?.no)}' AND ISNULL(asp_cancel,'N')<>'Y'`)
    ok(Number(madeQty?.q) > 0, `打印数量已落库(${madeQty?.q})`)

    // ============ ③ 生单弹窗出现「已打印待生单」并锁定批次号 ============
    console.log('\n=== ③ 生单弹窗:出现「已打印待生单」,勾选后批次号**锁定**为该号 ===')
    await openPanel('PU_ORDER', pick.no)
    const clicked2 = await clickToolbar('生单')
    info(`点击工具栏「生单」:${clicked2}`)
    let prReady = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      prReady = await ev(`(function(){
        const t = document.querySelector('.bsd-printed .el-table')
        if (!t) return null
        const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()})
        const trs = Array.from(t.querySelectorAll('.el-table__body tbody tr')).filter(function(r){ return r.textContent.trim() !== '' })
        const i = ths.findIndex(function(x){ return x.indexOf('批次号') >= 0 })
        return JSON.stringify({ ths: ths, rows: trs.length, batch: (i >= 0 && trs[0]) ? trs[0].querySelectorAll('td')[i].textContent.trim() : null })
      })()`)
      if (prReady) break
    }
    const P = JSON.parse(prReady || '{}')
    info(`已打印待生单表:${prReady}`)
    ok((P.rows || 0) > 0, `「已打印待生单」小表出现且有 ${P.rows} 行`)
    ok(N(P.batch) === MY_BATCH, `小表里的批次号 = 材料码上的号(${JSON.stringify(P.batch)})`)
    // 勾选第一行
    await ev(`(function(){
      const t = document.querySelector('.bsd-printed .el-table')
      const tr = Array.from(t.querySelectorAll('.el-table__body tbody tr')).find(function(r){ return r.textContent.trim() !== '' })
      const cb = tr && tr.querySelector('.el-checkbox')
      if (cb) cb.click()
      return cb ? 'checked' : 'no-checkbox'
    })()`)
    await sleep(700)
    const locked = await ev(`(function(){
      const i = document.querySelector('.bsd-batch-inp input')
      return JSON.stringify({ disabled: i ? !!i.disabled : null, value: i ? i.value : null })
    })()`)
    info(`顶部批次号:${locked}`)
    const L = JSON.parse(locked || '{}')
    ok(L.disabled === true, `勾了已打印行 ⇒ 顶部「批次号」输入框被**锁定**(disabled)`)
    ok(N(L.value) === MY_BATCH, `锁定后的号 = 材料码批次号 ${MY_BATCH}(实得 ${JSON.stringify(L.value)})`)

    // ============ ④ 确定生单 → 暂收单批次号 = 材料码批次号 ============
    console.log('\n=== ④ 确定生单:生成的送料暂收单批次号 = 材料码上的号 ===')
    const before = Number((await one(`SELECT COUNT(*) n FROM sl_recv WHERE 批次号=N'${MY_BATCH}'`))?.n || 0)
    const pressed2 = await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.el-dialog button'))
        .find(function(x){ return x.textContent.trim() === '确定生单' })
      if (!b) return 'no-btn'
      b.click(); return 'ok'
    })()`)
    info(`点击「确定生单」:${pressed2}`)
    await sleep(3500)
    const after = await one(`SELECT TOP 1 单据编号 no, 批次号 b FROM sl_recv WHERE 批次号=N'${MY_BATCH}' ORDER BY id DESC`)
    ok(Number((await one(`SELECT COUNT(*) n FROM sl_recv WHERE 批次号=N'${MY_BATCH}'`))?.n || 0) > before,
      `新生成了一张暂收单:${JSON.stringify(after?.no)} 批次号 ${JSON.stringify(after?.b)}`)
    if (after?.no) created.push(['QC_RECV', N(after.no)])
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
    await pool.close()
  }
  console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`)
  process.exit(fails ? 1 : 0)
}

/** SQL 字面量转义(单引号加倍);null → 空串,让查询自然查不到 */
function makeSqlStr(s) { return String(s ?? '').replace(/'/g, "''") }

main().catch((e) => { console.error('探针异常:' + (e && e.stack || e)); process.exit(1) })
