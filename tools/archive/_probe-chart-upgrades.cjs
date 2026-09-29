/* show-pct 生效核验:生产(工单状态)/销售(订单状态)/质量(检验结果)/研发(阶段分布)四图应有 .bar-pct */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('ws')
const PORT = 9355
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await loginRes.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pc-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/dashboard')
    await sleep(3500)
    await evaluate(`document.querySelector('.wz-skip') && document.querySelector('.wz-skip').click(); 'ok'`)
    // 模块 tab 实际顺序: [概览,研发,生产,库存,销售,质量](上一轮探针实证的偏移规律)
    const order = ['概览', '研发', '生产', '库存', '销售', '质量']
    for (const name of ['生产', '销售', '质量', '研发']) {
      await evaluate(`(() => { const b = Array.from(document.querySelectorAll('.mod-tab')).find(x => x.textContent.includes('${name}')); if (b) b.click(); return !!b })()`)
      await sleep(1500)
      const r = await evaluate(`(() => { const cards = Array.from(document.querySelectorAll('.card')); const withPct = cards.filter(c => c.querySelector('.bar-pct')); const pctTexts = Array.from(document.querySelectorAll('.bar-pct')).map(e => e.textContent); const peaks = document.querySelectorAll('circle.peak').length; const lastVals = document.querySelectorAll('.last-val').length; const ctxMax = document.querySelectorAll('.ctx-max').length; return JSON.stringify({ withPctCards: withPct.map(c => (c.querySelector('.card-title') || {}).textContent), pctTexts, peaks, lastVals, ctxMax }) })()`)
      console.log(`${name}:`, r)
    }
  } finally { edge.kill() }
}
main().then(() => process.exit(0)).catch(e => { console.error('FATAL', e); process.exit(2) })
