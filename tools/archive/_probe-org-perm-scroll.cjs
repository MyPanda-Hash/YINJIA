/* 组织架构权限矩阵滚动优化验证:选角色→滚到表格中部→断言 thead/组头可见+截图 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(process.env.TEMP || os.tmpdir(), 'yj-org-verify')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, e = '') => { (c ? (pass++, console.log('  ok -', n)) : (fail++, console.log('  FAIL -', n, e))) }
async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await loginRes.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-og-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1500); return } } }
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); if (r?.result?.data) fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')) }
    await send('Page.enable'); await send('Runtime.enable')
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/sys/org')
    await sleep(3500)
    await evaluate(`document.querySelector('.wz-skip') && document.querySelector('.wz-skip').click(); 'ok'`)
    await sleep(500)
    // 兜底:若路由不对,点左侧菜单「基础设置」下的组织架构入口
    await evaluate(`(() => { if (!document.querySelector('.perm-collapse')) { const m = Array.from(document.querySelectorAll('*')).find(e => e.childElementCount === 0 && /组织架构/.test(e.textContent || '')); if (m) m.click(); } return 'nav' })()`)
    await sleep(2500)
    // 选第一个非管理员角色(权限矩阵 v-if=selRole,须先选角色)
    await evaluate(`(() => { const rows = document.querySelectorAll('.roles .el-table__row'); for (const r of rows) { if (!/超/.test(r.textContent)) { r.click(); return 'picked:' + r.textContent.trim().slice(0, 20) } } return 'none' })()`)
    await sleep(2000)
    const hasPermBox = await evaluate(`!!document.querySelector('.perm-collapse')`)
    ok('进入组织架构并加载权限矩阵', hasPermBox)
    const granted = await evaluate(`!!document.querySelector('.g-granted')`)
    ok('组头已勾计数渲染', granted)
    // 找最大的表格 wrap,滚到中部
    const scrolled = await evaluate(`(() => { const wraps = Array.from(document.querySelectorAll('.perm-table-wrap')).filter(w => w.scrollHeight > w.clientHeight + 10); if (!wraps.length) return 'no-scrollable:' + document.querySelectorAll('.perm-table-wrap').length; const w = wraps[0]; w.scrollTop = Math.floor(w.scrollHeight / 2); return 'scrolled ' + w.scrollTop + '/' + w.scrollHeight })()`)
    console.log('表格滚动:', scrolled)
    await sleep(600)
    await shot('1-scrolled-mid.png')
    // 断言:滚动后 thead 仍在 wrap 可视区内
    const theadVisible = await evaluate(`(() => { const wraps = Array.from(document.querySelectorAll('.perm-table-wrap')).filter(w => w.scrollTop > 10); if (!wraps.length) return 'no-scrolled-wrap'; const w = wraps[0]; const th = w.querySelector('thead th'); if (!th) return 'no-th'; const r = th.getBoundingClientRect(); const wr = w.getBoundingClientRect(); return r.bottom > wr.top + 2 && r.top < wr.bottom })()`)
    ok('滚动后操作列名表头仍可见(sticky 生效)', theadVisible === true, String(theadVisible))
    // 组头(模块说明)可见性:滚动的 wrap 所在 collapse-item 的 header 在文档位置(不随 wrap 滚走)
    const groupHeadVisible = await evaluate(`(() => { const wraps = Array.from(document.querySelectorAll('.perm-table-wrap')).filter(w => w.scrollTop > 10); if (!wraps.length) return 'no-scrolled-wrap'; const item = wraps[0].closest('.el-collapse-item'); const h = item && item.querySelector('.el-collapse-item__header'); if (!h) return 'no-header'; const r = h.getBoundingClientRect(); return r.bottom > 60 && r.height > 0 })()`)
    ok('滚动后模块组头仍可见', groupHeadVisible === true, String(groupHeadVisible))
    // 首列钉左断言(横向滚动时)
    const panelColSticky = await evaluate(`(() => { const td = document.querySelector('.perm-table td.pt-panel'); return td ? getComputedStyle(td).position : 'no-td' })()`)
    ok('首列面板名已钉左(position)', panelColSticky === 'sticky', String(panelColSticky))
    console.log(`\n结果: pass=${pass} fail=${fail}  OUT: ${OUT}`)
    process.exit(fail ? 1 : 0)
  } finally { edge.kill() }
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
