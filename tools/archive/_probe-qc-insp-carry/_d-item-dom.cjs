/* 一次性排障:读表体第一列(检验项 el-select)的真实 DOM,给出可靠的取值选择器
   用法:node tools/archive/_probe-qc-insp-carry/_d-item-dom.cjs */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9364
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dom-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1500,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
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
    await sleep(5000)
    await ev(`(() => {
      const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === '物料编码')
      const inp = th?.nextElementSibling?.querySelector('input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, 'YJ-YCYX-006')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      return 1
    })()`)
    await sleep(3000)
    console.log('第一列 DOM =', await ev(`document.querySelector('.qc-rec-sheet .qr-table tbody tr td.c-item').innerHTML.replace(/\\s+/g, ' ')`))
    console.log('innerText =', JSON.stringify(await ev(`document.querySelector('.qc-rec-sheet .qr-table tbody tr td.c-item').innerText`)))
    console.log('选择器候选 =', await ev(`JSON.stringify({
      selItem: document.querySelectorAll('.qr-rec-sheet td.c-item .el-select__selected-item').length,
      selItemText: [...document.querySelectorAll('.qr-rec-sheet td.c-item .el-select__selected-item')].map(e => e.innerText),
      placeholder: [...document.querySelectorAll('.qr-rec-sheet td.c-item .el-select__placeholder')].map(e => e.innerText),
      inputVal: [...document.querySelectorAll('.qr-rec-sheet td.c-item input')].map(e => e.value),
      text: [...document.querySelectorAll('.qr-rec-sheet td.c-item')].map(e => e.innerText.trim()),
    })`))
  } finally { edge.kill() }
}
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 })
