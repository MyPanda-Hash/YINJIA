/**
 * _edit-interact-test.cjs — 编辑态交互冒烟:碱性草稿 加行/删行/改值
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9344
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-edit-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 40; i++) { await sleep(300); if ((await evaluate('document.readyState')) === 'complete') { await sleep(1000); return } }
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1000, deviceScaleFactor: 1, mobile: false })
    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await navigate('about:blank')
    for (const pc of ['RD_ALKALINE', 'RD_MINERAL', 'RD_SOAK', 'RD_DROP_PREC']) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(3000)
      const editable = await evaluate(`!!document.querySelector('.rsp-sheet .rs-add')`)
      if (!editable) { console.log('[edit] ' + pc + ': 当前非草稿(无编辑UI),跳过'); continue }
      const before = await evaluate(`document.querySelectorAll('.rsp-sheet .rs-dt tbody tr').length`)
      await evaluate(`document.querySelector('.rsp-sheet .rs-add')?.click(); 'ok'`)
      await sleep(600)
      const afterAdd = await evaluate(`document.querySelectorAll('.rsp-sheet .rs-dt tbody tr').length`)
      const del = await evaluate(`(() => {
  const dels = [...document.querySelectorAll('.rsp-sheet .rs-td-op .rs-op-del')]
  if (!dels.length) return 'NO_DEL'
  dels[dels.length - 1].click(); return 'OK'
})()`)
      await sleep(600)
      const afterDel = await evaluate(`document.querySelectorAll('.rsp-sheet .rs-dt tbody tr').length`)
      // 输入一个值
      const typed = await evaluate(`(() => {
  const inputs = [...document.querySelectorAll('.rsp-sheet .rs-dt .el-input__inner')]
  if (!inputs.length) return 'NO_INPUT'
  const last = inputs[inputs.length - 1]
  last.focus()
  return 'FOCUSED:' + (last.placeholder || 'y').slice(0, 8)
})()`)
      console.log('[edit] ' + pc + ': 行数 ' + before + ' →加行 ' + afterAdd + ' →删行(' + del + ') ' + afterDel + ' | 输入 ' + typed)
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
