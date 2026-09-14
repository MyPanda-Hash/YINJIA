/** _walk-fe-debug.cjs — 字段编辑保存调试:打印实际 payload + DB 结果 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execSync } = require('child_process')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_MINERAL' }); await sleep(3500)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)

  // 调试:从页面内直接调 fetch 看是否成功
  const result = await evaluate(`(async () => {
    const token = localStorage.getItem('mes_token')
    const body = { panelCode: 'RD_MINERAL', columns: [{ label: '测试日期', alias: '页面直调', visible: true }] }
    const res = await fetch('/api/px/saveColumnPrefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    return { status: res.status, body: json }
  })()`)
  console.log('页面直调: ' + JSON.stringify(result))

  // 检查 DB
  try {
    const dbResult = execSync(`sqlcmd -S localhost -E -d HSDZ_MES -Q "SET NOCOUNT ON; SELECT ISNULL(alias,'(空)') FROM yj_field WHERE panel_code='RD_MINERAL' AND col_name='测试日期';" -W -h -1 -f 65001`, { encoding: 'utf8' }).trim()
    console.log('DB alias: ' + dbResult)
  } catch (e) { console.log('DB check err') }

  // 检查 fieldEditRows 的 colName 值
  const fieldEdit = await evaluate(`(() => {
    // 打开字段编辑弹窗看 colName
    const btn = document.querySelector('.rs-field-edit-btn')
    if (!btn) return 'NO_BTN'
    btn.click()
    return 'CLICKED'
  })()`)
  await sleep(800)
  const colNames = await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.textContent.includes('字段编辑'))
    if (!dlg) return 'NO_DIALOG'
    const rows = [...dlg.querySelectorAll('.el-table__row')]
    return rows.slice(0, 3).map(r => {
      const cells = [...r.querySelectorAll('td')]
      return { key: cells[0]?.textContent?.trim(), colName: cells[1]?.textContent?.trim(), alias: cells[2]?.querySelector('input')?.value || '' }
    })
  })()`)
  console.log('fieldEdit rows: ' + JSON.stringify(colNames))

  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
