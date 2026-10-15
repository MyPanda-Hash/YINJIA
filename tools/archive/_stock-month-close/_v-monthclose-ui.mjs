/**
 * _v-monthclose-ui.mjs — 一次性验收(界面层):分仓库列表 + 行展开月结明细 + 三按钮可见
 *
 * 验收点(在 5173 vite 上跑,源码即时生效):
 *   ① 左侧「分仓库」列表出现,且列出仓库(名称+编码);
 *   ② 勾选一个仓库 → 主表「共 N 条」按该仓收窄(编码精确过滤,不是 LIKE);
 *   ③ 展开某一行 → 调 /api/stock/monthClose/detail,渲染出「月结快照 + 本月入库/出库 + 结转行」;
 *   ④ 工具栏「更多」下拉里有 上月月结 / 取消上月月结 / 重新月结 三项。
 * 用法:node tools/archive/_stock-month-close/_v-monthclose-ui.mjs [host]   默认 http://localhost:5173
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '')
const api = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await (await fetch(`${api}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
if (login.code !== 200) throw new Error('登录失败: ' + JSON.stringify(login))
const { token, user } = login.data
console.log(`[1] 接口登录 OK(账套 ${user.factory})`)

const profile = mkdtempSync(join(tmpdir(), 'edge-mc-'))
const port = 9361
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1700,1000', 'about:blank'], { stdio: 'ignore' })
let ws
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) { ws = new WebSocket(page.webSocketDebuggerUrl); break }
  } catch { /* 端口未就绪 */ }
  await sleep(250)
}
if (!ws) { edge.kill(); throw new Error('连不上 CDP') }
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalIn = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${host}/#/login` })
await sleep(3000)
await evalIn(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: user.factory, name: '' }))});
  'ok'`)
await evalIn(`location.hash = '#/panelx/list/STOCK_DETAIL'; location.reload(); 'ok'`)
await sleep(10000)

console.log('[2] 标题:' + await evalIn('document.title'))
console.log('[3] 左侧分仓库列表:' + await evalIn(`(() => {
  const dock = document.querySelector('.wh-dock');
  if (!dock) return '（没渲染出来 ❌）';
  const items = [...dock.querySelectorAll('.wh-dock-item')].map(el => el.innerText.replace(/\\s+/g, ' ').trim());
  return '共 ' + items.length + ' 个：' + items.join(' | ');
})()`))

const before = await evalIn(`(document.body.innerText.match(/共\\s*([0-9,]+)\\s*条/) || [])[1] || '?'`)
console.log('[4] 过滤前主表条数:' + before)

// 勾选**有库存的**仓库(恒亿仓 = 1013 行;第一个「车间仓」在 kucun 里 0 行,勾了会得到空表,看不到展开)
console.log('[5] 勾选「恒亿仓」→ 期望主表收窄到该仓')
await evalIn(`(() => {
  const item = [...document.querySelectorAll('.wh-dock-item')].find(el => el.innerText.includes('恒亿仓'));
  const input = item && item.querySelector('input');
  if (input) { input.click(); return 'clicked' }
  return 'not-found'
})()`)
await sleep(6000)
const after = await evalIn(`(document.body.innerText.match(/共\\s*([0-9,]+)\\s*条/) || [])[1] || '?'`)
const dockNote = await evalIn(`(() => { const d = document.querySelector('.wh-dock'); return d ? d.innerText.replace(/\\s+/g,' ').trim().slice(0,80) : '' })()`)
console.log('    过滤后主表条数:' + after + ' | 左栏:' + dockNote)

// 展开第一行
console.log('[6] 展开第一行 → 期望出「月结快照 + 本月入库/出库 + 结转行」')
await evalIn(`(() => { const b = document.querySelector('.report-table .el-table__expand-icon'); b && b.click(); return 'expand-clicked' })()`)
await sleep(6000)
console.log('    ' + await evalIn(`(() => {
  const d = document.querySelector('.mc-detail');
  if (!d) return '（没有展开区 ❌）';
  const t = d.innerText.replace(/\\s+/g, ' ').trim();
  const blocks = [...d.querySelectorAll('.mc-detail-block-title')].map(x => x.innerText.trim());
  return '展开区文本长度 ' + t.length + ' | 区块:' + blocks.join(' / ') + ' | 头部:' + t.slice(0, 160);
})()`))

// 工具栏「更多」:真实 DOM = `span.tb-main`(页面右上角那个「更多」是另一处,按文本乱找会点错)——
// 实测判据见本文件 §7 的注释历史;下拉项标签的 class 是 `.act-name`。
console.log('[7] 工具栏「更多」下拉项:')
const clicked = await evalIn(`(() => {
  const el = [...document.querySelectorAll('span.tb-main')].find(x => x.innerText.trim() === '更多');
  if (el) { el.click(); return 'clicked' }
  return 'not-found'
})()`)
await sleep(2500)
console.log('    点击结果: ' + clicked)
console.log('    下拉项: ' + await evalIn(`(() => {
  const items = [...document.querySelectorAll('.act-name')].map(x => x.innerText.trim()).filter(Boolean);
  return items.length ? items.join(' | ') : '（下拉没展开 ❌）';
})()`))

ws.close(); edge.kill()
console.log('[8] 完成(退出码 0 = 探针跑通;断言看上面各行)')
