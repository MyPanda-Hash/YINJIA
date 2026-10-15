/**
 * _v-monthclose-ui.mjs — 界面验收:分仓库(勾选+查询按钮) / 行展开(一张表,靠单据类型区分) / 工具栏两个可见按钮 / 顶部提示条
 *
 * 用户 2026-10-15 第二轮口径对应的断言:
 *   ① 左栏**没有搜索框**,只有一个「查询」按钮(勾完仓再点它过滤);
 *   ② 展开只有**一张表**(不再分 入库/出库/结转),列里能看到「单据类型」;月结单据显示成 `2026-09月结`;
 *   ③ 工具栏上**并排**看到「上月月结」「取消月结」(不在「更多」下拉里);
 *   ④ 面板有「结存单价」列则应判失败(用户要求摘掉);
 *   ⑤ 顶部提示条:上月已月结时为**无**;传 -TestLedger 用测试库跑「取消月结」后应出现提示。
 * 用法:node tools/archive/_stock-month-close/_v-monthclose-ui.mjs [host] [-TestLedger]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const host = (args.find((a) => a.startsWith('http')) || 'http://localhost:5173').replace(/\/+$/, '')
const testLedger = args.includes('-TestLedger')
const api = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await (await fetch(`${api}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', ...(testLedger ? { factory: 'YJ_TEST' } : {}) }),
})).json()
if (login.code !== 200) throw new Error('登录失败: ' + JSON.stringify(login))
const { token, user } = login.data
console.log(`[1] 接口登录 OK(账套 ${user.factory}${testLedger ? ' · 测试库' : ''})`)

const profile = mkdtempSync(join(tmpdir(), 'edge-mc-'))
const port = 9371
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
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${host}/#/login` })
await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: user.factory, name: '' }))});
  'ok'`)
await ev(`location.hash = '#/panelx/list/STOCK_DETAIL'; location.reload(); 'ok'`)
await sleep(10000)

console.log('[2] 标题: ' + await ev('document.title'))
console.log('[3] 顶部提示条: ' + await ev(`(() => {
  const n = document.querySelector('.mc-notice');
  return n ? ('有 → ' + n.innerText.replace(/\\s+/g, ' ').trim()) : '无';
})()`))
console.log('[4] 左栏: ' + await ev(`(() => {
  const dock = document.querySelector('.wh-dock');
  if (!dock) return '（没渲染 ❌）';
  const inputs = dock.querySelectorAll('input.el-input__inner').length;   // 搜索框(应为 0)
  const btn = [...dock.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean);
  const items = [...dock.querySelectorAll('.wh-dock-item')].length;
  return '仓库 ' + items + ' 个 | 搜索框 ' + inputs + ' 个(应 0) | 按钮:' + btn.join(',');
})()`))
console.log('[5] 明细列: ' + await ev(`(() => {
  const heads = [...document.querySelectorAll('.report-table .el-table__header th')].map(t => t.innerText.trim().split('\\n')[0]).filter(Boolean);
  return heads.join(',') + '  | 含结存单价?' + (heads.includes('结存单价') ? '是(❌ 用户要求摘掉)' : '否 ✅');
})()`))

console.log('[6] 未勾选=显示全部 → 勾「恒亿仓」即查询(单选) → 再点取消=回到全部:')
const count0 = await ev(`(document.body.innerText.match(/共\\s*([0-9,]+)\\s*条/) || [])[1] || '?'`)
await ev(`(() => {
  const item = [...document.querySelectorAll('.wh-dock-item')].find(el => el.innerText.includes('恒亿仓'));
  const input = item && item.querySelector('input'); if (input) input.click();
  return 'ok'
})()`)
await sleep(6000)
const count1 = await ev(`(document.body.innerText.match(/共\\s*([0-9,]+)\\s*条/) || [])[1] || '?'`)
// 再点同一个 = 取消 ⇒ 应回到全部(第七轮口径)
await ev(`(() => {
  const item = [...document.querySelectorAll('.wh-dock-item')].find(el => el.innerText.includes('恒亿仓'));
  const input = item && item.querySelector('input'); if (input) input.click();
  return 'ok'
})()`)
await sleep(5000)
const count2 = await ev(`(document.body.innerText.match(/共\\s*([0-9,]+)\\s*条/) || [])[1] || '?'`)
console.log(`    未勾选=${count0}(应 1611 全部) → 勾恒亿仓=${count1}(应 612) → 再点取消=${count2}(应回到 1611)`)
// 勾回来,供下面的展开断言使用
await ev(`(() => {
  const item = [...document.querySelectorAll('.wh-dock-item')].find(el => el.innerText.includes('恒亿仓'));
  const input = item && item.querySelector('input'); if (input) input.click();
  return 'ok'
})()`)
await sleep(6000)

// 展开第一行
console.log('[7] 展开第一行:')
await ev(`(() => { const b = document.querySelector('.report-table .el-table__expand-icon'); b && b.click(); return 'ok' })()`)
await sleep(6000)
console.log('    ' + await ev(`(() => {
  const d = document.querySelector('.mc-detail');
  if (!d) return '（没有展开区 ❌）';
  const tables = d.querySelectorAll('.el-table').length;
  const heads = [...d.querySelectorAll('.el-table__header th')].map(t => t.innerText.trim()).filter(Boolean);
  const first = [...d.querySelectorAll('.el-table__body tr')].slice(0, 3).map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim()).join(' | '));
  return '表数量=' + tables + '(应 1) | 列:' + heads.join(',') + '\\n        前几行: ' + first.join('  ///  ');
})()`))

console.log('[8] 工具栏按钮: ' + await ev(`(() => {
  const labels = [...document.querySelectorAll('span.tb-main')].map(x => x.innerText.trim()).filter(Boolean);
  return labels.join(' | ') + '  ||  上月月结:' + (labels.includes('上月月结') ? '✅' : '❌')
    + ' 取消月结:' + (labels.includes('取消月结') ? '✅' : '❌')
    + ' 重新月结(应无):' + (labels.includes('重新月结') ? '❌ 还在' : '✅ 已撤');
})()`))

ws.close(); edge.kill()
console.log('[9] 完成')
