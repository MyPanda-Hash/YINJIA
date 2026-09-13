/**
 * _edit-verify2.cjs — 空草稿加行后输入框出现验证(顺序修正)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9345
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ev2-'))
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
      const st = await evaluate(`(() => {
  const empty = !!document.querySelector('.rsp-sheet .rs-empty')
  const add = document.querySelector('.rsp-sheet .rs-add')
  if (!add) return { skip: true }
  add.click()
  return new Promise((resolve) => setTimeout(() => {
    const inputs = document.querySelectorAll('.rsp-sheet .rs-dt .el-input__inner, .rsp-sheet .rs-dt .el-textarea__inner')
    const rowsWithData = [...document.querySelectorAll('.rsp-sheet .rs-dt tbody tr')].filter((tr) => tr.querySelector('.el-input__inner, .el-textarea__inner')).length
    // 右缘检查:节条右缘 与 最后一个真实数据格右缘
    const bars = [...document.querySelectorAll('.rsp-sheet .rs-sectionbar')]
    const barR = bars.length ? bars[bars.length - 1].getBoundingClientRect().right : null
    resolve({ skip: false, wasEmpty: empty, inputs: inputs.length, editableRows: rowsWithData, barR: barR ? +barR.toFixed(1) : null })
  }, 700))
})()`)
      console.log('[edit2] ' + pc + ': ' + (st.skip ? '非草稿跳过' : '原空态=' + st.wasEmpty + ' 加行后输入框=' + st.inputs + ' 可编辑行=' + st.editableRows + ' 节条右缘=' + st.barR))
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
