/**
 * _insp-rowspan-check.cjs — 验证授权使用人跨2行与编写人/审核人行结构
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const lr = await fetch('http://localhost:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const login = await lr.json()
  const s1 = await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', buttonName: '保存', formData: {} }) })
  const no = (await s1.json()).data['编号']
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rs2-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9352', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9352/json/new?about:blank', { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
    await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(400)
    await send('Page.navigate', { url: 'http://localhost:5173/#/panelx/list/RD_INSP_PLAN' })
    await sleep(3500)
    const out = await ev(`(() => {
  const authCell = [...document.querySelectorAll('.rsp-sheet table.rs-t td')].find((td) => td.textContent.trim() === '授权使用人')
  const valCell = authCell ? authCell.nextElementSibling : null
  const auditRow = [...document.querySelectorAll('.rsp-sheet table.rs-t tr')].find((tr) => tr.textContent.includes('编写人'))
  return {
    授权rowspan: authCell ? authCell.rowSpan : null,
    值rowspan: valCell ? valCell.rowSpan : null,
    编写人行格数: auditRow ? auditRow.children.length : null,
    编写人行含审核: auditRow ? auditRow.textContent.includes('审核人') : null,
    编写人行不含授权: auditRow ? !auditRow.textContent.includes('授权使用人') : null,
  }
})()`)
    console.log(JSON.stringify(out))
    await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', buttonName: '删除', formData: { 编号: no } }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
