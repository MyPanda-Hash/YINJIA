/**
 * _cdp-proc-cols.mjs — 制程检验单「图2 分组横表 + 外观固定列 + 表头『列数』动态列」验收探针。
 *
 * 断言(用户 2026-10-17 口径):
 *   ① 表格里三张单据要素固定列在(检验时间…抽检总量)+ 右侧 结果判断;
 *   ② 外观组先铺「端盖两头」「管身两侧」两个**固定列**(表头不是输入框、没有 × 删除);
 *   ③ 标准三表区恒在(外观/尺寸/出货重量,空单也铺);自定义列数 = 「列数」字段;
 *   ④ 「列数」＋/－ 在**表格外**(.qr-colbar),不是表格里的按钮;
 *   ⑤ 只读态也铺出表结构(不再是「暂无检验项」一行)。
 * 另附截图(zh-CN / en),便于人工核对版式。
 *
 * 用法(node tools/archive/_qc-proc/_cdp-proc-cols.mjs [baseUrl] [panelCode] [docNo])
 *   默认 http://127.0.0.1:5173(源码即时生效;8090 是打包版)。令牌自签(见 _mk-token.mjs)。
 * ⚠ Edge 坑(见 memory qc-proc-insp-blocks):--headless=new 会塞 edge://sync-confirmation-dialog,
 *   取页必须过滤 ^edge:// 并优先 about:blank。
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../node_modules/ws/index.js'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const panel = process.argv[3] || 'QC_PROC_INSP'
const wantNo = process.argv[4] || ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 自签令牌(与 _mk-token.mjs 同算法):开发实例 JWT 密钥 = application.yml 默认值 */
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const head = b64({ alg: 'HS256' })
const body = b64({ sub: 'admin', factory: process.env.YJ_PROBE_FACTORY || 'YJ', iat: now, exp: now + 6 * 3600 })
const token = `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1800,1100',
    '--remote-debugging-port=9391', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'proc-cols-')), 'about:blank'],
  { stdio: 'ignore' })

let ws
const fail = []
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`PASS ${name}${extra ? ' — ' + extra : ''}`)
  else { fail.push(name); console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}

try {
  let tab
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch('http://127.0.0.1:9391/json/list').then((r) => r.json())
      tab = list.find((t) => t.type === 'page' && !/^edge:/.test(t.url)) || null
      if (!tab) tab = await fetch('http://127.0.0.1:9391/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
      break
    } catch { await sleep(250) }
  }
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let n = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw Error(JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await send('Page.navigate', { url: base + '/#/login' })
  await sleep(1500)
  await ev(`localStorage.setItem('mes_token',${JSON.stringify(token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify({ userName: 'admin', realName: '系统管理员', isAdmin: true }))});localStorage.setItem('mes_init_done','1');localStorage.setItem('mes_locale','zh-CN')`)
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(200)
  await send('Page.navigate', { url: `${base}/#/panelx/list/${panel}` })
  await sleep(6000)

  // 关掉可能的弹窗,选中目标单据(默认第一张)
  await ev(`(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach(b => b.click()); return 1 })()`)
  await sleep(300)
  const sheetReady = await ev(`!!document.querySelector('.qr-sheet, .qr-grid, .qc-rec-sheet, .approval-sheet')`)
  ok('面板纸张表渲染', sheetReady)
  if (wantNo) {
    await ev(`(() => { const el=[...document.querySelectorAll('.approval-side .as-side-btn')].find(b=>/查询单据/.test(b.innerText)); el&&el.click(); return 1 })()`)
    await sleep(800)
    await ev(`(() => { const i=document.querySelector('.el-dialog input'); if(!i) return 0; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(i, ${JSON.stringify(wantNo)}); i.dispatchEvent(new Event('input',{bubbles:true})); return 1 })()`)
    await sleep(300)
    await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog .el-button--primary')].pop(); b&&b.click(); return 1 })()`)
    await sleep(3000)
  }

  const probe = await ev(`(() => {
    const grid = document.querySelector('.qr-grid')
    if (!grid) return { err: 'no .qr-grid' }
    const thead = grid.querySelector('thead')
    const rows = [...thead.querySelectorAll('tr')]
    const groupRow = rows[0] ? [...rows[0].children].map((th) => th.innerText.trim()) : []
    const subRow = rows[1] ? [...rows[1].children].map((th) => ({ text: th.innerText.trim(), hasInput: !!th.querySelector('input'), del: !!th.querySelector('.qr-item-del') })) : []
    const band = document.querySelector('.qr-band')
    return {
      docNo: (document.querySelector('.doc-chip') || {}).innerText || '',
      groupRow,
      subRow,
      colbar: (document.querySelector('.qr-colbar') || {}).innerText || '',
      colbarInsideTable: !!grid.querySelector('.qr-colbar'),
      fixedCols: [...grid.querySelectorAll('thead th.c-fixed')].map((th) => th.innerText.trim()),
      sectorCount: thead.querySelectorAll('th.c-group').length,
      bodyRows: grid.querySelectorAll('tbody tr').length,
      emptyText: document.body.innerText.includes('暂无检验项'),
      bandText: band ? band.innerText.trim() : '',
      sheetCssText: getComputedStyle(document.querySelector('.qr-sheet') || document.body).display,
    }
  })()`)
  console.log(JSON.stringify(probe, null, 2))

  const fixed = ['检验时间', '客户名称', '产品编码', '型号（mm）', '批号', '抽检总量']
  for (const f of fixed) ok(`固定列 ${f} 在表头`, probe.fixedCols.includes(f))
  ok('右侧 结果判断', probe.fixedCols.includes('结果判断'))
  ok('标准三表区都在(外观/尺寸/出货重量)', ['外观', '尺寸', '出货重量'].every((s) => probe.groupRow.some((g) => g.indexOf(s) >= 0)), probe.groupRow.join(' | '))
  const appearance = probe.subRow.slice(0, 3)
  ok('外观组先铺 端盖两头/管身两侧(固定列:不是输入框、没有删除 ×)',
    /^端盖两头/.test(appearance[0]?.text || '') && appearance[0]?.hasInput === false && appearance[0]?.del === false &&
    /^管身两侧/.test(appearance[1]?.text || '') && appearance[1]?.hasInput === false && appearance[1]?.del === false,
    JSON.stringify(appearance))
  ok('「列数」控件在表格外(.qr-colbar,不在表内)', !!probe.colbar && !probe.colbarInsideTable, probe.colbar.replace(/\\s+/g, ' '))
  ok('列数控件含 − / ＋', /－/.test(probe.colbar) && /＋/.test(probe.colbar))
  ok('不再出现「暂无检验项」一行(空单也铺表结构)', probe.emptyText === false)

  // ── 「列数」＋/－ 交互(表格外控件;减列要确认弹窗)──
  const colState = async () => ev(`(() => {
    const grid = document.querySelector('.qr-grid')
    const n = (document.querySelector('.qr-colbar-num') || {}).innerText || ''
    const names = [...grid.querySelectorAll('thead tr:nth-child(2) th.c-item-hd input')].length
    const groups = grid.querySelectorAll('thead th.c-group').length
    return { n: n.trim(), nameInputs: names, groups, fixedItems: [...grid.querySelectorAll('thead tr:nth-child(2) th.c-fixeditem')].map((th) => th.innerText.replace(/[\\s\\S]*?([\\u4e00-\\u9fa5]{2,})[\\s\\S]*/, '$1')) }
  })()`)
  const before = await colState()
  await ev(`(() => { const b=[...document.querySelectorAll('.qr-colbar-btn')].pop(); b && b.click(); return 1 })()`)
  await sleep(500)
  const after = await colState()
  ok('点 ＋ 后 列数 +1', Number(after.n) === Number(before.n) + 1, `${before.n} → ${after.n}`)
  ok('点 ＋ 后 每个表区多一列(自定义列数 = 列数 × 表区数)', after.nameInputs === Number(after.n) * after.groups,
    `列数=${after.n} 表区数=${after.groups} 列头输入框=${after.nameInputs}`)
  await ev(`(() => { const b=[...document.querySelectorAll('.qr-colbar-btn')][0]; b && b.click(); return 1 })()`)
  await sleep(500)
  // 空表区减列没有数据可清 ⇒ 不出确认弹窗(用户口径:清空该列数据才需要确认)
  const dlgEmpty = await ev(`!!document.querySelector('.el-message-box')`)
  ok('无可清数据的减列:不弹确认(点了就落)', dlgEmpty === false)
  const back = await colState()
  ok('减列后 列数 回到原值', back.n === before.n, `${after.n} → ${back.n}(原 ${before.n})`)

  // ── 有数据时的减列:必须确认,确认后该列数据被清掉 ──
  await ev(`(() => { const b=[...document.querySelectorAll('.qr-colbar-btn')].pop(); b && b.click(); return 1 })()`)
  await sleep(500)
  const typed = await ev(`(() => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const ins = [...document.querySelectorAll('.qr-grid thead tr:nth-child(2) th.c-item-hd input')]
    const vals = ['外观A', '外观B']
    vals.forEach((v, i) => { const el = ins[i]; if (!el) return; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
    return { inputs: ins.length, first: ins[0] ? ins[0].value : '', second: ins[1] ? ins[1].value : '' }
  })()`)
  await sleep(500)
  ok('空列填项目名即建行(列头变可填)', typed.first === '外观A' && typed.second === '外观B', JSON.stringify(typed))
  await ev(`(() => { const b=[...document.querySelectorAll('.qr-colbar-btn')][0]; b && b.click(); return 1 })()`)
  await sleep(700)
  const dlg = await ev(`!!document.querySelector('.el-message-box')`)
  ok('有数据的减列:弹出确认弹窗(清空该列数据)', dlg === true)
  await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box .el-button')].find(x=>/确定|OK/.test(x.innerText)); b && b.click(); return 1 })()`)
  await sleep(600)
  const kept = await ev(`(() => {
    const ins = [...document.querySelectorAll('.qr-grid thead tr:nth-child(2) th.c-item-hd input')]
    return { n: (document.querySelector('.qr-colbar-num') || {}).innerText.trim(), first: ins[0] ? ins[0].value : '', inputs: ins.length }
  })()`)
  ok('确认减列后:第 2 列被清掉、第 1 列留着', kept.first === '外观A' && kept.n === before.n, JSON.stringify(kept))

  // 截图(zh-CN / en):版式人工核对用
  for (const locale of ['zh-CN', 'en']) {
    if (locale !== 'zh-CN') {
      await ev(`(async()=>{const app=document.querySelector('#app').__vue_app__;await app.config.globalProperties.$pinia._s.get('locale').set(${JSON.stringify(locale)})})()`)
      await sleep(1500)
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const out = `tools/archive/_qc-proc/_proc-cols-${locale}.png`
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log(`shot -> ${out}`)
  }
  // 英文态:固定列/表区名仍是数据键(中文),但空列提示与按钮应为英文
  const enProbe = await ev(`(() => {
    const grid = document.querySelector('.qr-grid')
    return {
      hint: [...grid.querySelectorAll('.qr-cell-hint')].map((s) => s.innerText.trim()).slice(0, 3),
      colbar: (document.querySelector('.qr-colbar') || {}).innerText || '',
      band: (document.querySelector('.qr-band') || {}).innerText || '',
    }
  })()`)
  console.log('EN:', JSON.stringify(enProbe))
  ok('英文态:空列提示走 tt()(不再是中文)', enProbe.hint.every((h) => !/按照/.test(h)), enProbe.hint.join(' | '))
} catch (e) {
  console.log('PROBE ERROR: ' + (e?.stack || e))
  fail.push('probe-error')
} finally {
  ws?.close()
  edge.kill()
}
console.log(fail.length ? `\n=== 探针失败 ${fail.length} 项: ${fail.join(', ')} ===` : '\n=== 探针全部通过 ===')
process.exit(fail.length ? 1 : 0)
