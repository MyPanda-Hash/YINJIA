/*
 * _probe-first-insp-zones.mjs — 首件检验单「可填范围」的端到端验收(2026-10-17)
 *
 * 【用户口径·最终版】「让当前各个表格都能填写即可,**前两列保持原样**即可」,
 *   追问后补充「**以及后面新增的列也一样**」——
 *   · 前两列(炭棒表观状态 / 炭棒脱粉情况,勾选式):保持原样,只记 1#/2#,3#..8# 打「/」;
 *   · 其余所有测试项目列(图纸 8 列 + 表头「＋」新增的列):**1#..8# 八行全部可填**。
 *   (更早那版"四个分组各绑一对样品行"已作废,别再照着它改。)
 *
 * 【验什么】
 *   ① 前两列只 1#/2# 可填(且仍是勾选式)、3#..8# 照旧「/」;
 *   ② 其余 8 列 1#..8# **每一格都是录入格**、没有「/」占位;
 *   ③ 底色只留在前两列 1#/2#(其余列八行全可填 ⇒ 再铺底色就是无意义装饰);
 *   ④ **新增一列也一样**(点表头「＋」后新列同样八行全可填);
 *   ⑤ **真落库**:特意往**改前不可填**的格(外径 1#/8#)填值,保存后库里这几行对得上;
 *   ⑥ 无未捕获异常。
 *
 * ⚠ 全在**测试账套** HSDZ_MES_TEST(factory=YJ_TEST)上跑:会建一张草稿,跑完硬删。
 * 用法: node tools/archive/_probe-first-insp-zones.mjs [base] [--shot 前缀]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
const PORT = 9500
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

/** 图纸上 10 个测试项目 —— 前两列是勾选式(保持原样),其余 8 列可填范围全开。
 *  第二项 = 数据键(检验列):库里存的是 key,列名只是显示 —— 核对落库要按 key。 */
const CHECK_COLS = [['炭棒表观状态', 'appearance'], ['炭棒脱粉情况', 'depowder']]
const OTHER_COLS = [
  ['炭棒外径', 'outer'], ['炭棒内径', 'inner'], ['炭棒长度', 'length'], ['炭棒重量', 'weight'],
  ['跌落', 'drop'], ['挤压强度', 'compress'], ['浊度NTU', 'turbidity'], ['压降kPa', 'pressure'],
]
const ALL_COLS = [...CHECK_COLS, ...OTHER_COLS]
/** 前两列「保持原样」的样品范围;其余列 1#..8# 全开 */
const CHECK_ROWS = [0, 1]
/** 前两列可填格的底色(图片主色:淡黄) */
const TINT_Y = 'rgb(255, 243, 202)'

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

const before = new Set((await q(`SELECT 单据编号 FROM dbo.qc_first_insp_head`)).map((r) => r.单据编号))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fizon-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let created = ''
let junk = []
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
  const clickByText = (text) => ev(`(() => {
    const el = [...document.querySelectorAll('button, .as-side-btn, [class*=as-side] span, .el-button')]
      .find((e) => (e.innerText || '').trim() === ${JSON.stringify(text)})
    if (!el) return false
    el.click(); return true
  })()`)
  /** 第 colName 列、第 rowIdx 行(0-based,1#=0)那一格 */
  const cellOf = (colName, rowIdx) => `(() => {
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    const label = (th) => (th.innerText || '') + ' ' + [...th.querySelectorAll('input')].map((i) => i.value).join(' ')
    const idx = heads.findIndex((th) => label(th).includes(${JSON.stringify(colName)}))
    const tr = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')][${rowIdx}]
    return tr ? [...tr.querySelectorAll('td')][idx] : null
  })()`
  const cellInfo = (colName, rowIdx) => `(() => {
    const td = ${cellOf(colName, rowIdx)}
    if (!td) return null
    const span = td.querySelector('span')
    return {
      input: !!td.querySelector('input'),
      checks: !!td.querySelector('.fi-checks'),
      text: (td.innerText || '').trim(),
      title: (span && span.getAttribute('title')) || '',
      bg: getComputedStyle(td).backgroundColor,
    }
  })()`
  const setInput = (selExpr, v) => ev(`(() => {
    const inp = ${selExpr}
    if (!inp) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, ${JSON.stringify(v)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1200, deviceScaleFactor: 1, mobile: false })
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

  // 起一张新草稿(兜底铺上图纸的 10 列)
  await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
  await sleep(2800)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(1200)
  const cols = await ev(`document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head').length`)
  ok('① 草稿铺满图纸 10 列', Number(cols) === 10, `${cols} 列`)

  // ── ① / ② / ③ 逐列逐行核「哪一格可填 + 底色 + 提示」─────────────────────
  const readGrid = () => ev(`(() => {
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    const names = heads.map((th) => (th.querySelector('input')?.value || th.innerText || '').trim())
    const rows = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')]
    return {
      names,
      cells: rows.map((tr) => [...tr.querySelectorAll('td:not(.col-op)')].map((td) => ({
        open: !!td.querySelector('input') || !!td.querySelector('.fi-checks'),
        checks: !!td.querySelector('.fi-checks'),
        text: (td.innerText || '').trim(),
        title: td.querySelector('span')?.getAttribute('title') || '',
        bg: getComputedStyle(td).backgroundColor,
      }))),
    }
  })()`)
  const grid = await readGrid()
  console.log(`  纸面列名=${JSON.stringify(grid?.names)}`)
  const ci = (name) => (grid?.names || []).findIndex((n) => n.includes(name))

  for (const [name] of CHECK_COLS) {
    const c = ci(name)
    if (c < 0) { ok(`① 「${name}」列存在`, false, JSON.stringify(grid?.names)); continue }
    const open = grid.cells.map((row, i) => (row[c]?.open ? i : -1)).filter((i) => i >= 0)
    ok(`① 前两列「${name}」**保持原样**:只 1#/2# 可填`,
      JSON.stringify(open) === JSON.stringify(CHECK_ROWS), `实际 ${open.map((i) => `${i + 1}#`).join('/') || '（无）'}`)
    const bad = grid.cells.map((row, i) => (!row[c]?.open && row[c]?.text !== '/' ? i : -1)).filter((i) => i >= 0)
    ok(`① 「${name}」3#..8# 照旧打「/」`, bad.length === 0,
      `异常行 ${bad.map((i) => `${i + 1}#(${grid.cells[i][c]?.text})`).join(' ')}`)
    ok(`① 「${name}」是勾选式(1#/2# 里是勾选项而不是输入框)`,
      grid.cells[0][c]?.checks === true && grid.cells[1][c]?.checks === true,
      JSON.stringify([grid.cells[0][c]?.checks, grid.cells[1][c]?.checks]))
    const hint = grid.cells[2]?.[c]?.title || ''
    ok(`③ 「${name}」不可填格的 title 说明只记 1#、2#`, hint.includes('1#、2#'), `title=${JSON.stringify(hint)}`)
  }

  for (const [name] of OTHER_COLS) {
    const c = ci(name)
    if (c < 0) { ok(`② 「${name}」列存在`, false, JSON.stringify(grid?.names)); continue }
    const open = grid.cells.map((row, i) => (row[c]?.open ? i : -1)).filter((i) => i >= 0)
    ok(`② 「${name}」1#..8# 八行**全部可填**`, JSON.stringify(open) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]),
      `实际 ${open.map((i) => `${i + 1}#`).join('/') || '（无）'}`)
    const slash = grid.cells.map((row, i) => (row[c]?.text === '/' ? i : -1)).filter((i) => i >= 0)
    ok(`② 「${name}」没有「/」占位格了`, slash.length === 0,
      `仍打斜杠的行 ${slash.map((i) => `${i + 1}#`).join(' ')}`)
  }

  // ② 底色:只留前两列 1#/2#(现在只有它们还有"可填/不可填"之分)
  for (const [name, rowIdx, want, what] of [
    ['炭棒表观状态', 0, TINT_Y, '前两列 1#'],
    ['炭棒脱粉情况', 1, TINT_Y, '前两列 2#'],
    ['炭棒表观状态', 2, null, '前两列 3#(不可填 ⇒ 不铺底)'],
    ['炭棒外径', 0, null, '其余列 1#(全可填 ⇒ 不铺底)'],
    ['炭棒外径', 3, null, '其余列 4#'],
  ]) {
    const info = await ev(cellInfo(name, rowIdx))
    const isWhite = ['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'].includes(String(info?.bg))
    ok(`② ${what} 底色${want ? ' = 图片色 ' + want : '为白底'}`,
      want ? info?.bg === want : isWhite, `实际 ${info?.bg}`)
  }

  // ③ 新增的列也一样(用户补充口径「以及后面新增的列也一样」)
  await ev(`(() => { const b=document.querySelector('.fi-sheet .fi-addcol'); if(b) b.click(); return 'ok' })()`)
  await sleep(900)
  const grid2 = await readGrid()
  const addedIdx = grid2.cells[0].length - 1
  const addedName = grid2.names[addedIdx]
  const addedOpen = grid2.cells.map((row, i) => (row[addedIdx]?.open ? i : -1)).filter((i) => i >= 0)
  ok(`③ 新增列「${addedName}」也是 1#..8# 八行全可填`,
    JSON.stringify(addedOpen) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]),
    `实际 ${addedOpen.map((i) => `${i + 1}#`).join('/') || '（无）'}`)
  ok('③ 新增列出现在表头(说明确实加上了)', !!addedName && grid2.names.length === grid.names.length + 1,
    `${grid.names.length} → ${grid2.names.length}`)

  const shotIdx = process.argv.indexOf('--shot')
  const shoot = async (suffix) => {
    if (shotIdx < 0) return
    const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(`${process.argv[shotIdx + 1]}-${suffix}.png`, Buffer.from(s.result.data, 'base64'))
    console.log(`  截图:${process.argv[shotIdx + 1]}-${suffix}.png`)
  }
  await shoot('zones')

  // ── ④ 真落库:走「选生产工单」建一张**带工单号**的单(手动「新增」的草稿没有工单号,
  //        「工单号」必填 ⇒ 保存会被拦下,这是本面板既有口径),再在本组那一对样品上各填一格。
  const setHead = (label, v) => ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-head')
    const ths = [...t.querySelectorAll('th')]
    const i = ths.findIndex((th) => (th.innerText || '').trim() === ${JSON.stringify(label)})
    const inp = [...t.querySelectorAll('td')][i]?.querySelector('input')
    if (!inp) return 'no-input'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, ${JSON.stringify(v)}); inp.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'
  })()`)
  console.log(`  产品编号填入=${await setHead('产品编号', 'DEMO-A-001')}`)
  await sleep(500)
  const opened = await clickByText('选生产工单')
  await sleep(2500)
  const pickRows = await ev(`document.querySelectorAll('.el-dialog .el-table__body tbody tr').length`)
  ok('④ 弹窗列出生产工单行', Number(pickRows) > 0, String(pickRows))
  await ev(`(() => { const tr=document.querySelector('.el-dialog .el-table__body tbody tr'); if(tr) tr.click(); return 'ok' })()`)
  await sleep(700)
  await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button')].find((x)=>(x.innerText||'').trim()==='确定'); if(b) b.click(); return 'ok' })()`)
  await sleep(4000)
  const mkMsg = String(await ev(`[...document.querySelectorAll('.el-message')].map((m) => (m.innerText || '').trim()).join(' | ')`))
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(1200)
  console.log(`  建单提示=${JSON.stringify(mkMsg.slice(0, 160))}  打开=${opened}`)
  const after = (await q(`SELECT 单据编号 FROM dbo.qc_first_insp_head`)).map((r) => r.单据编号)
  // ⚠ 点「新增」时面板就已经在库里落了一条表头(所以会有 2 个新号):真正在界面上打开的那张是
  //   号最大的那张(选生产工单建出来的);清场把两条都删掉,别留孤儿表头。
  junk = after.filter((n) => !before.has(n))
  created = (mkMsg.match(/SJ-[0-9A-Za-z-]+/) || [''])[0] || junk.slice().sort().at(-1) || ''
  ok('④ 建出一张首件检验单草稿', !!created, `新增 ${JSON.stringify(junk)}`)

  // 落库前先在**真单**上再核一遍可填范围(工艺清单带进来的列也该守同一条规则)
  const realGrid = await readGrid()
  const rci = (name) => (realGrid?.names || []).findIndex((n) => n.includes(name))
  for (const [name] of CHECK_COLS) {
    const c = rci(name)
    if (c < 0) continue
    const open = realGrid.cells.map((row, i) => (row[c]?.open ? i : -1)).filter((i) => i >= 0)
    ok(`④ 真单前两列「${name}」只 1#/2# 可填`, JSON.stringify(open) === JSON.stringify(CHECK_ROWS),
      `实际 ${open.map((i) => `${i + 1}#`).join('/')}`)
  }
  for (const [name] of OTHER_COLS) {
    const c = rci(name)
    if (c < 0) continue
    const open = realGrid.cells.map((row, i) => (row[c]?.open ? i : -1)).filter((i) => i >= 0)
    ok(`④ 真单「${name}」八行全可填`, JSON.stringify(open) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]),
      `实际 ${open.map((i) => `${i + 1}#`).join('/')}`)
  }

  // 落库抽样:特意挑**改前不可填**的行(外径 1#/8#)+ 前两列(勾选)+ 其余两列
  //   一项 = [列名, 数据键, 样品行(0-based), 值, 勾选项]
  const FILL = [
    ['炭棒表观状态', 'appearance', 1, null, '无粘模（均匀）'],
    ['炭棒外径', 'outer', 0, '34.1'],
    ['炭棒外径', 'outer', 7, '34.8'],
    ['跌落', 'drop', 4, '5'],
    ['浊度NTU', 'turbidity', 6, '1.1'],
  ]
  for (const [name, , rowIdx, v, check] of FILL) {
    if (check) {
      const hit = await ev(`(() => {
        const td = ${cellOf(name, rowIdx)}
        const box = [...(td?.querySelectorAll('.fi-checks .fi-check') || [])]
          .find((b) => (b.innerText || '').includes(${JSON.stringify(check)}))
        if (!box) return false
        box.querySelector('.fi-check-txt').click(); return true
      })()`)
      ok(`④ ${name} ${rowIdx + 1}# 勾上「${check}」`, hit === true, String(hit))
    } else {
      const set = await setInput(`${cellOf(name, rowIdx)}?.querySelector('input')`, v)
      ok(`④ ${name} ${rowIdx + 1}# 录入 ${v}`, set === true, '找不到输入框')
    }
    await sleep(250)
  }
  await sleep(600)

  const saved = await clickByText('保存')
  ok('④ 点得到「保存」', saved === true, String(saved))
  await sleep(400)
  // 提示条 3s 自动消失,故边等边收;有确认框就点掉
  const seen = []
  for (let i = 0; i < 14; i++) {
    const t = String(await ev(`[...document.querySelectorAll('.el-message')].map((m) => (m.innerText || '').trim()).join(' | ')`))
    if (t && !seen.includes(t)) seen.push(t)
    await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns button')].find((x)=>(x.innerText||'').trim()==='确定'); if(b) b.click(); return 'ok' })()`)
    await sleep(400)
  }
  const msgs = seen.join(' | ')
  console.log(`  保存提示=${JSON.stringify(msgs.slice(0, 300))}`)
  ok('④ 保存没有报必填/校验错', !/不能为空|失败|错误/.test(msgs), msgs.slice(0, 200))

  if (created) {
    const all = await q(`SELECT ISNULL(行类型,'') AS 行类型, ISNULL(样品序号,'') AS 样品序号,
        ISNULL(检验列,'') AS 检验列, ISNULL(实测数值,'') AS 实测数值
        FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${created}' ORDER BY 行号`)
    const rows = all.filter((r) => r.实测数值 !== '')
    console.log(`  库内明细 ${all.length} 行;有实测数值的 ${rows.length} 行`)
    const got = rows.map((r) => `${r.检验列}@${r.样品序号}=${r.实测数值}`).sort()
    const want = FILL.map(([, key, i, v, c]) => `${key}@${i + 1}#=${c || v}`).sort()
    ok('④ 填的 5 格都按 key@样品序号 落库(含改前不可填的 1#/8#)', JSON.stringify(got) === JSON.stringify(want),
      `\n        库内=${JSON.stringify(got)}\n        期望=${JSON.stringify(want)}`)
  } else {
    ok('④ 能取到新单号(便于清场)', false, mkMsg.slice(0, 120))
  }

  ok('⑤ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
  for (const no of new Set([...junk, created].filter(Boolean))) {
    await q(`DELETE FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${no}';
             DELETE FROM dbo.qc_first_insp_head WHERE 单据编号=N'${no}'`)
    console.log(`  清场:删掉探针建的 ${no}`)
  }
  await pool.close()
}
console.log(`\n== 首件检验单可填范围(前两列保持原样 / 其余列八行全可填):${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
