/**
 * _v-stock-detail-ui.mjs — 一次性验收(界面层):库存报表组里能看到「库存明细」,点进去 8 列有数据
 *
 * 为什么还要界面层:API 只能证明取数通,证不了「菜单里有这一项 + 表格真的渲染出列与行」
 *   (菜单来自前端源码/产物,面板列来自 yj_field,两条链各自可能断)。
 * 做法(与本仓库其它 CDP 探针同款):Edge headless + CDP;用接口登录后把 token 写进 localStorage,
 *   直接跳 #/panelx/list/STOCK_DETAIL,再读侧栏文本与表格表头/行数。
 * 用法:node tools/archive/_kucun-stock-detail/_v-stock-detail-ui.mjs [host]   默认 http://localhost:5173
 *   5173 = vite 源码即时生效;8090 的前端打包在 jar 里,新菜单要重打 jar 才有(但面板路由是通用的,
 *   8090 上可直接开 #/panelx/list/STOCK_DETAIL 看数据)。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '')
const api = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 1) 接口登录拿 token + user
const login = await (await fetch(`${api}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
if (login.code !== 200) throw new Error('登录失败: ' + JSON.stringify(login))
const { token, user } = login.data
console.log(`[1] 接口登录 OK(token 长度 ${token.length})`)

// 2) 起 headless Edge
const profile = mkdtempSync(join(tmpdir(), 'edge-sd-'))
const port = 9359
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })
let ws
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) { ws = new WebSocket(page.webSocketDebuggerUrl); break }
  } catch { /* 端口未就绪 */ }
  await sleep(250)
}
if (!ws) { edge.kill(); throw new Error('连不上 CDP 端口') }
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalIn = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
console.log('[2] headless Edge 已连上 CDP')

// 3) 先落到同源页面,写入登录态,再跳面板
await send('Page.navigate', { url: `${host}/#/login` })
await sleep(3000)
await evalIn(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify(user.factory ? { code: user.factory, name: '' } : null))});
  'ok'`)
// ⚠ 必须**先改 hash 再整页重载**:只改 hash 不会让 Pinia 重新读 localStorage(实测停在登录页),
//   而先 navigate 再 reload 会被登录后的守卫把路由改回 /dashboard(实测落到「我的桌面」)。
await evalIn(`location.hash = '#/panelx/list/STOCK_DETAIL'; location.reload(); 'ok'`)
await sleep(9000)

const nav = await evalIn(`(document.querySelector('.el-menu')||document.body).innerText.split('\\n').map(s=>s.trim()).filter(Boolean).join(' | ').slice(0, 1200)`)
console.log('[3] 侧栏文本(截断):\n    ' + nav)

const ui = await evalIn(`(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map(th => th.innerText.trim()).filter(Boolean);
  const rows = document.querySelectorAll('.el-table__body-wrapper tbody tr').length;
  const first = [...(document.querySelectorAll('.el-table__body-wrapper tbody tr')[0]?.querySelectorAll('td') || [])].map(td => td.innerText.trim());
  const title = document.querySelector('.page-title, .panel-title, .el-card__header')?.innerText?.trim() || document.title;
  return JSON.stringify({ title, heads, rows, first });
})()`)
console.log('[4] 页面/表格:')
console.log('    ' + ui)

ws.close(); edge.kill()
console.log('[5] 完成(退出码 0 = 探针跑通,断言请人眼核对上面两项)')
