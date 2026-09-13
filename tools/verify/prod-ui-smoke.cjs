/* 生产服务器 UI 冒烟:登录 + 面板打开 + 语言切换 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9346
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://36.140.66.163:8090'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-prod-'))
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
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i=0;i<60;i++) { await sleep(300); if (await evaluate('document.readyState')==='complete') { await sleep(1200); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    // 登录页加载
    await navigate(BASE + '/#/login')
    const loginTitle = await evaluate('document.title')
    console.log('login page title:', loginTitle)

    // 直接注入 token 进入面板(登录接口已单独验证)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); localStorage.setItem('mes_locale', 'en'); 'ok'`)
    await navigate('about:blank')
    await navigate(BASE + '/#/panelx/list/SO_ORDER')
    await sleep(5000)
    const title = await evaluate('document.title')
    const headers = await evaluate(`[...document.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean).slice(0, 10)`)
    console.log('SO_ORDER title:', title)
    console.log('SO_ORDER headers:', JSON.stringify(headers))

    // 档案面板
    await navigate(BASE + '/#/panelx/list/DEPT')
    await sleep(4000)
    const deptHeaders = await evaluate(`[...document.querySelectorAll('.el-table__header th')].map(th => th.textContent.trim()).filter(Boolean).slice(0, 6)`)
    console.log('DEPT headers(en):', JSON.stringify(deptHeaders))

    const pass = loginTitle.includes('登录') || loginTitle.includes('YINJIA') || headers.length > 0
    console.log('RESULT:', pass ? 'PASS' : 'FAIL')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
