/*
 * _probe-first-insp-reqs.mjs — 首件检验单「相关要求落地」界面验收(2026-10-16 第三轮)
 *
 * 用户口径:「这个是针对当前的首件检验单的相关要求内容,查看一下下面所述的各项要求并实现。」
 * 纸面《相关要求》6 条 → 系统落地后的界面断言(全程在**内存里的新草稿**上做,不点保存、不落库):
 *   ① 可填范围:前两列(勾选式)保持原样只记 1#/2#,其余列(含新增列)1#..8# 八行全可填;
 *   ② 精度:炭棒外径(内外径/长度/重量同规则)输入 12.34 → 失焦取整成 12.3;挤压强度/压降 33.33 原样保留;
 *   ③ 浊度 + 压降 同单 ⇒ 纸张上出现「先测初始浊度,再测压降」的测试顺序提示;
 *   ④ 勾上「严重粘模（脱皮）」⇒ 弹红色警示 + 纸张顶部常驻红色横幅(取消勾选后横幅消失);
 *   ⑤ C-95:产品编号里出现 C-95 ⇒ 纸张顶部出现「C-95客户相关产品脱模后立马进行首件检验」提醒条
 *      (客户代码由后端出单时带入,见 _verify-first-insp-proddate.mjs 的链条断言);
 *   ⑥ 全程无未捕获的运行时异常。
 *
 * 用法: node tools/archive/_probe-first-insp-reqs.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9495
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fir-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(2800)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(700)
  await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
  await sleep(2800)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(900)

  // ── ① 可填范围:前两列(勾选式)保持原样只记 1#/2#,其余列(含新增列)八行全可填 ────
  //    ⚠ 2026-10-17 两度改口径:先是"每个测试项目都只记 1#/2#",再是"四个分组各绑一对样品行",
  //      最终用户口径 =「让当前各个表格都能填写即可,前两列保持原样即可」+「后面新增的列也一样」。
  //      判据唯一真源:core/qc/firstInspCols.js 的 isFillableCell。
  const rows = await ev(`(() => [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')].map((tr) => ({
      label: (tr.querySelector('th')?.innerText || '').trim(),
      // 可填 = 有文本录入格 或 有勾选项(前两列是勾选式,里面没有 input)
      // ⚠ 末列是操作列 td.col-op(可编辑时的「＋/×」),不算测试项目格,要去掉
      opens: [...tr.querySelectorAll('td:not(.col-op)')].map((td) => (td.querySelector('input') || td.querySelector('.fi-checks')) ? 1 : 0),
      texts: [...tr.querySelectorAll('td:not(.col-op)')].map((td) => (td.innerText || '').trim()),
    })))()`)
  console.log(`  各样品行可填格=${JSON.stringify((rows || []).map((r) => ({ 行: r.label, 可填: r.opens.join('') })))}`)
  ok('① 八个样品行都在(版式照图纸)', Array.isArray(rows) && rows.length === 8, String(rows?.length))
  // 列序 = 表观/脱粉(前两列,勾选式) | 外径/内径/长度/重量/跌落/挤压强度/浊度/压降(其余 8 列)
  const WANT_OPEN = [
    '1111111111', '1111111111',   // 1#/2#:十列全可填
    '0011111111', '0011111111',   // 3#/4#:只有前两列不可填(保持原样)
    '0011111111', '0011111111',   // 5#/6#
    '0011111111', '0011111111',   // 7#/8#
  ]
  ok('① 前两列保持原样(只 1#/2#)、其余列八行全可填',
    JSON.stringify((rows || []).map((r) => r.opens.join(''))) === JSON.stringify(WANT_OPEN),
    JSON.stringify((rows || []).map((r) => r.opens.join(''))))
  ok('① 不可填的格一律打 `/`(现在只剩前两列的 3#..8#)',
    (rows || []).every((r) => r.texts.every((t, i) => (r.opens[i] ? t === '' || /☑|□/.test(t) : t === '/'))),
    JSON.stringify((rows || []).map((r) => r.texts)))
  const slashCount = (rows || []).reduce((n, r) => n + r.texts.filter((t) => t === '/').length, 0)
  ok('① 整张纸的「/」占位格 = 前两列 × 3#..8# = 12 个', slashCount === 12, `实际 ${slashCount}`)

  // ── ② 精度:外径 12.34 → 12.3;挤压强度 33.33 原样 ─────────────────────────
  const setCell = async (colName, rowIdx, v) => ev(`(() => {
    // ⚠ 列头是 <th> 里套 el-input / el-select:innerText **不含 input 的值**,要把控件值也拼进来认列
    const label = (th) => (th.innerText || '') + ' ' + [...th.querySelectorAll('input')].map((i) => i.value).join(' ')
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    const idx = heads.findIndex((th) => label(th).includes(${JSON.stringify(colName)}))
    if (idx < 0) return { err: 'no-col', heads: heads.map(label) }
    const tr = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')][${rowIdx}]
    const cell = [...tr.querySelectorAll('td')][idx]
    const inp = cell.querySelector('input')
    if (!inp) return { err: 'no-input' }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, ${JSON.stringify(v)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.dispatchEvent(new Event('blur', { bubbles: true }))
    return { ok: true, idx }
  })()`)
  const readCell = async (colName, rowIdx) => ev(`(() => {
    const label = (th) => (th.innerText || '') + ' ' + [...th.querySelectorAll('input')].map((i) => i.value).join(' ')
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    const idx = heads.findIndex((th) => label(th).includes(${JSON.stringify(colName)}))
    const tr = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')][${rowIdx}]
    const cell = [...tr.querySelectorAll('td')][idx]
    const inp = cell.querySelector('input')
    return inp ? inp.value : (cell.innerText || '').trim()
  })()`)
  const w1 = await setCell('炭棒外径', 2, '12.34')   // 2#..8# 任一行都行(现在八行全可填),取 3#
  await sleep(600)
  const v1 = await readCell('炭棒外径', 2)
  console.log(`  外径 12.34 → ${JSON.stringify(v1)} (${JSON.stringify(w1)})`)
  ok('② 内外径/长度/重量:超过 1 位小数被取整(12.34 → 12.3)', String(v1) === '12.3', String(v1))
  const toast = await ev(`(document.querySelector('.el-message')?.innerText || '')`)
  ok('② 取整时给了提示', /取整|小数点/.test(String(toast)), String(toast).slice(0, 80))

  const w2 = await setCell('挤压强度', 4, '33.33')   // 取 5#(行号 0-based 4)
  await sleep(500)
  const v2 = await readCell('挤压强度', 4)
  console.log(`  挤压强度 33.33 → ${JSON.stringify(v2)} (${JSON.stringify(w2)})`)
  ok('② 挤压强度/压降:按表显数据记录(33.33 原样保留)', String(v2) === '33.33', String(v2))

  // ── ③ 浊度列排在压降列之前(顺序口径保留) ──────────────────────────────────
  //    ⚠ 2026-10-16 第五轮用户口径:「删除黄框的内容」= 删掉原先那行「先测初始浊度,再测压降」提示条,
  //      故这里改为验**列序**(浊度在压降之前)+ 提示条**不再出现**。
  const order = await ev(`(() => {
    // ⚠ 只认**列名**(列头第一个 input);用 th.innerText 会把分组下拉的「浊度及压降」也带进来,
    //   于是"浊度"和"压降"匹配到同一列(踩过)
    const label = (th) => { const i = th.querySelector('input'); return i ? i.value : (th.innerText || '') }
    return [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')].map(label)
  })()`)
  const iT = (order || []).findIndex((x) => /浊度|NTU/i.test(x))
  const iP = (order || []).findIndex((x) => /压降|kPa/i.test(x))
  ok('③ 浊度列排在压降列之前(先测初始浊度,再做压降)', iT >= 0 && iP > iT, `浊度#${iT} 压降#${iP}`)
  const tips = await ev(`document.querySelectorAll('.fi-sheet .fi-tip').length`)
  ok('③ 纸张上不再有浊度/压降提示条(第五轮口径:删掉黄框那行)', Number(tips) === 0, String(tips))

  // ── ④ 严重粘模 ⇒ 红色警示 + 常驻红幅 ──────────────────────────────────────
  await ev(`(() => {
    const tr = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')][0]
    const span = [...tr.querySelectorAll('.fi-check-txt')].find((s) => (s.innerText || '').trim() === '严重粘模（脱皮）')
    if (span) span.click(); return 'ok'
  })()`)
  await sleep(900)
  const box = await ev(`!!document.querySelector('.el-message-box')`)
  ok('④ 勾上「严重粘模（脱皮）」当场弹警示', box === true, String(box))
  const danger = await ev(`(document.querySelector('.fi-sheet .fi-alert.is-danger')?.innerText || '')`)
  ok('④ 纸张顶部出现红色停线隔离横幅', /停止生产/.test(String(danger)), String(danger).slice(0, 60))
  // 关掉弹窗,再取消勾选 ⇒ 横幅消失
  await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns button')].pop(); if(b) b.click(); return 'ok' })()`)
  await sleep(500)
  await ev(`(() => {
    const tr = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')][0]
    const span = [...tr.querySelectorAll('.fi-check-txt')].find((s) => (s.innerText || '').trim() === '严重粘模（脱皮）')
    if (span) span.click(); return 'ok'
  })()`)
  await sleep(700)
  const danger2 = await ev(`!!document.querySelector('.fi-sheet .fi-alert.is-danger')`)
  ok('④ 取消勾选后红色横幅随之消失', danger2 === false, String(danger2))

  // ── ⑤ C-95 ⇒ C-95 提醒条 ──────────────────────────────────────────────────
  await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-head')
    const ths = [...t.querySelectorAll('th')]
    const i = ths.findIndex((th) => (th.innerText || '').trim() === '产品编号')
    const inp = [...t.querySelectorAll('td')][i].querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, 'C-95-TEST'); inp.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
  await sleep(700)
  const warn = await ev(`(document.querySelector('.fi-sheet .fi-alert.is-warn')?.innerText || '')`)
  ok('⑤ 产品编号含 C-95 ⇒ 出现「脱模后立马进行首件检验」提醒条', /C-95/.test(String(warn)), String(warn).slice(0, 60))
  await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-head')
    const ths = [...t.querySelectorAll('th')]
    const i = ths.findIndex((th) => (th.innerText || '').trim() === '产品编号')
    const inp = [...t.querySelectorAll('td')][i].querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, 'ABC95-X'); inp.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
  await sleep(600)
  const warn2 = await ev(`!!document.querySelector('.fi-sheet .fi-alert.is-warn')`)
  ok('⑤ 词边界不误命中(ABC95 不算 C-95 客户)', warn2 === false, String(warn2))

  ok('⑥ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))

  // ── 出图(可选):把 C-95 提醒条 + 停线隔离红幅 + 2 支样品版式一起拍进一张图,人眼比对用 ──
  const shotIdx = process.argv.indexOf('--shot')
  if (shotIdx > 0) {
    const out = process.argv[shotIdx + 1]
    await ev(`(() => {
      const t = document.querySelector('.fi-sheet .fi-head')
      const ths = [...t.querySelectorAll('th')]
      const i = ths.findIndex((th) => (th.innerText || '').trim() === '产品编号')
      const inp = [...t.querySelectorAll('td')][i].querySelector('input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(inp, 'C-95-TEST'); inp.dispatchEvent(new Event('input', { bubbles: true }))
      const tr = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')][0]
      const span = [...tr.querySelectorAll('.fi-check-txt')].find((s) => (s.innerText || '').trim() === '严重粘模（脱皮）')
      if (span) span.click()
      const b = [...document.querySelectorAll('.el-message-box__btns button')].pop(); if (b) b.click()
      return 'ok'
    })()`)
    await sleep(1200)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('截图:' + out)
  }
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 首件检验单「相关要求」落地:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
