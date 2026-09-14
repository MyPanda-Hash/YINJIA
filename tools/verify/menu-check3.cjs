/* 验证:智能供应链 5 列 + 生产管理 2 列 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9350
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-menu3-'))
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

    async function hoverAndCols(title) {
      await evaluate(`(() => { const el = [...document.querySelectorAll('.nav-group, .nav-module')].find(e => e.textContent.trim() === ${JSON.stringify(title)}); if (el) el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return 'hovered' })()`)
      await sleep(1000)
      return await evaluate(`[...document.querySelectorAll('.fly-card .card-group')].map(g => ({ title: g.querySelector('.card-group-title')?.textContent.trim(), items: [...g.querySelectorAll('.card-item')].map(i => i.textContent.trim()) }))`)
    }

    const scm = await hoverAndCols('智能供应链')
    console.log('SCM cols:', JSON.stringify(scm.map(c => ({ t: c.title, n: c.items.length, first: c.items.slice(0, 3) }))))
    const scmPass = scm.length === 5 && scm[3].title === '库存明细' && scm[4].title === '库存统计' && scm[3].items.includes('销售出库单明细表')

    // 生产制造(一级)悬停:应 3 列(单据/明细表/统计表)
    const mfgHover = await hoverAndCols('生产制造')
    console.log('MFG(一级) cols:', JSON.stringify(mfgHover.map(c => ({ t: c.title, items: c.items }))))
    const mfgPass = mfgHover.length === 3 && mfgHover[0].title === '单据' && mfgHover[1].title === '明细表' && mfgHover[2].title === '统计表' && mfgHover[2].items.includes('生产加工单统计表')

    console.log('RESULT:', (scmPass && mfgPass) ? 'PASS' : `FAIL scm=${scmPass} mfg=${mfgPass}`)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
