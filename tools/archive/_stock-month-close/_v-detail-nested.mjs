/**
 * _v-detail-nested.mjs — 验「二次展开」:分类行(仓库+存货) → 外层(批次号汇总) → 内层(该批单据,月结第一条)
 * 用法:node tools/archive/_stock-month-close/_v-detail-nested.mjs [host] [存货编码] [仓库编码]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '')
const wz = process.argv[3] || 'C-84-02'
const ck = process.argv[4] || 'CP-02'
const api = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await (await fetch(`${api}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const { token, user } = login.data

const profile = mkdtempSync(join(tmpdir(), 'edge-nested-'))
const port = 9391
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--window-size=1700,1000', 'about:blank'], { stdio: 'ignore' })
let ws
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) { ws = new WebSocket(page.webSocketDebuggerUrl); break }
  } catch { /* 端口未就绪 */ }
  await sleep(250)
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${host}/#/login` })
await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: user.factory, name: '' }))}); 'ok'`)
await ev(`location.hash = '#/panelx/list/STOCK_DETAIL'; location.reload(); 'ok'`)
await sleep(10000)
// 勾该仓,把目标行拉到第一页
await ev(`(() => { const it = [...document.querySelectorAll('.wh-dock-item')].find(e => e.innerText.includes(${JSON.stringify(ck)}));
  const i = it && it.querySelector('input'); if (i) i.click(); return 'ok' })()`)
await sleep(6000)

console.log(`[1] 点开分类行 ${wz} / ${ck} 的展开:`)
console.log('    ' + await ev(`(() => {
  const tr = [...document.querySelectorAll('.report-table .el-table__body tr')]
    .find(t => (t.innerText || '').includes(${JSON.stringify(wz)}) && (t.innerText || '').includes(${JSON.stringify(ck)}));
  if (!tr) return '（第 1 页没找到该行）';
  const ic = tr.querySelector('.el-table__expand-icon'); if (ic) ic.click(); return 'clicked';
})()`))
await sleep(6000)

console.log('[2] 外层(批次号汇总)行:')
console.log('    ' + await ev(`(() => {
  const outer = document.querySelector('.mc-detail .el-table');
  if (!outer) return '（没有外层表）';
  const heads = [...outer.querySelectorAll('.el-table__header th')].map(t => t.innerText.trim()).filter(Boolean);
  const rows = [...outer.querySelectorAll('.el-table__body > tbody > tr')].slice(0, 6)
    .map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim()).join(' | '));
  return '列: ' + heads.join(' , ') + '\\n        ' + rows.join('\\n        ');
})()`))

console.log('[3] 点开外层第一行(某批次号)→ 内层该批单据:')
console.log('    ' + await ev(`(() => {
  const outer = document.querySelector('.mc-detail .el-table');
  if (!outer) return '（没有外层表）';
  const ic = outer.querySelector('.el-table__body .el-table__expand-icon');
  if (!ic) return '（外层没有展开图标）';
  ic.click(); return 'clicked';
})()`))
await sleep(5000)
console.log('    ' + await ev(`(() => {
  const tables = document.querySelectorAll('.mc-detail .el-table');
  const inner = tables[1];
  if (!inner) return '（内层没渲染）';
  const heads = [...inner.querySelectorAll('.el-table__header th')].map(t => t.innerText.trim()).filter(Boolean);
  const rows = [...inner.querySelectorAll('.el-table__body > tbody > tr')].slice(0, 5)
    .map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim()).join(' | '));
  return '内层列: ' + heads.join(' , ') + '\\n        ' + rows.join('\\n        ');
})()`))

ws.close(); edge.kill()
