/**
 * _insp-lib-check.cjs — 出货检验计划标准库勾选端到端验证:
 * 打开必测项块勾选弹窗 → 勾2行追加 → 行数/内容/检验类别正确
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-il-'))
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9356', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch('http://127.0.0.1:9356/json/new?about:blank', { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1000, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
    await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(400)
    await send('Page.navigate', { url: 'http://localhost:5173/#/panelx/list/RD_INSP_PLAN' })
    await sleep(3500)
    // 点必测项块的 从标准库勾选
    const opened = await ev(`(() => {
  const btns = [...document.querySelectorAll('.rs-lib-btn')]
  if (!btns.length) return 'NO_BTN'
  btns[0].click()
  return 'CLICKED'
})()`)
    await sleep(800)
    // 勾选前两行
    const checked = await ev(`(() => {
  const boxes = [...document.querySelectorAll('.el-dialog .el-table__row .el-checkbox__inner')]
  boxes.slice(0, 2).forEach((b) => b.click())
  return boxes.length
})()`)
    await sleep(500)
    await ev(`[...document.querySelectorAll('.el-dialog__footer .el-button--primary')][0]?.click(); 'ok'`)
    await sleep(800)
    const rows = await ev(`(() => {
  const trs = [...document.querySelectorAll('.rsp-sheet .rs-dt tbody tr')].filter((tr) => tr.querySelector('.el-input__inner, .el-textarea__inner'))
  return trs.map((tr) => [...tr.querySelectorAll('.el-input__inner, .el-textarea__inner')].slice(0, 2).map((i) => i.value).join('/'))
})()`)
    console.log('勾选按钮:', opened, '| 库行数:', checked, '| 追加后数据行:', JSON.stringify(rows))
    // 保存并读回验证落库
    await ev(`(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => b.textContent.trim() === '保存')
  btn?.click(); return 'ok'
})()`)
    await sleep(2500)
    const list = await fetch('http://localhost:8090/api/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', condition: {}, pageNo: 1, pageSize: 3 }) })
    const lj = await list.json()
    const mine = (lj.data?.list || []).find((r) => r['编号'] === no)
    const items = (mine?.detail?.items) || []
    console.log('SAVED items=' + items.length + ' 类别s=' + [...new Set(items.map((r) => r['检验类别']))].join('/'))
    await fetch('http://localhost:8090/api/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + login.data.token }, body: JSON.stringify({ panelCode: 'RD_INSP_PLAN', buttonName: '删除', formData: { 编号: no } }) })
    console.log('CLEANED ' + no)
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
