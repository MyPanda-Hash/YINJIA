/* 临时诊断:.approval-sheet 实宽 1254 ≠ CSS 声明的 940 —— 定位是哪个祖先/规则决定的 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const login = await (await fetch('http://localhost:8090/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-why-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async u => { await send('Page.navigate', { url: u }); for (let i = 0; i < 50; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') { await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav('http://localhost:5173/#/login')
    await ev(`localStorage.setItem('mes_token',${JSON.stringify(login.data.token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify(login.data.user))});'ok'`)
    await nav('about:blank'); await nav('http://localhost:5173/#/panelx/list/QC_TC_IN'); await sleep(3500)
    await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s/g,'').includes('新增流程'));if(b)b.click();return !!b})()`)
    await sleep(4000)
    console.log(await ev(`(() => {
      const out = []
      let el = document.querySelector('.approval-sheet')
      out.push('print-media=' + matchMedia('print').matches + '  dpr=' + devicePixelRatio + '  bodyClass=' + document.body.className)
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el)
        out.push([el.tagName + '.' + (el.className || '').toString().split(' ').slice(0, 3).join('.'),
          'rect=' + Math.round(el.getBoundingClientRect().width),
          'cssW=' + cs.width, 'zoom=' + cs.zoom, 'transform=' + cs.transform.slice(0, 30), 'maxW=' + cs.maxWidth].join('  '))
        el = el.parentElement
      }
      return out.join('\\n')
    })()`))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
})()
