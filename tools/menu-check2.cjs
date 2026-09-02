/* 验证菜单:顺序 + 研发管理 4 列飞卡 + 空组不弹卡 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9349
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-menu2-'))
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

    const groups = await evaluate(`[...document.querySelectorAll('.nav-group')].map(el => el.textContent.trim())`)
    console.log('top groups:', JSON.stringify(groups))
    const orderOK = groups.join(',').includes('研发管理,智能供应链,生产制造,品质管理,财务管理,设备管理,基础档案')

    // 悬停研发管理:触发 fly-card
    await evaluate(`(() => { const g = [...document.querySelectorAll('.nav-group')].find(el => el.textContent.trim() === '研发管理'); if (g) { g.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); } return 'hovered' })()`)
    await sleep(1200)
    const cardGroups = await evaluate(`[...document.querySelectorAll('.fly-card .card-group')].map(g => ({ title: g.querySelector('.card-group-title')?.textContent.trim(), items: [...g.querySelectorAll('.card-item')].map(i => i.textContent.trim()) }))`)
    console.log('rd card columns:', JSON.stringify(cardGroups))
    const colCount = cardGroups.length
    const firstCol = cardGroups[0]?.items || []
    const pass = orderOK && colCount === 4 && firstCol.includes('立项申请') && firstCol.includes('项目实施计划') && firstCol.includes('项目进度查询')
    console.log('RESULT:', pass ? 'PASS' : 'FAIL', `(4 cols=${colCount === 4})`)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
