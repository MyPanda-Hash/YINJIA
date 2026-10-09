/**
 * 界面级取证/回归探针(2026-10-14,方案 A 实施后):材料出库单「明细选商品」的真实行为。
 *
 * 断言(全在真实浏览器 + 真实 8090 上跑,5173 源码即时生效):
 *   阶段① 点明细「材料编码」格 → 参照弹窗勾一行 → 确定导入:
 *     - 那一行**出现在表格里**且带 材料编码/材料名称/计量单位;
 *     - **没有**任何「…不能为空」红字;
 *     - 绿色提示 = 「已带入 1 行，请点「保存」提交」;
 *     - **0** 个 /px/callButton 请求(选商品不再顺带保存整单)。
 *   阶段② 点工具栏「保存」:
 *     - 必填校验**回到显式保存这一处** ⇒ 出现「明细第 1 行批号不能为空」(前端 validateInlineDraft);
 *     - 仍是 **0** 个 /px/callButton 请求(前端就拦下,不发后端,不落库)。
 *
 * 用法(需 8090 后端 + 5173 vite 在跑;本机 Edge):
 *   node tools/archive/_probe-matout-pick-ui-1014.mjs [--panel MATERIAL_OUT] [--doc CL-2026-10-0001]
 *
 * ⚠ Edge 154 + `ws` 包踩坑(2026-10-14,已在本脚本规避):
 *   ① `PUT /json/new` 建出来的 target 连上 CDP 后不回帧 —— 改用 `/json/list` 里的 page target;
 *   ② `ws` 包对同一 socket 注册的**第二个** 'message' 监听永不触发(第一个能收到)——
 *      改用 Node 22 内建的全局 WebSocket(stdlib,EventTarget API);
 *   ③ 诊断期还必须关掉 permessage-deflate。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const PANEL = arg('panel', 'MATERIAL_OUT')
const DOC = arg('doc', '')
const SITE = arg('site', 'http://localhost:5173')
const API = arg('api', 'http://localhost:8090/api')
const PORT = 9411
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = path.resolve('D:/workspace/yinjia/.probe-edge-profile')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- 登录(后端 API 取 token) ----------
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.error('[FATAL] 登录失败', JSON.stringify(login).slice(0, 200)); process.exit(1) }

fs.mkdirSync(PROFILE, { recursive: true })
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-sync', '--disable-features=msEdgeFirstRunExperience,msSyncConfirmationDialog',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' })

let version = null
for (let i = 0; i < 40 && !version; i++) {
  await sleep(500)
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch { /* 还没起来 */ }
}
if (!version) { console.error('[FATAL] Edge 调试端口未就绪'); edge.kill(); process.exit(1) }
console.log('[edge]', version['Browser'])

const results = { panel: PANEL, calls: [], phase1: {}, phase2: {} }
const checks = []
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`) }

try {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const tab = targets.find((t) => t.type === 'page' && t.url === 'about:blank') || targets.find((t) => t.type === 'page')
  if (!tab?.webSocketDebuggerUrl) throw new Error('没有可用的 page target')
  console.log('[tab]', tab.url)

  const socket = new WebSocket(tab.webSocketDebuggerUrl) // Node 22 内建
  let seq = 0
  const pending = new Map()
  const netPending = new Map()
  await new Promise((res, rej) => {
    socket.addEventListener('open', () => res())
    socket.addEventListener('error', () => rej(new Error('CDP WebSocket 连接失败')))
  })
  socket.addEventListener('message', (ev) => {
    let m = null
    try { m = JSON.parse(ev.data) } catch { return }
    if (!m || typeof m !== 'object') return
    if (m.id && pending.has(m.id)) { const f = pending.get(m.id); pending.delete(m.id); f(m); return }
    if (m.method === 'Network.requestWillBeSent' && m.params?.request?.url?.includes('/api/px/callButton')) {
      netPending.set(m.params.requestId, { url: m.params.request.url, body: m.params.request.postData })
    }
    if (m.method === 'Network.responseReceived') {
      const hit = netPending.get(m.params.requestId)
      if (hit) hit.status = m.params.response.status
    }
    if (m.method === 'Network.loadingFinished') {
      const hit = netPending.get(m.params.requestId)
      if (hit) { results.calls.push(hit); netPending.delete(m.params.requestId) }
    }
  })
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++seq
    let done = false
    const finish = (msg) => { if (!done) { done = true; pending.delete(id); res(msg) } }
    pending.set(id, finish)
    setTimeout(() => { if (!done) { console.log(`[cdp-timeout] ${method}`); finish({ __timeout: method }) } }, 15000)
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (exp) => (await send('Runtime.evaluate', {
    expression: exp, returnByValue: true, awaitPromise: true,
  })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  console.log('[cdp] ready')
  await send('Page.navigate', { url: SITE + '/#/login' })
  await sleep(1800)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(300)
  await send('Page.navigate', { url: SITE + '/#/panelx/list/' + PANEL + (DOC ? '?docNo=' + encodeURIComponent(DOC) : '') })
  await sleep(7000)

  // ElMessage 采集(MutationObserver:提示 3 秒就消失,必须边出边收)
  await evaluate(`(() => {
    window.__msgs = []
    const collect = () => document.querySelectorAll('.el-message').forEach(e => {
      const t = e.innerText.trim()
      const type = (e.className.match(/el-message--(\\w+)/) || [])[1] || ''
      if (t && !window.__msgs.some(m => m.text === t && m.type === type)) window.__msgs.push({ text: t, type })
    })
    new MutationObserver(collect).observe(document.body, { childList: true, subtree: true })
    collect()
    return 'ok'
  })()`)

  const layout = await evaluate(`(() => {
    const d = document.querySelector('.detail')
    if (!d) return { err: 'no .detail' }
    // 表头文本形如 "材料编码\\n⇅"(带排序插入符),取首行并去掉必填星号
    const heads = [...d.querySelectorAll('.el-table__header th .cell')].map(e => e.innerText.split('\\n')[0].trim().replace(/^\\*/, ''))
    const rows = [...d.querySelectorAll('.el-table__body-wrapper tr.el-table__row')]
    return { heads, rowCount: rows.length }
  })()`)
  if (layout?.err) throw new Error(layout.err)
  console.log('[界面] 明细列 =', JSON.stringify(layout.heads))
  const colIdx = layout.heads.findIndex((h) => h === '材料编码')
  if (colIdx < 0) throw new Error('明细里没有「材料编码」列')
  const readRow = () => evaluate(`(() => {
    const d = document.querySelector('.detail')
    // ⚠ 参照列渲染成 el-input/el-select,值在控件的 value 里,innerText 读不到 —— 必须两者都取
    const cellText = (c) => {
      const ctl = c.querySelector('input, textarea')
      const v = ctl ? (ctl.value ?? '') : ''
      return String(v || c.innerText || '').trim()
    }
    const rows = [...d.querySelectorAll('.el-table__body-wrapper tr.el-table__row')]
    return { rowCount: rows.length, first: rows[0] ? [...rows[0].querySelectorAll('td .cell')].map(cellText) : [] }
  })()`)
  const before = await readRow()
  console.log('[界面] 点击前 行数 =', before.rowCount, '| 首行 =', JSON.stringify(before.first))

  // ---------- 阶段① 选商品 ----------
  console.log('\n=== 阶段① 明细选商品(参照确认)===\n')
  await evaluate(`(() => {
    const d = document.querySelector('.detail')
    const row = d.querySelector('.el-table__body-wrapper tr.el-table__row')
    const cell = row.querySelectorAll('td')[${colIdx}]
    ;(cell.querySelector('input') || cell.querySelector('.cell')).click()
    return 'clicked'
  })()`)
  await sleep(2500)
  const dlg = await evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => /参照选择/.test(x.innerText))
    if (!d) return { err: '参照弹窗未打开' }
    return { title: d.querySelector('.el-dialog__title')?.innerText, rows: d.querySelectorAll('.el-table__body-wrapper tr.el-table__row').length }
  })()`)
  console.log('[弹窗]', JSON.stringify(dlg))
  if (dlg?.err) throw new Error(dlg.err)
  await evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => /参照选择/.test(x.innerText))
    d.querySelector('.el-table__body-wrapper tr.el-table__row td .el-checkbox').click()
    return 'checked'
  })()`)
  await sleep(400)
  await evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => /参照选择/.test(x.innerText))
    const b = [...d.querySelectorAll('.el-dialog__footer button')].find(x => /确定/.test(x.innerText))
    b.click(); return 'ok'
  })()`)
  await sleep(4000)

  const after1 = await readRow()
  const msgs1 = await evaluate('window.__msgs')
  const calls1 = results.calls.length
  results.phase1 = { rowCount: after1.rowCount, first: after1.first, msgs: msgs1, callButtonCalls: calls1 }
  console.log('[界面] 点击后 行数 =', after1.rowCount, '| 首行 =', JSON.stringify(after1.first))
  console.log('[提示]', JSON.stringify(msgs1))
  console.log('[网络] /px/callButton 调用 =', calls1)

  const idx = (h) => layout.heads.findIndex((x) => x === h)
  const cellOf = (name) => after1.first[idx(name)] || ''
  check('选商品后那一行出现在表格里', after1.rowCount >= before.rowCount && !!cellOf('材料编码'), `材料编码="${cellOf('材料编码')}"`)
  check('材料名称已由参照带入', !!cellOf('材料名称'), `材料名称="${cellOf('材料名称')}"`)
  check('计量单位已由参照带入', !!cellOf('计量单位'), `计量单位="${cellOf('计量单位')}"`)
  check('选商品过程没有「不能为空」报错', !msgs1.some((m) => /不能为空/.test(m.text)))
  check('提示 = 已带入 N 行，请点「保存」提交', msgs1.some((m) => m.type === 'success' && /已带入 1 行/.test(m.text) && /请点「保存」提交/.test(m.text)), JSON.stringify(msgs1.map((m) => m.type + ':' + m.text)))
  check('选商品不再顺带保存整单(0 个 callButton 请求)', calls1 === 0, `calls=${calls1}`)

  // ---------- 阶段② 显式保存:必填校验应回到这里 ----------
  console.log('\n=== 阶段② 点工具栏「保存」(必填校验应回到这一处)===\n')
  const clicked = await evaluate(`(() => {
    // 工具栏按钮不是 <button>,而是 .tb-group > span.tb-main > span.act-name(见 PanelxList 模板 L28)
    const mains = [...document.querySelectorAll('.tb-group .tb-main')]
    const save = mains.find(s => s.querySelector('.act-name')?.innerText.trim() === '保存')
    if (save && !save.classList.contains('disabled')) { save.click(); return 'save-clicked' }
    return 'no-save-button|' + mains.map(s => s.querySelector('.act-name')?.innerText.trim()).join(' / ')
  })()`)
  console.log('[操作]', clicked)
  await sleep(3000)
  const msgs2 = await evaluate('window.__msgs')
  const calls2 = results.calls.length
  const after2 = await readRow()
  const newMsgs = msgs2.filter((m) => !msgs1.some((x) => x.text === m.text && x.type === m.type))
  results.phase2 = { msgs: msgs2, newMsgs, callButtonCalls: calls2, rowCount: after2.rowCount, first: after2.first }
  console.log('[提示]', JSON.stringify(newMsgs))
  console.log('[网络] /px/callButton 调用(累计)=', calls2)
  check('点保存后才出现必填提示(前端 warning)', newMsgs.some((m) => m.type === 'warning' && /不能为空/.test(m.text)), JSON.stringify(newMsgs.map((m) => m.type + ':' + m.text)))
  check('前端拦下、未发后端(不落库)', calls2 === 0, `calls=${calls2}`)
  check('行仍在(没被回滚掉)', after2.rowCount === after1.rowCount && !!after2.first[idx('材料编码')])

  // ---------- 阶段③ 补填表头必填(业务类型)后再点保存:这次该轮到明细「批号」 ----------
  console.log('\n=== 阶段③ 选表头「业务类型」后再保存(应轮明细必填)===\n')
  const picked = await evaluate(`(() => {
    const f = [...document.querySelectorAll('.header-fields .field')]
      .find(x => x.querySelector('label')?.innerText.trim().replace(/\\s+/g, '').startsWith('业务类型'))
    if (!f) return 'no-biztype-field'
    const box = f.querySelector('.el-select input, .el-select')
    if (!box) return 'no-select'
    box.click()
    return 'select-clicked'
  })()`)
  console.log('[操作] 打开业务类型下拉 =', picked)
  await sleep(900)
  const chosen = await evaluate(`(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const opt = items.find(i => /销售出库/.test(i.innerText))
    if (!opt) return 'no-option|' + items.map(i => i.innerText.trim()).slice(0, 6).join('/')
    opt.click(); return 'option-clicked:' + opt.innerText.trim()
  })()`)
  console.log('[操作] 选业务类型 =', chosen)
  await sleep(800)
  await evaluate(`(() => {
    const save = [...document.querySelectorAll('.tb-group .tb-main')]
      .find(s => s.querySelector('.act-name')?.innerText.trim() === '保存')
    if (save) save.click()
    return 'ok'
  })()`)
  await sleep(2500)
  const msgs3 = await evaluate('window.__msgs')
  const calls3 = results.calls.length
  const newMsgs3 = msgs3.filter((m) => !msgs2.some((x) => x.text === m.text && x.type === m.type))
  results.phase3 = { msgs3, newMsgs3, callButtonCalls: calls3 }
  console.log('[提示]', JSON.stringify(newMsgs3))
  console.log('[网络] /px/callButton 调用(累计)=', calls3)
  check('表头补齐后,必填提示轮到明细「批号」', newMsgs3.some((m) => /批号不能为空/.test(m.text)), JSON.stringify(newMsgs3.map((m) => m.type + ':' + m.text)))
  check('仍是前端拦下、未发后端(不落库)', calls3 === 0, `calls=${calls3}`)

  const out = path.resolve('tools/archive/_probe-matout-pick-ui-1014.json')
  fs.writeFileSync(out, JSON.stringify({ ...results, checks }, null, 2), 'utf8')
  console.log('\n[落盘]', out)
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n=== 结论:${checks.length - failed.length}/${checks.length} 项通过${failed.length ? '(失败:' + failed.map((f) => f.name).join('、') + ')' : ''} ===`)
} finally {
  try { edge.kill() } catch { /* ignore */ }
  await sleep(400)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch { /* ignore */ }
}
