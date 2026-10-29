/**
 * _probe-oc-range-cols-20261029.mjs — 订单结转页本轮三条需求的**真实界面取证**
 *   ① 左上角日期从「单日/近N天档位」改成**日期范围选择**(daterange,默认 [今天,今天]);
 *   ② 工具栏「列设置」:勾掉「客户订单号」→ 表头消失;刷新页面仍不出现(后端持久化 + 挂载即应用);
 *      「恢复默认」→ 保存 → 表头回来;
 *   ③ 「型号」旁新增**产品名称**列,值=订单行存货名称(非空);「订单资料」右侧新增**物料编码**单列(有值);
 *   ④ 「列设置」支持**调整列顺序**(▲▼):下移一位 → 保存生效 → 刷新仍按新顺序 → 恢复默认回默认顺序;
 * 附带:旧口径不能回归(今天没数据→弹窗询问;取消=留在本日);英语界面新控件全译、无裸中文;无 JS 报错。
 *
 * 用法(先确认 5173/8090 都在跑):
 *   node tools/archive/_probe-oc-range-cols-20261029.mjs                    # 默认打 http://localhost:5173
 *   node tools/archive/_probe-oc-range-cols-20261029.mjs --url http://127.0.0.1:8090
 * 退出码:0=全绿;1=有失败项。
 *
 * ⚠ 本探针会**写一份** report_column_settings(panelCode=ORDER_CONVERT),结束时再写回"全部可见",
 *   因此不会给用户留下隐藏列;中途失败时收尾会尽力复位(同样写回全部可见)。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const BASE = argOf('--url', 'http://localhost:5173')
const CDP_PORT = Number(argOf('--port', '9413'))
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (cond, msg, extra = '') => {
  results.push(!!cond)
  console.log(`${cond ? '✅' : '❌'} ${msg}${extra ? ' — ' + extra : ''}`)
}
const pad2 = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const TODAY = fmt(new Date())

/* ---------- 后端(经 vite 代理或直连):登录 + 列设置复位 ---------- */
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data?.token
if (!token) { console.error('登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1) }
const post = async (p, body) => (await (await fetch(BASE + '/api' + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body),
})).json())

/** 可隐藏列(与页面 COLUMNS 同口径;复位时全部 visible=true) */
const COLS = ['物料编码', '行号', '下单日期', '客户', '客户等级', '产品名称', '型号', '重点管控', '客户订单号', '需求数量', '已排产数量']
const resetCols = () => post('/px/reportColumnSettings', {
  panelCode: 'ORDER_CONVERT',
  settings: { columns: COLS.map((p) => ({ prop: p, label: p, visible: true })), sort: { prop: '', order: '' } },
})
await resetCols()

/** 待结转数据基线(用来判断"今天有没有数据"、最近有数据的一天) */
const all = (await post('/px/orderConvert/pending', { keyword: '' })).data || []
const latest = all.map((r) => r['下单日期']).filter(Boolean).sort().pop()
const todayCount = all.filter((r) => r['下单日期'] === TODAY).length
console.log(`基线(接口): 全量 ${all.length} 行 / 今天(${TODAY}) ${todayCount} 行 / 最近有数据的一天 ${latest}\n`)

/* ---------- CDP 薄封装(与仓库既有探针同款) ---------- */
async function withEdge(fn) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-oc2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1680,1000', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' })
  try {
    let tab = null
    for (let i = 0; i < 40 && !tab; i++) {
      await sleep(500)
      try { tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json() } catch { /* retry */ }
    }
    if (!tab) throw new Error('Edge CDP 未就绪')
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errors = []
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || ''))
      if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
        errors.push('console.error: ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
      }
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      const file = path.join(ROOT, 'tools', 'archive', `_oc-range-cols-${name}.png`)
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'))
      return file
    }
    await send('Page.enable'); await send('Runtime.enable')
    await fn({ ev, shot, send, errors })
    ws.close()
    return errors
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

/** 关掉「MES 初始化配置」新手引导弹窗(会盖住工具栏) */
async function dismissOnboarding(ev) {
  for (let i = 0; i < 6; i++) {
    const hit = await ev(`(() => {
      const el = [...document.querySelectorAll('button, span, div')].find(e => e.innerText?.trim() === '下次再说' && e.offsetParent !== null);
      if (el) { el.click(); return 'clicked' }
      return document.querySelector('.el-overlay') ? 'overlay-no-btn' : 'none';
    })()`)
    if (hit === 'none') return true
    await sleep(700)
  }
  return false
}

/* ---------- 页面读数 ---------- */
const READ = `(() => {
  const t = (sel) => document.querySelector(sel)?.innerText?.trim() || '';
  const inputs = [...document.querySelectorAll('.oc-bar .oc-daterange input')].map(i => i.value);
  const heads = [...document.querySelectorAll('.el-table__header th')].map(th => th.innerText.trim()).filter(Boolean);
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')];
  const cellsOf = (tr) => [...tr.querySelectorAll('td')].map(td => td.innerText.trim());
  return JSON.stringify({
    hasModeSelect: !!document.querySelector('.oc-bar .oc-mode'),
    hasRange: !!document.querySelector('.oc-bar .oc-daterange'),
    dateInputs: inputs,
    heads,
    rows: rows.length,
    firstRow: rows[0] ? cellsOf(rows[0]) : [],
    count: t('.oc-count'),
    empty: t('.oc-empty'),
    emptyBtns: [...document.querySelectorAll('.oc-empty .el-button')].map(b => b.innerText.trim()),
    colBtn: [...document.querySelectorAll('.oc-bar .el-button')].map(b => b.innerText.trim()).find(x => /列设置|Columns/.test(x)) || '',
    box: (() => { const b = document.querySelector('.el-message-box'); return b ? {
      message: b.querySelector('.el-message-box__message')?.innerText?.trim() || '',
      buttons: [...b.querySelectorAll('.el-message-box__btns button')].map(x => x.innerText.trim()),
    } : null })(),
    dialog: (() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('列设置') || x.innerText.includes('Columns'));
      if (!d) return null;
      const items = [...d.querySelectorAll('.csd-item')].map(x => ({ label: x.querySelector('.csd-label')?.innerText.trim() || '', checked: !!x.querySelector('.el-checkbox.is-checked') }));
      return { title: d.querySelector('.el-dialog__title')?.innerText.trim() || '', items, count: d.querySelector('.csd-count')?.innerText.trim() || '' };
    })(),
  });
})()`

const waitFor = async (ev, pred, ms = 20000) => {
  const t0 = Date.now()
  for (;;) {
    const s = JSON.parse(await ev(READ))
    if (pred(s)) return s
    if (Date.now() - t0 > ms) return s
    await sleep(400)
  }
}
const clickText = async (ev, sel, text) => {
  const want = JSON.stringify(text)
  return await ev(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.offsetParent !== null);
    const el = els.find(e => e.innerText.trim() === ${want}) || els.find(e => e.innerText.trim().startsWith(${want}));
    if (!el) return 'miss:' + els.map(e => e.innerText.trim()).slice(0, 12).join('|');
    el.click(); return 'ok';
  })()`)
}

/** 打开页面(先登录页注入 token,再进业务页;about:blank 是 opaque origin 存不了 localStorage) */
async function openPage(ev, send, locale = 'zh-CN') {
  await send('Page.navigate', { url: BASE + '/#/login' })
  await sleep(3500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))});
    localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' }))});
    localStorage.setItem('mes_locale', ${JSON.stringify(locale)}); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` })
  await sleep(9000)
  await dismissOnboarding(ev)
  await sleep(500)
}

const errs = await withEdge(async ({ ev, shot, send }) => {
  await openPage(ev, send)

  // ① 日期范围选择(旧档位下拉必须消失)
  let s = await waitFor(ev, (x) => x.hasRange || x.box, 25000)
  check(s.hasRange, '① 日期框是 daterange(两个日期输入)', `inputs=${JSON.stringify(s.dateInputs)}`)
  check(!s.hasModeSelect, '① 旧的「单日/近N天」档位下拉已移除')
  check(s.dateInputs.length === 2 && s.dateInputs[0] === TODAY && s.dateInputs[1] === TODAY,
    '① 默认日期范围 = [今天, 今天](保留"打开只看一天"口径)', `"${s.dateInputs.join(' ~ ')}"`)

  // 旧口径不回归:今天没数据 → 弹窗询问(点「留在本日」)
  if (s.box) {
    check(s.box.buttons.includes('留在本日') && s.box.buttons.includes('跳转'), '① 今天没数据 → 弹窗询问(不静默跳转)', s.box.buttons.join('|'))
    await clickText(ev, '.el-message-box__btns button', '留在本日')
    await sleep(1200)
    s = await waitFor(ev, (x) => !x.box && (x.rows > 0 || x.empty), 12000)
    check(!s.box && s.dateInputs[0] === TODAY && s.dateInputs[1] === TODAY, '① 「留在本日」停在今天', JSON.stringify(s.dateInputs))
  } else {
    check(todayCount > 0, '① 今天有待结转数据(无弹窗分支,属正常)', `今天 ${todayCount} 行`)
  }

  // 空表近路:跳到最近有数据的一天(同时把表格填上数据,供列/产品名称断言)
  if (s.rows === 0) {
    check(!!s.empty, '① 空表给出提示与近路按钮', s.empty.slice(0, 40))
    const jump = await clickText(ev, '.oc-empty .el-button', '跳到最近有数据的一天')
    check(jump === 'ok', '① 空表近路按钮可点', jump)
    s = await waitFor(ev, (x) => x.rows > 0, 20000)
  }
  check(s.rows > 0, '① 有数据行可断言列', `rows=${s.rows} ${s.count}`)
  await shot('01-range')

  // ③ 产品名称列:在型号左边、首行非空
  const hi = s.heads.indexOf('产品名称')
  const mi = s.heads.indexOf('型号')
  check(hi >= 0, '③ 表头出现「产品名称」', s.heads.join('|'))
  check(hi >= 0 && mi >= 0 && mi === hi + 1, '③ 产品名称紧挨在「型号」左边', `index 产品名称=${hi} 型号=${mi}`)
  // 首行按表头定位取产品名称单元格(兼容隐藏列造成的错位)
  const first = JSON.parse(await ev(`(() => {
    const heads = [...document.querySelectorAll('.el-table__header th')].map(th => th.innerText.trim());
    const tr = document.querySelector('.el-table__body-wrapper tbody tr');
    const cells = tr ? [...tr.querySelectorAll('td')].map(td => td.innerText.trim()) : [];
    const idx = heads.indexOf('产品名称');
    return JSON.stringify({ value: idx >= 0 ? (cells[idx] || '') : '', heads, cells: cells.slice(0, 12) });
  })()`))
  check(!!first.value, '③ 产品名称有值(订单行存货名称)', `"${first.value}"`)

  // ④ 物料编码单列(2026-10-29 追加口径):表头有、首行有值、且不受「订单资料」堆叠格影响
  const mat = JSON.parse(await ev(`(() => {
    const heads = [...document.querySelectorAll('.el-table__header th')].map(th => th.innerText.trim());
    const tr = document.querySelector('.el-table__body-wrapper tbody tr');
    const cells = tr ? [...tr.querySelectorAll('td')].map(td => td.innerText.trim()) : [];
    const idx = heads.indexOf('物料编码');
    return JSON.stringify({ has: idx >= 0, at: idx, value: idx >= 0 ? (cells[idx] || '') : '', heads });
  })()`))
  check(mat.has, '④ 表头出现「物料编码」', mat.heads.slice(0, 6).join('|'))
  check(!!mat.value, '④ 物料编码列有值(订单行存货编码)', `"${mat.value}"`)

  // ② 列设置:勾掉「客户订单号」→ 保存 → 表头消失
  check(!!s.colBtn, '② 工具栏有「列设置」按钮', s.colBtn)
  await clickText(ev, '.oc-bar .el-button', '列设置')
  await sleep(900)
  let dlg = (await waitFor(ev, (x) => !!x.dialog, 8000)).dialog
  check(!!dlg && dlg.items.length === COLS.length, '② 列设置弹窗列出全部可隐藏列', dlg ? `${dlg.items.length} 列 / ${dlg.count}` : 'no dialog')
  const before = JSON.parse(await ev(READ))
  check(before.heads.includes('客户订单号'), '② 初始「客户订单号」列可见')
  // 取消勾选:点该列的 label(checkbox 由 label 包着)
  const un = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('列设置'));
    if (!d) return 'no-dialog';
    const it = [...d.querySelectorAll('.csd-item')].find(x => (x.querySelector('.csd-label')?.innerText || '').trim() === '客户订单号');
    if (!it) return 'no-item';
    it.querySelector('.el-checkbox')?.click(); return 'ok';
  })()`)
  check(un === 'ok', '② 可取消勾选「客户订单号」', un)
  await sleep(400)
  await shot('02-dialog')
  await clickText(ev, '.el-dialog__footer button', '保存')
  await sleep(1500)
  s = await waitFor(ev, (x) => !x.dialog, 10000)
  check(!s.heads.includes('客户订单号'), '② 保存后「客户订单号」表头消失', s.heads.join('|'))

  // 取消必须回滚(2026-10-29 复核 M1):打开弹窗把「客户订单号」勾回来 → 点取消 → 列不能被改
  await clickText(ev, '.oc-bar .el-button', '列设置')
  await sleep(900)
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('列设置'));
    const it = d && [...d.querySelectorAll('.csd-item')].find(x => (x.querySelector('.csd-label')?.innerText || '').trim() === '客户订单号');
    if (it) it.querySelector('.el-checkbox')?.click(); return 'ok';
  })()`)
  await sleep(400)
  await clickText(ev, '.el-dialog__footer button', '取消')
  await sleep(1200)
  s = await waitFor(ev, (x) => !x.dialog, 10000)
  check(!s.heads.includes('客户订单号'), '② 「取消」不应用未保存的勾选(列仍保持隐藏)', s.heads.join('|'))

  // 刷新:列设置必须仍然生效(证明后端持久化 + 挂载即应用)
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` })
  await sleep(9000)
  await dismissOnboarding(ev)
  s = await waitFor(ev, (x) => x.hasRange && (x.rows > 0 || x.empty || x.box), 25000)
  if (s.box) { await clickText(ev, '.el-message-box__btns button', '留在本日'); await sleep(800) }
  if (s.rows === 0) { await clickText(ev, '.oc-empty .el-button', '跳到最近有数据的一天'); s = await waitFor(ev, (x) => x.rows > 0, 15000) }
  check(!s.heads.includes('客户订单号'), '② 刷新页面后「客户订单号」仍隐藏(持久化生效)', s.heads.join('|'))
  await shot('03-reloaded-hidden')

  // 恢复默认 → 保存 → 表头回来
  await clickText(ev, '.oc-bar .el-button', '列设置')
  await sleep(900)
  // 「恢复默认」在弹窗正文的 .csd-bar 里(不在 footer 的保存/取消旁边)
  const rs = await clickText(ev, '.csd-bar .el-button', '恢复默认')
  check(rs === 'ok', '② 「恢复默认」按钮可点', rs)
  await sleep(400)
  await clickText(ev, '.el-dialog__footer button', '保存')
  await sleep(1500)
  s = await waitFor(ev, (x) => x.heads.includes('客户订单号'), 10000)
  check(s.heads.includes('客户订单号'), '② 「恢复默认」+保存后列全部回来', s.heads.join('|'))

  // ⑤ 调整列顺序(2026-10-29 追加口径):▼ 把「物料编码」下移一位 → 表头顺序变 → 刷新仍按新顺序
  const MID = ['物料编码', '行号', '下单日期', '客户', '客户等级', '产品名称', '型号', '重点管控', '客户订单号', '需求数量', '已排产数量']
  const midOrder = (heads) => heads.filter((h) => MID.includes(h))
  const midBefore = midOrder(s.heads)
  check(midBefore.length === MID.length && midBefore[0] === '物料编码', '⑤ 初始列顺序 = 默认(物料编码第一)', midBefore.join('|'))
  await clickText(ev, '.oc-bar .el-button', '列设置')
  await sleep(900)
  const mv = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('列设置'));
    if (!d) return 'no-dialog';
    const it = [...d.querySelectorAll('.csd-item')].find(x => (x.querySelector('.csd-label')?.innerText || '').trim() === '物料编码');
    if (!it) return 'no-item';
    const btns = it.querySelectorAll('.csd-arrows .el-button');
    if (btns.length < 2) return 'no-arrows';
    btns[1].click(); return 'ok';
  })()`)
  check(mv === 'ok', '⑤ 列设置里有 ▲/▼ 调序按钮且可点', mv)
  await sleep(400)
  await clickText(ev, '.el-dialog__footer button', '保存')
  await sleep(1500)
  s = await waitFor(ev, (x) => !x.dialog, 10000)
  const after = midOrder(s.heads)
  check(after[0] === '行号' && after[1] === '物料编码', '⑤ 保存后列顺序生效(物料编码下移一位)', after.join('|'))

  // 刷新后顺序仍要生效(顺序随 columns[] 一起持久化)
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` })
  await sleep(9000)
  await dismissOnboarding(ev)
  s = await waitFor(ev, (x) => x.hasRange && (x.rows > 0 || x.empty || x.box), 25000)
  if (s.box) { await clickText(ev, '.el-message-box__btns button', '留在本日'); await sleep(800) }
  if (s.rows === 0) { await clickText(ev, '.oc-empty .el-button', '跳到最近有数据的一天'); s = await waitFor(ev, (x) => x.rows > 0, 15000) }
  const afterReload = midOrder(s.heads)
  check(afterReload[0] === '行号' && afterReload[1] === '物料编码', '⑤ 刷新后列顺序仍生效(持久化)', afterReload.join('|'))

  // 恢复默认 → 顺序回到默认
  await clickText(ev, '.oc-bar .el-button', '列设置')
  await sleep(900)
  await clickText(ev, '.csd-bar .el-button', '恢复默认')
  await sleep(400)
  await clickText(ev, '.el-dialog__footer button', '保存')
  await sleep(1500)
  s = await waitFor(ev, (x) => !x.dialog, 10000)
  const def = midOrder(s.heads)
  check(def[0] === '物料编码' && def.join('|') === MID.join('|'), '⑤ 恢复默认后顺序回到默认', def.join('|'))

  // 英语:新控件全译、工具栏无裸中文
  await openPage(ev, send, 'en')
  s = await waitFor(ev, (x) => x.hasRange && (x.box || x.rows > 0 || x.empty), 25000)
  if (s.box) { await clickText(ev, '.el-message-box__btns button', 'Stay on this day'); await sleep(800); s = JSON.parse(await ev(READ)) }
  if (s.rows === 0) { await clickText(ev, '.oc-empty .el-button', 'Jump to the latest day with data'); s = await waitFor(ev, (x) => x.rows > 0, 15000) }
  check(s.colBtn === 'Columns', '④ 英语下「列设置」= Columns', s.colBtn)
  check(s.heads.includes('Product Name'), '④ 英语下「产品名称」= Product Name', s.heads.slice(0, 12).join('|'))
  const ph = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.oc-bar .oc-daterange input')].map(i => i.placeholder))`))
  check(ph[0] === 'Start date' && ph[1] === 'End date', '④ 英语下日期范围占位符已译', ph.join('|'))
  await clickText(ev, '.oc-bar .el-button', 'Columns')
  await sleep(900)
  const dlgEn = (await waitFor(ev, (x) => !!x.dialog, 8000)).dialog
  check(!!dlgEn && dlgEn.title === 'Columns', '④ 英语下列设置弹窗标题已译', dlgEn ? dlgEn.title : 'no dialog')
  check(!!dlgEn && dlgEn.items.every((i) => !/[\u4e00-\u9fa5]/.test(i.label)), '④ 英语下列名无裸中文', dlgEn ? dlgEn.items.map((i) => i.label).join('|') : '')
  await clickText(ev, '.el-dialog__footer button', 'Cancel')
  await shot('04-english')
})

/* ---------- 收尾:列设置复位(不给用户留隐藏列) + 报错汇总 ---------- */
await resetCols()
const jsErrs = (errs || []).filter((e) => !/favicon|Failed to load resource/i.test(e))
check(jsErrs.length === 0, '⑤ 全程无 JS 报错', jsErrs.slice(0, 3).join(' || '))

const fails = results.filter((r) => !r).length
console.log(`\n=== ${results.length - fails}/${results.length} 通过${fails ? `，${fails} 项失败` : ''} ===`)
process.exitCode = fails ? 1 : 0
