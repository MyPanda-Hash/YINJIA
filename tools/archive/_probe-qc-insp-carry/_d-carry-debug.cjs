/* 一次性排障:新增报告后写「物料编码」为何没进模型(打印元素、写值返回、后续轮询)
   用法:node tools/archive/_probe-qc-insp-carry/_d-carry-debug.cjs */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9363
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1500,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') { await sleep(1000); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await nav('http://localhost:5173/#/login')
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav('http://localhost:5173/#/panelx/list/QC_INSP_REC')
    await sleep(3500)
    await ev(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
    await sleep(1500)
    await ev(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    await sleep(4000)

    const probe = `(() => {
      const sheets = document.querySelectorAll('.qc-rec-sheet')
      const ths = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')]
      const th = ths.find(t => t.innerText.trim() === '物料编码')
      const td = th?.nextElementSibling
      const inp = td?.querySelector('input')
      return JSON.stringify({
        sheets: sheets.length,
        ths: ths.map(t => t.innerText.trim()),
        tdHtml: td ? td.className + ' :: ' + td.innerHTML.slice(0, 160) : null,
        inp: inp ? { tag: inp.tagName, cls: inp.className, val: inp.value, ro: inp.readOnly, dis: inp.disabled } : null,
        rows: document.querySelectorAll('.qc-rec-sheet .qr-table tbody tr').length,
      })
    })()`
    console.log('BEFORE:', await ev(probe))
    console.log('SET →', await ev(`(() => {
      const ths = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')]
      const th = ths.find(t => t.innerText.trim() === '物料编码')
      const inp = th?.nextElementSibling?.querySelector('input')
      if (!inp) return 'NO-INPUT'
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, 'YJ-YCYX-006')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      return 'val=' + inp.value
    })()`))
    for (const t of [300, 900, 1800, 3000, 5000, 8000]) {
      await sleep(t === 300 ? 300 : 600)
      console.log(`+${t}ms:`, await ev(probe), '| msgs=', await ev(`JSON.stringify([...document.querySelectorAll('.el-message')].map(e=>e.innerText))`))
    }
  } finally { edge.kill() }
}
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 })
