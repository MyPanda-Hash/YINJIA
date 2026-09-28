/* 性能优化后视觉核对:登录页(WebP 背景+表单样式)与 PARTNER 面板(Element 按需样式) */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9349
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(process.env.TEMP || os.tmpdir(), 'yj-perf-verify')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await loginRes.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pv-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); if (r?.result?.data) { fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); console.log('shot:', name) } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await sleep(1500)
    await shot('1-login.png')
    const bgOk = await evaluate(`(() => { const els = Array.from(document.querySelectorAll('*')); const bg = els.find(e => getComputedStyle(e).backgroundImage && getComputedStyle(e).backgroundImage.includes('login-manufacturing')); if (!bg) return 'no-bg'; const img = new Image(); img.src = (getComputedStyle(bg).backgroundImage.match(/url\\(["']?([^"')]+)/) || [])[1]; return img.src.includes('.webp') ? 'webp-loaded' : 'src=' + img.src })()`)
    console.log('背景图:', bgOk)
    const formOk = await evaluate(`!!document.querySelector('input') && !!document.querySelector('button')`)
    console.log('登录表单渲染:', formOk)

    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/PARTNER')
    await sleep(3000)
    await evaluate(`document.querySelector('.wz-skip') && document.querySelector('.wz-skip').click(); 'ok'`)
    await sleep(800)
    await shot('2-panel.png')
    const tableOk = await evaluate(`!!document.querySelector('.el-table')`)
    const btnOk = await evaluate(`!!document.querySelector('.tb-main') || !!document.querySelector('button')`)
    console.log('el-table 渲染:', tableOk, '| 工具栏:', btnOk)
    console.log('OUT:', OUT)
  } finally { edge.kill() }
}
main().then(() => process.exit(0)).catch(e => { console.error('FATAL', e); process.exit(2) })
