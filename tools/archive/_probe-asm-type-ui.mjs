/*
 * _probe-asm-type-ui.mjs — 组装成品检验单「去掉分区 + 检验类型摆明细第一列」界面实测(2026-10-17,一次性探针)
 *
 * 用户口径:「去除当前这个实现方式(截图 = A.外观/B.尺寸/C.出货重量 三块分区),直接使用明细行实现进行吧……
 *   将当前的表区修改为检验类型更加直观明显,将检验类型放在明细行第一列,进行区分。」
 * 断言(只读,不点保存):
 *   ① 明细区**不再有分区块**(.arch-section 为 0),也不再出现「A.外观」这类区标题;
 *   ② 明细表**第一列表头 = 检验类型**(不再有「表区」列表头);
 *   ③ 老后端/老页面同时并存的风险点:表头里不出现「表区」二字。
 * 用法: node tools/archive/_probe-asm-type-ui.mjs [base]   (base 默认 5173 源码热更环境)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const PORT = 9482
const EDGE = process.env.YJ_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${PANEL}`,
  { headers: { Authorization: 'Bearer ' + login.data.token } }).then((r) => r.json())).data
const cols = (cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).map((f) => (typeof f === 'string' ? f : f.dataName))
console.log('   明细列(config): ' + cols.join('|'))
ok('① 配置第一列 = 检验类型', cols[0] === '检验类型', cols[0])

const profile = fs.mkdtempSync(path.join(process.env.YJ_PROFILE_DIR || os.tmpdir(), 'yj-asmtype-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1200',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let n = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(8000)

  const sections = await ev(`document.querySelectorAll('.arch-section').length`)
  const titles = await ev(`[...document.querySelectorAll('.arch-section-title')].map(x=>(x.innerText||'').trim().split('\\n')[0])`)
  console.log('   分区块数 = ' + sections + ' / 区标题 = ' + JSON.stringify(titles))
  ok('② 明细区不再有分区块', sections === 0, 'sections=' + sections)
  ok('② 不再出现 A.外观 这类区标题', !(titles || []).some((t) => /^[A-E]\./.test(t)), JSON.stringify(titles))

  /* 明细表列头:取最下面那张明细表的表头(排除分区表/汇总)。
     ⚠ 表头格 innerText 带排序图标(「检验类型\n⇅」)⇒ 只取第一行文本。 */
  const heads = await ev(`(()=>{
    const tables=[...document.querySelectorAll('.detail .el-table')];
    const t=tables[tables.length-1]; if(!t) return null;
    return [...t.querySelectorAll('.el-table__header th .cell')]
      .map(x=>(x.innerText||'').trim().split('\\n')[0].trim()).filter(Boolean);
  })()`)
  console.log('   明细表头: ' + JSON.stringify(heads))
  ok('② 明细第一列表头 = 检验类型', Array.isArray(heads) && heads[0] === '检验类型', JSON.stringify(heads && heads.slice(0, 3)))
  ok('② 明细表头里没有「表区」', Array.isArray(heads) && !heads.some((h) => h === '表区'), JSON.stringify(heads))
} finally {
  try { edge.kill() } catch { /* 忽略 */ }
}
console.log(fail === 0 ? `\n[PASS] ${pass} 项(组装成品检验单:分区已去除、检验类型列在首)` : `\n[FAIL] ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
