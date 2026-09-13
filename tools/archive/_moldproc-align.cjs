/**
 * _moldproc-align.cjs — 成型工艺清单全页左右边缘/列分界对齐验证
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const s1 = await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_MOLD_PROC', buttonName: '保存', formData: {} }) })
  const no = (await s1.json()).data['编号']
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ma-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9354', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9354/json/new?about:blank', { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
    await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(400)
    await send('Page.navigate', { url: 'http://localhost:5173/#/panelx/list/RD_MOLD_PROC' })
    await sleep(3500)
    const out = await ev(`(() => {
  const tables = [...document.querySelectorAll('.rsp-sheet > table.rs-t')]
  const info = tables.map((t) => {
    const r = t.getBoundingClientRect()
    const bar = t.querySelector('.rs-sectionbar')
    const br = bar ? bar.getBoundingClientRect() : null
    return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), barL: br ? +br.left.toFixed(1) : null, barR: br ? +br.right.toFixed(1) : null }
  })
  // 长度要求/重量要求 标题 与 脱模标签列分界
  const capRow = [...document.querySelectorAll('.rsp-sheet table.rs-t tr')].find((tr) => tr.textContent.includes('长度要求') && tr.textContent.includes('重量要求'))
  let capXs = []
  if (capRow) capXs = [...capRow.children].map((c) => +c.getBoundingClientRect().left.toFixed(1))
  const dieRow = [...document.querySelectorAll('.rsp-sheet table.rs-t tr')].find((tr) => tr.textContent.includes('脱模'))
  let dieXs = []
  if (dieRow) dieXs = [...dieRow.children].map((c) => +c.getBoundingClientRect().left.toFixed(1))
  return { tables: info, capXs, dieXs }
})()`)
    const lefts = [...new Set(out.tables.map((t) => t.left))]
    const rights = [...new Set(out.tables.map((t) => t.right))]
    const bars = [...new Set(out.tables.filter((t) => t.barL !== null).map((t) => t.barL.toFixed(1) + '/' + t.barR.toFixed(1)))]
    console.log('表左缘:', lefts.join(','), '表右缘:', rights.join(','), '节条:', bars.join(' | '))
    console.log('长度标题列分界:', out.capXs.join(','))
    console.log('脱模列分界:', out.dieXs.join(','))
    console.log('对齐判定:', lefts.length === 1 && rights.length === 1 ? '✓ 全部一致' : '✗ 不一致')
    await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_MOLD_PROC', buttonName: '删除', formData: { 编号: no } }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
