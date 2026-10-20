/*
 * _shot-tcin.cjs —— 截一张特采单纸面的图(看附件条位置用)
 * 用法: node tools/archive/_1019-verify/_shot-tcin.cjs [面板] [单据号] [输出png]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FE = 'http://localhost:5173'
const PANEL = process.argv[2] || 'QC_TC_IN'
const DOC = process.argv[3] || 'TCI-2026-09-0024'
const OUT = process.argv[4] || path.join(__dirname, '_shot-tcin.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-shot-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2600)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${FE}/#/login` }); await sleep(2200)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
                    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
    await send('Page.navigate', { url: `${FE}/#/panelx/list/${PANEL}?docNo=${DOC}` }); await sleep(5200)
    const info = await evaluate(`(() => {
      const sheet = [...document.querySelectorAll('.approval-sheet')].find(e => e.getBoundingClientRect().width > 200)
      const strip = document.querySelector('.as-attach-top')
      const table = document.querySelector('.as-table')
      const r = el => el ? [Math.round(el.getBoundingClientRect().top), Math.round(el.getBoundingClientRect().width)] : null
      return { sheet: r(sheet), strip: r(strip), table: r(table), remark: !!document.querySelector('.as-remark'),
               stripText: strip ? (strip.innerText||'').replace(/\\s+/g,' ').trim().slice(0,60) : '' }
    })()`)
    console.log('DOM:', JSON.stringify(info))
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
    console.log('截图:', OUT)
  } finally {
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('[异常]', e); process.exit(2) })
