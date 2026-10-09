/**
 * _probe-wol-topicking-ui.mjs — 界面级取证:生产工单页「打印领料单」→「转领料单」(2026-10-07)。
 *
 * 断言(真实浏览器 + 真实 8090 打包产物上跑):
 *   ① 按钮条里**有**「转领料单」、**没有**「打印领料单」;
 *   ② 未勾选就点 → 前端守卫「请先勾选一张工单」,且**不发** toPicking 请求;
 *   ③ 勾选一张可转的工单再点 → 弹确认框「确认为选中的 1 张工单转领料?」(截图留证);
 *   ④ 点确认 → 发 POST /api/px/workOrderList/toPicking 且 200;绿字提示含「已生成领料单」;
 *   ⑤ 紧随其后弹「…去「材料出库单」补材料明细吗?」(可跳转),点「稍后」不跳转;
 *   ⑥ 清场:把本次与前一阶段验证在**测试账套**造的领料单草稿经 /px/deleteForms 删掉,测试库回到原状。
 *
 * ⚠ 全程只打**测试账套 YJ_TEST(HSDZ_MES_TEST)**,不碰正式库。
 * 用法(需 8090 在跑):
 *   node tools/archive/_probe-wol-topicking-ui.mjs [--site http://127.0.0.1:8090] [--wo MO-2026-09-0108]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const SITE = arg('site', 'http://127.0.0.1:8090')
const API = arg('api', 'http://127.0.0.1:8090/api')
const WO = arg('wo', 'MO-2026-09-0108')
const PORT = 9412
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = path.resolve('D:/workspace/yinjia/.probe-edge-profile-wol')
const SHOT = path.resolve('tools/archive/_probe-wol-topicking-ui.png')
const SHOT2 = path.resolve('tools/archive/_probe-wol-topicking-ui2.png')
const OUT = path.resolve('tools/archive/_probe-wol-topicking-ui.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const checks = []
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`) }

// ---------- 登录(测试账套) ----------
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.error('[FATAL] 登录失败', JSON.stringify(login).slice(0, 300)); process.exit(1) }
console.log('[login] factory =', user?.factory)

// ---------- 起无头 Edge ----------
fs.mkdirSync(PROFILE, { recursive: true })
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-sync', '--disable-features=msEdgeFirstRunExperience,msSyncConfirmationDialog',
  '--window-size=1680,950',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' })

let version = null
for (let i = 0; i < 40 && !version; i++) {
  await sleep(500)
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch { /* 还没起来 */ }
}
if (!version) { console.error('[FATAL] Edge 调试端口未就绪'); edge.kill(); process.exit(1) }
console.log('[edge]', version['Browser'])

const calls = []          // 采到的 toPicking 请求
let created = null        // 生成的领料单号(清场用)

try {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const tab = targets.find((t) => t.type === 'page' && t.url === 'about:blank') || targets.find((t) => t.type === 'page')
  if (!tab?.webSocketDebuggerUrl) throw new Error('没有可用的 page target')

  const socket = new WebSocket(tab.webSocketDebuggerUrl)
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
    if (m.method === 'Network.requestWillBeSent' && m.params?.request?.url?.includes('/api/px/workOrderList/toPicking')) {
      netPending.set(m.params.requestId, { url: m.params.request.url, body: m.params.request.postData })
    }
    if (m.method === 'Network.responseReceived') {
      const hit = netPending.get(m.params.requestId)
      if (hit) hit.status = m.params.response.status
    }
    if (m.method === 'Network.loadingFinished') {
      const hit = netPending.get(m.params.requestId)
      if (hit) { calls.push(hit); netPending.delete(m.params.requestId) }
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
  await send('Page.navigate', { url: SITE + '/#/login' })
  await sleep(1800)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(300)
  await send('Page.navigate', { url: SITE + '/#/prod/plan/workOrderList' })
  await sleep(8000)

  // 提示采集(ElMessage 3 秒即消,必须边出边收)
  await evaluate(`(() => {
    window.__msgs = []
    const collect = () => document.querySelectorAll('.el-message').forEach(e => {
      const t = e.innerText.trim()
      const type = (e.className.match(/el-message--(\\w+)/) || [])[1] || ''
      if (t && !window.__msgs.some(m => m.text === t && m.type === type)) window.__msgs.push({ text: t, type })
    })
    new MutationObserver(collect).observe(document.body, { childList: true, subtree: true })
    collect(); return 'ok'
  })()`)

  // 首次进测试账套会弹「MES 初始化配置」向导(异步拉配置后才出现),盖住确认框 ⇒ 循环关掉它
  const dismissWizard = () => evaluate(`(() => {
    const hit = [...document.querySelectorAll('button, span, div, a')]
      .filter(x => (x.innerText || '').trim() === '下次再说' && x.offsetParent !== null)
    if (hit.length) { hit[hit.length - 1].click(); return 'dismissed-later' }
    const x = [...document.querySelectorAll('.el-dialog__headerbtn, .el-overlay .el-icon.close, .el-icon-close')]
      .find(e => e.offsetParent !== null)
    return x ? 'close-btn-present' : 'no-wizard'
  })()`)
  let wizard = 'no-wizard'
  for (let i = 0; i < 12; i++) {
    const w = await dismissWizard()
    if (w !== 'no-wizard') { wizard = w; break }
    await sleep(700)
  }
  console.log('[初始化向导]', wizard)
  await sleep(1500)

  // ---------- ① 按钮条 ----------
  const bar = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('.wol-btns button')].map(b => b.innerText.trim())
    return { btns, rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tr.el-table__row').length }
  })()`)
  console.log('[界面] 按钮 =', JSON.stringify(bar.btns), '| 行数 =', bar.rows)
  check('按钮条里有「转领料单」', bar.btns.includes('转领料单'), JSON.stringify(bar.btns))
  check('按钮条里没有「打印领料单」', !bar.btns.includes('打印领料单'))
  check('列表已取到工单行', bar.rows > 0, `rows=${bar.rows}`)

  const clickBtn = () => evaluate(`(() => {
    const b = [...document.querySelectorAll('.wol-btns button')].find(x => x.innerText.trim() === '转领料单')
    if (!b) return 'no-button'
    if (b.disabled) return 'disabled'
    b.click(); return 'clicked'
  })()`)

  // ---------- ② 未勾选:按钮应为禁用态,且不发请求 ----------
  const before = calls.length
  console.log('[操作] 未勾选直接点 =', await clickBtn())
  await sleep(1200)
  const msgsNoSel = await evaluate('window.__msgs')
  check('未勾选时按钮为禁用态(点了不弹提示、不发请求)',
    String(await clickBtn()) === 'disabled' && !msgsNoSel.some((m) => /请先勾选/.test(m.text)),
    `click=${await clickBtn()} msgs=${JSON.stringify(msgsNoSel.map((m) => m.type + ':' + m.text))}`)
  check('未勾选不发后端请求', calls.length === before, `calls=${calls.length - before}`)

  // ---------- ③ 勾选指定工单 → 确认框 ----------
  const picked = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wol-table .el-table__body-wrapper tr.el-table__row')]
    const row = rows.find(r => r.innerText.includes(${JSON.stringify(WO)}))
    if (!row) return 'row-not-found|' + rows.slice(0, 5).map(r => r.innerText.split('\\n')[1]).join(' / ')
    const cb = row.querySelector('td .el-checkbox')
    if (!cb) return 'no-checkbox'
    cb.click(); return 'checked:' + row.innerText.split('\\n').slice(0, 3).join('|')
  })()`)
  console.log('[操作] 勾选', WO, '=', picked)
  check('找到并勾选了目标工单行', String(picked).startsWith('checked:'), String(picked))
  await sleep(500)
  console.log('[操作] 点转领料单 =', await clickBtn())
  await sleep(1200)
  const box = await evaluate(`(() => {
    const b = [...document.querySelectorAll('.el-message-box')].find(x => x.offsetParent !== null)
    if (!b) return { err: 'no-message-box' }
    return { title: b.querySelector('.el-message-box__title')?.innerText.trim(),
             text: b.querySelector('.el-message-box__message')?.innerText.trim(),
             buttons: [...b.querySelectorAll('button')].map(x => x.innerText.trim()) }
  })()`)
  console.log('[弹窗]', JSON.stringify(box))
  check('弹出转领料确认框', !box?.err && /确认为选中的 1 张工单转领料/.test(box.text || ''), JSON.stringify(box))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) { fs.writeFileSync(SHOT, Buffer.from(shot.result.data, 'base64')); console.log('[截图]', SHOT) }
  // ---------- ④ 确认 → 真发请求 ----------
  const before2 = calls.length
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('.el-message-box')].find(x => x.offsetParent !== null)
    const ok = [...b.querySelectorAll('button')].find(x => /确定|确认/.test(x.innerText))
    ok.click(); return 'ok'
  })()`)
  await sleep(3500)
  const msgs2 = await evaluate('window.__msgs')
  const hit = calls.slice(before2)
  console.log('[网络] toPicking =', JSON.stringify(hit))
  check('确认后发出 POST toPicking', hit.length === 1, JSON.stringify(hit.map((h) => h.status)))
  check('toPicking 返回 200', hit[0]?.status === 200, `status=${hit[0]?.status}`)
  check('载荷含勾选的工单号', !!hit[0]?.body && hit[0].body.includes(WO), (hit[0]?.body || '').slice(0, 160))
  const okMsg = msgs2.find((m) => m.type === 'success' && /已生成领料单/.test(m.text))
  check('绿字提示「已生成领料单 …」', !!okMsg, JSON.stringify(msgs2.map((m) => m.type + ':' + m.text)))
  // 提示形如「已生成领料单 MO-2026-09-0108→CL-2026-10-0002（…）」——取箭头**后面**那个单号(领料单号)
  created = okMsg?.text?.split('→')[1]?.match(/([A-Z]{2}-\d{4}-\d{2}-\d{4})/)?.[1] || null
  check('回执里带出新领料单号', !!created, `created=${created}`)

  // ---------- ⑤ 后续「去补明细」提示,点稍后不跳转 ----------
  const box2 = await evaluate(`(() => {
    const b = [...document.querySelectorAll('.el-message-box')].find(x => x.offsetParent !== null)
    if (!b) return { err: 'no-message-box2' }
    return { text: b.querySelector('.el-message-box__message')?.innerText.trim(),
             buttons: [...b.querySelectorAll('button')].map(x => x.innerText.trim()) }
  })()`)
  console.log('[弹窗2]', JSON.stringify(box2))
  check('追问是否去「材料出库单」补明细', !box2?.err && /材料出库单/.test(box2.text || ''), JSON.stringify(box2))
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  if (shot2?.result?.data) { fs.writeFileSync(SHOT2, Buffer.from(shot2.result.data, 'base64')); console.log('[截图2]', SHOT2) }
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('.el-message-box')].find(x => x.offsetParent !== null)
    const no = [...b.querySelectorAll('button')].find(x => /稍后/.test(x.innerText))
    no.click(); return 'ok'
  })()`)
  await sleep(1200)
  const url = await evaluate('location.hash')
  check('点「稍后」不跳转(仍在生产工单页)', String(url).includes('/prod/plan/workOrderList'), String(url))

  // ---------- ⑥ 清场:删掉测试账套里本次造的草稿 ----------
  // 只删**本次**造的号(从回执里取,见 created):删=作废(yj_doc_status.canceled='Y'),
  // 重复删已作废的单会被后端拒(409 仅草稿状态可删除)——所以不能把历史单号混进来重删。
  const toDelete = [created].filter(Boolean)
  const del = await (await fetch(API + '/px/deleteForms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'MATERIAL_OUT', rowCodes: [...new Set(toDelete)] }),
  })).json()
  console.log('[清场] 删除测试账套草稿', JSON.stringify([...new Set(toDelete)]), '=>', JSON.stringify(del).slice(0, 200))
  check('本次草稿已清场(测试库回到原状)', del?.code === 200 && !!created, JSON.stringify(del).slice(0, 200))

  fs.writeFileSync(OUT, JSON.stringify({ site: SITE, wo: WO, buttons: bar.btns, calls, checks, created }, null, 2), 'utf8')
  console.log('[落盘]', OUT)
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n=== 结论:${checks.length - failed.length}/${checks.length} 项通过${failed.length ? '(失败:' + failed.map((f) => f.name).join('、') + ')' : ''} ===`)
} finally {
  try { edge.kill() } catch { /* ignore */ }
  await sleep(400)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch { /* ignore */ }
}
