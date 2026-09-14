/**
 * _moldproc-check.cjs — 成型工艺清单结构验证:
 * 产品基本信息两行式/长度要求|重量要求列标题行在脱模上方/检验要求三列块
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mp-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9353', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9353/json/new?about:blank', { method: 'PUT' })).json()
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
  const text = (e) => e?.textContent?.trim() || ''
  const rows = [...document.querySelectorAll('.rsp-sheet table.rs-t tr')]
  const line = []
  for (const [i, tr] of rows.entries()) line.push(i + ':' + [...tr.children].map((c) => text(c).slice(0, 9) + (c.rowSpan > 1 ? '^' + c.rowSpan : '') + (c.colSpan > 1 ? 'x' + c.colSpan : '')).join('|').slice(0, 80))
  // 关键检查:长度要求/重量要求 行位于 冷却 与 脱模 之间
  const idxCap = rows.findIndex((tr) => tr.textContent.includes('长度要求') && tr.textContent.includes('重量要求'))
  const idxCool = rows.findIndex((tr) => tr.textContent.includes('冷却参数设置'))
  const idxDie = rows.findIndex((tr) => tr.textContent.includes('脱模'))
  return {
    capBetween: idxCap > idxCool && idxCap < idxDie,
    rowsFirst12: line.slice(0, 12),
    基本信息两行: rows.some((tr) => tr.textContent.includes('产品编号') && tr.textContent.includes('生产车间')) && rows.some((tr) => tr.textContent.includes('C-95-43') || tr.querySelector('input')),
  }
})()`)
    console.log(JSON.stringify(out, null, 1))
    await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_MOLD_PROC', buttonName: '删除', formData: { 编号: no } }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
