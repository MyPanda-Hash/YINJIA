/* 验证:基础档案 4 列 + 保存新财务面板 + 菜单面板可打开 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9351
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-base-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i=0;i<50;i++) { await sleep(300); if (await evaluate('document.readyState')==='complete') { await sleep(1200); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/dashboard')
    await sleep(4500)

    // 基础档案 4 列
    await evaluate(`(() => { const g = [...document.querySelectorAll('.nav-group')].find(el => el.textContent.trim() === '基础档案'); if (g) g.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return 'hovered' })()`)
    await sleep(1000)
    const cols = await evaluate(`[...document.querySelectorAll('.fly-card .card-group')].map(g => ({ title: g.querySelector('.card-group-title')?.textContent.trim(), items: [...g.querySelectorAll('.card-item')].map(i => i.textContent.trim()) }))`)
    console.log('BASE cols:', JSON.stringify(cols.map(c => ({ t: c.title, items: c.items }))))
    const pass4 = cols.length === 4 && cols[0].title === '基础数据' && cols[1].title === '物料及价格' && cols[2].title === '生产' && cols[3].title === '财务'
    const finCol = cols.find(c => c.title === '财务')
    const finPass = finCol && ['税别资料','费用类别','会计科目'].every(t => finCol.items.includes(t))
    console.log('4 cols:', pass4, '| fin items:', finPass)

    // 打开税别资料面板
    await navigate('http://localhost:5173/#/panelx/list/FIN_TAX')
    await sleep(4000)
    const title = await evaluate('document.title')
    const headers = await evaluate(`[...document.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean).slice(0, 6)`)
    console.log('FIN_TAX title:', title, '| headers:', JSON.stringify(headers))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
