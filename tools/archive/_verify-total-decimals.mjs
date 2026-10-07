/**
 * _verify-total-decimals.mjs — 合计位数验证探针(2026-10-03「明细与合计小数点后位数一致」任务)
 *
 * 做什么:开无头 Edge → 登录 → 打开指定单据面板的某张单 → 把**第一个带合计行的明细表格**的
 *   列头 / 明细单元格原文 / 合计行原文全读出来,逐列比对小数位数:
 *   · 合计位数 < 明细位数 ⇒ FAIL(用户报的问题);
 *   · 数值对不上(合计 ≠ 明细求和)⇒ FAIL。
 *
 * 用法:node tools/archive/_verify-total-decimals.mjs PU_ORDER YJ-20260915-12 [summary|form]
 *   · 默认:单据列表页(#/panelx/list/<面板>?docNo=…)的明细页脚合计行;
 *   · summary:先切「汇总」页签(合计是数据行里的「合计」行);
 *   · form:改走单据表单页(#/panelx/form/<面板>?code=…),看表单里明细网格的合计行。
 * 退出码:0 = 全部通过;1 = 有 FAIL。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attachCdp } from './_cdp.mjs'

const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PANEL = process.argv[2] || 'PU_ORDER'
const DOC = process.argv[3] || ''
const MODE = process.argv[4] || 'detail'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fails = 0
const ok = (cond, msg) => { console.log(`${cond ? '  PASS' : '  FAIL'}  ${msg}`); if (!cond) fails++ }

/** 小数字面量位数(与 @core/panel/sumTotals 的 decimalsOf 同口径) */
function decimalsOf(text) {
  const s = String(text ?? '').trim()
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

// ---- 登录拿 token ----
const lj = await (await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
if (!lj?.data?.token) { console.error('登录失败:', JSON.stringify(lj).slice(0, 300)); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-totaldec-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
  // detached 必需:本机 node 普通 spawn 拉起的 Edge 会立刻退出,CDP 端口起不来(见 _cdp.mjs 头注/旧探针)
  { stdio: 'ignore', detached: true })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* 等 Edge */ }
}
if (!tab) { console.error('Edge CDP 未就绪'); edge.kill(); process.exit(1) }
const cdp = await attachCdp(PORT, tab.id)
const { send, ev } = cdp
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })

try {
  await send('Page.navigate', { url: `${FRONT}/#/login` })
  await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date','2026-10-03'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)

  const url = MODE === 'form'
    ? `${FRONT}/?_v=${Date.now()}#/panelx/form/${PANEL}${DOC ? '?code=' + encodeURIComponent(DOC) : ''}`
    : `${FRONT}/?_v=${Date.now()}#/panelx/list/${PANEL}${DOC ? '?docNo=' + encodeURIComponent(DOC) : ''}`
  await send('Page.navigate', { url })
  let ready = false
  for (let i = 0; i < 90; i++) {
    await sleep(400)
    if (await ev(`!!document.querySelector('.el-table__footer-wrapper tr')`)) { ready = true; break }
  }
  await sleep(1500)
  // 诊断:没出现合计行时,先把"页面到底停在哪"打出来(登录页?401 跳转?面板还在加载?)
  const diag = await ev(`({ href: location.href, title: document.title,
    footTds: [...document.querySelectorAll('.el-table__footer-wrapper td')].map((td) => td.textContent.trim()),
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 200) })`)
  console.log('页面:', JSON.stringify(diag))
  ok(ready, `打开 ${PANEL}${DOC ? ' / ' + DOC : ''} 并出现合计行`)

  // 可选:切到「汇总」页签再读(汇总视图没有 el-table 合计行,合计是数据行里的「合计」行)
  if (MODE === 'summary') {
    const clicked = await ev(`(() => {
      const t = [...document.querySelectorAll('.dt-tab')].find((el) => el.textContent.trim() === '汇总')
      if (!t) return false
      t.click(); return true
    })()`)
    ok(clicked, '找到并点击「汇总」页签')
    await sleep(1800)
  }

  // 可见明细表格:取第一个「有合计行」的 el-table(EP 的合计行 <tr> 不在 tbody 里,故按 tr 取)
  const READ = `(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const out = []
    for (const tbl of [...document.querySelectorAll('.el-table')].filter(vis)) {
      const foot = tbl.querySelector('.el-table__footer-wrapper tr')
      const head = tbl.querySelector('.el-table__header-wrapper thead tr')
      const bodyRows = [...tbl.querySelectorAll('.el-table__body-wrapper tbody tr')].filter(vis)
      if (!head || (!foot && !bodyRows.length)) continue
      out.push({
        cols: [...head.children].map((th) => th.textContent.replace(/\\s+/g, ' ').trim()),
        rows: bodyRows.map((tr) => [...tr.children].map((td) => td.textContent.replace(/\\s+/g, ' ').trim())),
        foot: foot ? [...foot.children].map((td) => td.textContent.replace(/\\s+/g, ' ').trim()) : null,
      })
    }
    return out
  })()`
  const tables = await ev(READ)
  if (!tables?.length) { console.log('页面上没有可读的明细表格'); fails++ }
  // 档案分页:合计按全量行算,而 DOM 只有当前页 ⇒ 只判位数,不判数值(见 PanelxList.archSumsMap 注释)
  const paged = await ev(`(() => { const p = document.querySelector('.arch-pager'); return !!p && p.getBoundingClientRect().height > 0 })()`)
  if (paged) console.log('注意:该面板档案分页中(合计按全量行算,DOM 只有当前页)⇒ 只判"位数一致",不判数值')
  for (const [ti, t] of (tables || []).entries()) {
    console.log(`\n=== 表格 #${ti + 1}(列数 ${t.cols.length},行 ${t.rows.length})===`)
    console.log('列头:', t.cols.join(' | '))
    if (t.foot) console.log('合计行(表格页脚):', t.foot.join(' | '))
    for (const r of t.rows.slice(0, 8)) console.log('  行:', r.join(' | '))
    // 明细行集合 + 合计行:页脚优先;汇总视图里合计是数据行(首列 = 合计)
    const sumIdx = t.foot ? -1 : t.rows.findIndex((r) => r.some((v) => v === '合计'))
    if (!t.foot && sumIdx < 0) continue
    const foot = t.foot || t.rows[sumIdx]
    const detailRows = t.foot ? t.rows : t.rows.filter((_, i) => i !== sumIdx)
    for (let c = 1; c < t.cols.length; c++) {
      const label = t.cols[c]
      const cells = detailRows.map((r) => r[c]).filter((v) => v !== '' && v != null)
      const footCell = foot[c]
      const cellDecs = cells.map(decimalsOf).filter((d) => d !== null)
      const footDec = decimalsOf(footCell)
      if (!cellDecs.length || footDec === null) continue    // 非数值列(或不参与合计)不判
      const maxCell = Math.max(...cellDecs)
      const sum = cells.reduce((a, v) => a + Number(v), 0)
      const sumText = Number(sum.toFixed(Math.min(10, maxCell)))
      const same = paged || Math.abs(Number(footCell) - sumText) < 1e-9
      const digitsOk = footDec >= maxCell           // 合计位数不得少于明细
      ok(same && digitsOk,
        `列「${label}」明细最多 ${maxCell} 位 / 合计 ${footDec} 位(合计=${JSON.stringify(footCell)},明细和=${sumText})`)
    }
  }
} finally {
  try { cdp.close() } catch { /* ignore */ }
  try { edge.kill() } catch { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
console.log(`\n=== ${fails ? 'FAIL' : 'ALL PASS'} (fails=${fails}) ===`)
process.exit(fails ? 1 : 0)
