/**
 * _verify-qc-tc-ui.cjs — 特采改经暂收退料单 的**界面**验证(2026-10-04)
 *
 * 用户口径:「修改来料检验单的特采字段按钮,并且将特采按钮设置到暂收退料单,修改逻辑暂收退料单审批后
 *   才进入特采,并且暂收退料单要记录来料检验单送检数据的数量,后面才可以填入到特采单。
 *   然后特采通过后再到采购入库单。」
 *
 * 本探针只看界面(后端链路已由 _verify-qc-tc-via-return.ps1 覆盖):
 *   ① 暂收退料单**工具栏**上有没有「特采」按钮,而且不是灰的;
 *   ② 暂收退料单**明细表**里有没有「送检数量」列、值 = 来料检验单送检数量;
 *   ③ 来料检验单**明细表**里**没有**「特采」列了;
 *   ④ 在界面上真点一次「特采」→ 成功提示里带出生成的**特采单号**。
 * 跑在**测试账套**(factory=YJ_TEST)。用法:node tools/archive/_verify-qc-tc-ui.cjs
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { createRequire } = require('node:module')

const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const BASE = API.replace(/\/api$/, '')
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'
const PORT = Number(process.env.YJ_CDP_PORT || 9377)
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

  // ── 找一张「已审核 + 有送检数量 + 还没点过特采」的退料单;没有就现场造一条 ──
  const findCandidate = async () => (await q(`SELECT TOP 1 d.单据编号, d.送检数量, d.退货数量, d.物料编码
    FROM qc_return_detail d JOIN qc_return h ON h.单据编号 = d.单据编号
    WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.送检数量,0) > 0
      AND EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_RETURN' AND s.doc_no=d.单据编号
                    AND ISNULL(s.canceled,'N')<>'Y' AND (s.shr IS NOT NULL OR s.archived='Y'))
      AND NOT EXISTS (SELECT 1 FROM form_flow_link l WHERE l.source_panel_code='QC_RETURN'
                        AND l.source_form_no=d.单据编号 AND l.target_panel_code='QC_TC_IN' AND l.link_status='ACTIVE')
    ORDER BY d.单据编号 DESC`))[0] || null
  /** 现造:检验单(1 合格行 + 1 不良行)→ 审核 → 自动出暂收退料单 → 审核 → 得到「可点特采」的退料单 */
  const seed = async () => {
    const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f || {}, buttonParam: {} })
    const inv = (await q(`SELECT TOP 1 存货编码 FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' AND 存货名称 IS NOT NULL`))[0]['存货编码']
    const inspNo = (await cb('QC_INSP', '保存', {}))['编号']
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
    await cb('QC_INSP', '保存为草稿', {
      编号: inspNo, 单据日期: today, 供应商: '界面验证供应商', 业务员: 'admin',
      detail: { items: [
        { 物料编码: inv, 物料名称: '界面验证料', 规格型号: 'UI-SPEC', 送检数量: 40, 合格数量: 40, 不合格数量: 0, 计量单位: 'kg', 单价: 1 },
        { 物料编码: inv, 物料名称: '界面验证料B', 规格型号: 'UI-SPEC2', 送检数量: 30, 合格数量: 0, 不合格数量: 10, 计量单位: 'kg', 单价: 1 },
      ] },
    })
    await cb('QC_INSP', '审核', { 编号: inspNo })
    const l = (await q(`SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP'
      AND source_form_no='${inspNo}' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'`))[0]
    if (!l) throw new Error('造数失败:检验单审核没生成暂收退料单')
    await cb('QC_RETURN', '审核', { 编号: l.target_form_no })
    return findCandidate()
  }
  let th = await findCandidate()
  if (!th) { console.log('（没有现成的候选退料单 → 现场造一条）'); th = await seed() }
  if (!th) { console.error('没有可用的已审核暂收退料单'); await pool.close(); process.exit(1) }
  const SEND_QTY = Number(th.送检数量)
  const inspNo = (await q(`SELECT 检验单号 FROM qc_return WHERE 单据编号='${th.单据编号}'`))[0]?.['检验单号']
  console.log(`=== 暂收退料单 ${N(th.单据编号)}(送检数量 ${SEND_QTY},来源检验单 ${N(inspNo)})===`)

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
    /** 工具栏组名 + 是否置灰(.tb-main.disabled);下拉项一并列出 */
    const toolbar = () => ev(`(function(){
      return JSON.stringify(Array.from(document.querySelectorAll('.tb-group')).map(function(g){
        const main = g.querySelector('.tb-main')
        const caret = g.querySelector('.tb-caret')
        return { name: (main.querySelector('.act-name')||{}).textContent ? main.querySelector('.act-name').textContent.trim() : '',
                 disabled: main.classList.contains('disabled'), hasDrop: !!caret }
      })) })()`)
    /** 点工具栏某个组(有下拉先展开),返回 'ok' / 'no-group' */
    const clickToolbar = async (group) => {
      const r = await ev(`(function(){
        const g = Array.from(document.querySelectorAll('.tb-group'))
          .find(function(x){ const n = x.querySelector('.tb-main .act-name'); return n && n.textContent.trim() === ${JSON.stringify(group)} })
        if (!g) return 'no-group'
        if (g.querySelector('.tb-main').classList.contains('disabled')) return 'disabled'
        g.querySelector('.tb-main').click(); return 'ok' })()`)
      await sleep(1200)
      return r
    }
    /** 读明细表:列头 + 首行文本(⚠ el-table 列头带排序箭头 ⇅/↕,必须剥掉再比) */
    const strip = (s) => String(s).replace(/[⇅↕▲▼]+/g, '').trim()
    const readGrid = () => ev(`(function(){
      const t = document.querySelector('.el-table')
      if (!t) return null
      const ths = Array.from(t.querySelectorAll('.el-table__header thead th')).map(function(x){return x.textContent.trim()}).filter(Boolean)
      const tr = Array.from(t.querySelectorAll('.el-table__body tbody tr')).find(function(r){ return r.textContent.trim() !== '' })
      const cells = tr ? Array.from(tr.querySelectorAll('td')).map(function(x){return x.textContent.trim()}) : []
      return JSON.stringify({ ths: ths, first: cells }) })()`)
    const toast = () => ev(`(function(){
      const m = document.querySelector('.el-message')
      return m ? m.textContent.trim() : null })()`)

    console.log('\n=== ① 暂收退料单:工具栏「特采」按钮 ===')
    await openPanel('QC_RETURN', N(th.单据编号))
    const tb = JSON.parse(await toolbar())
    info('工具栏: ' + tb.map((x) => x.name + (x.disabled ? '(灰)' : '')).join(' / '))
    const tcBtn = tb.find((x) => x.name === '特采')
    ok(!!tcBtn, '工具栏出现「特采」按钮')
    ok(tcBtn && !tcBtn.disabled, '「特采」不是灰色占位(可点)')

    console.log('\n=== ② 暂收退料单:明细「送检数量」列 ===')
    const g1 = JSON.parse(await readGrid() || 'null')
    if (!g1) { ok(false, '没读到明细表') } else {
      g1.ths = g1.ths.map(strip)
      const i = g1.ths.indexOf('送检数量')
      ok(i >= 0, `明细列含「送检数量」(列头: ${g1.ths.join('/')})`)
      if (i >= 0) {
        const v = N(g1.first[i])
        ok(Number(v) === SEND_QTY, `「送检数量」值 = ${v}(库中 ${SEND_QTY})`)
      }
    }

    console.log('\n=== ③ 来料检验单:明细已无「特采」列 ===')
    if (inspNo) {
      await openPanel('QC_INSP', N(inspNo))
      const g2 = JSON.parse(await readGrid() || 'null')
      if (!g2) { ok(false, '没读到检验单明细表') } else {
        g2.ths = g2.ths.map(strip)
        ok(g2.ths.indexOf('特采') < 0, `检验单明细无「特采」列(列头: ${g2.ths.join('/')})`)
      }
    } else { ok(false, '退料单没有来源检验单号,跳过') }

    console.log('\n=== ④ 界面上真点一次「特采」→ 提示里带出特采单号 ===')
    await openPanel('QC_RETURN', N(th.单据编号))
    const clicked = await clickToolbar('特采')
    ok(clicked === 'ok', `点击「特采」(${clicked})`)
    let msg = null
    for (let i = 0; i < 40; i++) { await sleep(400); msg = await toast(); if (msg) break }
    info('提示: ' + JSON.stringify(msg))
    ok(!!msg && /TCI-/.test(msg), '提示里带出了生成的**特采单号**(TCI-…)')

    console.log('\n=== ⑤ 复核:库里确实生成了特采单,且总数量 = 送检数量 ===')
    const link = (await q(`SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_RETURN'
      AND source_form_no='${th.单据编号}' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'`))[0]
    ok(!!link, `库里出现 QC_RETURN→QC_TC_IN 链路: ${N(link?.target_form_no)}`)
    if (link) {
      const t = (await q(`SELECT 总数量, 不合格品数量, 暂收退料单号 FROM qc_tc_in WHERE 单据编号='${N(link.target_form_no)}'`))[0]
      info(`特采单 ${N(link.target_form_no)} 总数量=${N(t?.总数量)} 不合格品数量=${N(t?.不合格品数量)} 暂收退料单号=${N(t?.暂收退料单号)}`)
      ok(Number(String(t?.总数量).replace(/[^\d.]/g, '')) === SEND_QTY, `特采单总数量 = 退料单送检数量 ${SEND_QTY}`)
      ok(N(t?.暂收退料单号) === N(th.单据编号), '特采单头记录了暂收退料单号')
    }
    console.log('\n=== ⑥ 多语言:切英语后新按钮/新列显示英文(不是中文) ===')
    await ev(`(function(){ localStorage.setItem('mes_locale','en'); return 'ok' })()`)
    await openPanel('QC_RETURN', N(th.单据编号))
    const tbEn = JSON.parse(await toolbar())
    info('EN 工具栏: ' + tbEn.map((x) => x.name).join(' / '))
    ok(tbEn.some((x) => x.name === 'Special acceptance'), '「特采」在英语下显示 Special acceptance')
    ok(!tbEn.some((x) => x.name === '特采'), '英语下没有残留中文「特采」按钮')
    const g3 = JSON.parse(await readGrid() || 'null')
    if (g3) {
      g3.ths = g3.ths.map(strip)
      info('EN 明细列: ' + g3.ths.join('/'))
      ok(g3.ths.includes('Sent for Inspection Qty'), '「送检数量」在英语下显示 Sent for Inspection Qty')
      ok(!g3.ths.includes('送检数量'), '英语下没有残留中文列头「送检数量」')
    } else { ok(false, '英语下没读到明细表') }
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
