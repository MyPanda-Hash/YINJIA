/* _diag-matout-ui.cjs — 诊断:前端打开 MATERIAL_OUT 时到底渲染了什么、调了哪些接口 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-diag-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ready = false
  for (let i = 0; i < 40 && !ready; i++) { await sleep(500); try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) ready = true } catch {} }
  if (!ready) throw new Error('Edge 未就绪')
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const calls = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/api/')) calls.push(m.params.request.method + ' ' + m.params.request.url.replace(BASE, ''))
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await nav(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank'); calls.length = 0
    await nav(BASE + '/#/panelx/list/MATERIAL_OUT')
    await sleep(5000)
    console.log('=== 调用的接口 ===')
    calls.slice(0, 25).forEach(c => console.log('  ', c))
    const dump = await evaluate(`(() => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const main = document.querySelector('#app') || document.body
      return {
        hash: location.hash,
        btns: [...document.querySelectorAll('button')].map(b => clean(b.innerText)).filter(Boolean),
        cls: [...new Set([...document.querySelectorAll('div,section')].map(d => d.className).filter(c => typeof c === 'string' && /doc|panel|list|sheet|papers/i.test(c)))].slice(0, 25),
        tabs: [...document.querySelectorAll('.el-tabs__item, [role=tab]')].map(e => clean(e.innerText)).slice(0, 15),
        text: clean(main.innerText).slice(0, 1500),
      }
    })()`)
    console.log('=== 页面 ===')
    console.log('  hash  :', dump.hash)
    console.log('  按钮  :', JSON.stringify(dump.btns))
    console.log('  类名  :', JSON.stringify(dump.cls))
    console.log('  页签  :', JSON.stringify(dump.tabs))
    console.log('  文本  :', dump.text)
    ws.close()
  } finally { try { edge.kill() } catch {} }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
