/* 桌面深度开发验收:六模块逐个切换截图(生产/库存/销售/研发/质量重点看新图表) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9353
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(process.env.TEMP || os.tmpdir(), 'yj-desk-verify')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const MODS = [['overview', '1-overview'], ['prod', '2-prod'], ['stock', '3-stock'], ['sales', '4-sales'], ['rd', '5-rd'], ['quality', '6-quality']]
async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await loginRes.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dv-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,2000', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
    await navigate('http://localhost:5173/#/dashboard')
    await sleep(3500)
    await evaluate(`document.querySelector('.wz-skip') && document.querySelector('.wz-skip').click(); 'ok'`)
    await sleep(600)

    for (const [key, name] of MODS) {
      const clicked = await evaluate(`(() => { const btns = Array.from(document.querySelectorAll('.mod-tab')); const b = btns[${MODS.findIndex(m => m[0] === key)}]; if (b) { b.click(); return 'ok' } return 'notfound:' + btns.length })()`)
      await sleep(1800)
      await shot(name + '.png')
      const cards = await evaluate(`document.querySelectorAll('.card').length`)
      const empties = await evaluate(`Array.from(document.querySelectorAll('.card')).filter(c => c.textContent.includes('暂无数据')).length`)
      console.log(`${key}: cards=${cards} 空态卡=${empties} (${clicked})`)
    }
    console.log('OUT:', OUT)
  } finally { edge.kill() }
}
main().then(() => process.exit(0)).catch(e => { console.error('FATAL', e); process.exit(2) })
