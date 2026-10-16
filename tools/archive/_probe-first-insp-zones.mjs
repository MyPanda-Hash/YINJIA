/*
 * _probe-first-insp-zones.mjs — 首件检验单「每个分组各记录 2 支样品」的端到端验收(2026-10-17)
 *
 * 【用户口径】「当前的首件检验单的表格应该是这种实现方式实现的,当前为全部都在最上面两行可被填写,
 *   而不是如图形式实现」—— 图片版式:四个分组各占**自己那一对**样品行,本组的格子空白可填(带底色),
 *   其余格打「/」。改前整张纸只有 1#/2# 的表观·脱粉两格能录,尺寸/强度/浊度三组**永远填不进去**。
 *
 * 【验什么】
 *   ① 10 个测试项目的可填样品行 = 本组那一对(表观及脱粉 1#/2#、尺寸及重量 3#/4#、强度 5#/6#、
 *      浊度及压降 7#/8#),其余格一律「/」;
 *   ② 可填区底色照图片(表观·强度 = #FFF3CA;尺寸·浊度 = #FCE4D3),非本组格白底;
 *   ③ 不可填格的 title 说清"本组该填哪两支"(3#/4# …),不能只留一片「/」让人猜;
 *   ④ **真落库**:填 5 个格(跨四个分组)保存后,库里恰好这 5 行有实测数值、且样品序号与分组对得上;
 *   ⑤ 无未捕获异常。
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

/** 图片上的 10 个测试项目 → 本组那一对样品行(0-based:1# = 0)。
 *  第三项 = 数据键(检验列):库里存的是 key,列名只是显示 —— 核对落库要按 key。 */
const EXPECT = [
  ['炭棒表观状态', [0, 1], 'appearance'], ['炭棒脱粉情况', [0, 1], 'depowder'],
  ['炭棒外径', [2, 3], 'outer'], ['炭棒内径', [2, 3], 'inner'],
  ['炭棒长度', [2, 3], 'length'], ['炭棒重量', [2, 3], 'weight'],
  ['跌落', [4, 5], 'drop'], ['挤压强度', [4, 5], 'compress'],
  ['浊度NTU', [6, 7], 'turbidity'], ['压降kPa', [6, 7], 'pressure'],
]
/** 底色(图片主色):表观及脱粉/强度 = 淡黄;尺寸及重量/浊度及压降 = 淡桃 */
const TINT_Y = 'rgb(255, 243, 202)'
const TINT_P = 'rgb(252, 228, 211)'

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
  const grid = await ev(`(() => {
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    const names = heads.map((th) => (th.querySelector('input')?.value || th.innerText || '').trim())
    const rows = [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')]
    return {
      names,
      cells: rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => ({
        open: !!td.querySelector('input') || !!td.querySelector('.fi-checks'),
        text: (td.innerText || '').trim(),
        title: td.querySelector('span')?.getAttribute('title') || '',
        bg: getComputedStyle(td).backgroundColor,
      }))),
    }
  })()`)
  console.log(`  纸面列名=${JSON.stringify(grid?.names)}`)

  for (const [name, want] of EXPECT) {    const ci = (grid?.names || []).findIndex((n) => n.includes(name))
    if (ci < 0) { ok(`① ${name} 列存在`, false, JSON.stringify(grid?.names)); continue }
    const open = grid.cells.map((row, i) => (row[ci]?.open ? i : -1)).filter((i) => i >= 0)
    ok(`① 「${name}」可填行 = ${want.map((i) => `${i + 1}#`).join('/')}`,
      JSON.stringify(open) === JSON.stringify(want),
      `实际 ${open.map((i) => `${i + 1}#`).join('/') || '（无）'}`)
    const blanks = grid.cells.map((row, i) => (!row[ci]?.open && row[ci]?.text !== '/' ? i : -1)).filter((i) => i >= 0)
    ok(`① 「${name}」其余格是「/」占位`, blanks.length === 0,
      `异常行 ${blanks.map((i) => `${i + 1}#(${grid.cells[i][ci]?.text})`).join(' ')}`)
    // ③ 提示话术:把本组那两支样品说出来
    const hint = grid.cells.find((row) => row[ci] && !row[ci].open)?.[ci]?.title || ''
    ok(`③ 「${name}」不可填格的 title 指明本组样品`,
      hint.includes(want.map((i) => `${i + 1}#`).join('、')),
      `title=${JSON.stringify(hint)}`)
  }

  // ② 底色:照图片的四段色带
  for (const [name, rowIdx, tint, what] of [
    ['炭棒表观状态', 0, TINT_Y, '表观及脱粉 1#'],
    ['炭棒外径', 2, TINT_P, '尺寸及重量 3#'],
    ['跌落', 4, TINT_Y, '强度 5#'],
    ['浊度NTU', 6, TINT_P, '浊度及压降 7#'],
  ]) {
    const info = await ev(cellInfo(name, rowIdx))
    ok(`② ${what} 可填格底色 = 图片色 ${tint}`, info?.bg === tint, `实际 ${info?.bg}`)
  }
  const offZone = await ev(cellInfo('炭棒外径', 0))
  // td 不设底色 = 透明,纸上就是 .fi-sheet 的白底(与图纸一致)
  ok('② 非本组的格保持白底(外径 @1#)', ['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'].includes(String(offZone?.bg)),
    `实际 ${offZone?.bg}`)

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

  // 落库前先在**真单**上再核一遍「列 → 本组那两支样品」的对应(工艺清单带进来的列也该守同一条规则)
  const realGrid = await ev(`(() => {
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    return heads.map((th) => ({
      name: (th.querySelector('input')?.value || th.innerText || '').trim(),
      group: (th.querySelector('.fi-colgroup')?.innerText || '').split('\\n')[0].trim(),
    }))
  })()`)
  const colsByGroup = {}
  for (const c of realGrid || []) (colsByGroup[c.group] = colsByGroup[c.group] || []).push(c.name)
  const PAIR = { '表观及脱粉': [1, 2], '尺寸及重量': [3, 4], '强度': [5, 6], '浊度及压降': [7, 8] }
  const openOfGroup = (g) => ev(`(() => {
    const heads = [...document.querySelectorAll('.fi-sheet .fi-grid thead tr:nth-child(2) th.col-head')]
    const idx = heads.findIndex((th) => (th.querySelector('.fi-colgroup')?.innerText || '').split('\\n')[0].trim() === ${JSON.stringify(g)})
    if (idx < 0) return null
    return [...document.querySelectorAll('.fi-sheet .fi-grid tbody tr.sample-row')]
      .map((tr, i) => ([...tr.querySelectorAll('td')][idx]?.querySelector('input, .fi-checks') ? i + 1 : -1))
      .filter((i) => i > 0)
  })()`)
  for (const [g, pair] of Object.entries(PAIR)) {
    const open = await openOfGroup(g)
    if (!open) continue
    ok(`④ 真单「${g}」可填行 = ${pair.join('/')}#`, JSON.stringify(open) === JSON.stringify(pair), `实际 ${open.join('/')}#`)
  }

  // 四个分组各填一格(表观那列是勾选式)—— 一项 = [列名, 数据键, 样品行, 值, 勾选项]
  const FILL = [
    ['炭棒表观状态', 'appearance', 1, null, '无粘模（均匀）'],
    ['炭棒外径', 'outer', 3, '34.2'],
    ['跌落', 'drop', 5, '5'],
    ['浊度NTU', 'turbidity', 7, '1.1'],
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
    ok('④ 填的 4 格落在**本组那两支样品**上(不串行)', JSON.stringify(got) === JSON.stringify(want),
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
console.log(`\n== 首件检验单「每组各 2 支样品」:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
