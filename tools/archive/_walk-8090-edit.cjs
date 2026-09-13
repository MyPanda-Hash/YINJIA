/** _walk-8090-edit.cjs — 在 8090(生产模式)验证字段编辑 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execSync } = require('child_process')
const FRONT = 'http://localhost:8090'
const API = 'http://localhost:8090/api'
const PORT = 9363
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PC = process.argv[2] || 'RD_ALKALINE'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-p8090-'))
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
  const clickReal = async (expr) => { const r = await evaluate(`(() => { const el = ${expr}; if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } })()`); if (!r) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 }); return true }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(3000)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/' + PC }); await sleep(4000)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(800)

  // 新增
  await clickReal(`[...document.querySelectorAll('.as-side-btn')].find(e => e.textContent.trim() === '新增')`)
  await sleep(3000)

  // 查找字段编辑按钮
  const btn = await evaluate(`(() => {
    const b = document.querySelector('.rs-field-edit-btn') || [...document.querySelectorAll('span')].find(e => e.textContent.includes('字段编辑'))
    return b ? { found: true, text: b.textContent.trim(), cls: b.className } : { found: false }
  })()`)
  console.log('1) 按钮: ' + JSON.stringify(btn))

  if (!btn.found) {
    console.log('FAIL: 按钮未找到')
    ws.close(); edge.kill(); return
  }

  // 点击(直接用 class 选择器,避免文本搜索匹配到错误元素)
  const clicked = await clickReal(`document.querySelector('.rs-field-edit-btn')`)
  await sleep(1500)
  const dialog = await evaluate(`(() => ({
    visible: !!document.querySelector('.el-dialog'),
    title: document.querySelector('.el-dialog__title')?.textContent?.trim(),
    rows: document.querySelectorAll('.el-dialog .el-table__row').length,
    overlays: document.querySelectorAll('.el-overlay').length,
  }))()`)
  console.log('2) 点击=' + clicked + ' 弹窗: ' + JSON.stringify(dialog))

  // 改名
  const edited = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.el-dialog .el-table__row')]
    if (!rows.length) return 'NO_ROWS'
    const input = rows[0].querySelector('.el-input__inner')
    if (!input) return 'NO_INPUT'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '8090验证OK')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'OK'
  })()`)
  console.log('3) 改名: ' + edited)

  // 保存
  await clickReal(`[...document.querySelectorAll('.el-dialog .el-button--primary')].find(b => b.textContent.includes('保存') || b.textContent.includes('Save'))`)
  await sleep(3000)
  const toast = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join('|')`)
  console.log('4) 保存: ' + toast)

  // 列头
  const headers = await evaluate(`[...document.querySelectorAll('.rs-th')].map(t => t.textContent.trim()).slice(0, 5)`)
  console.log('5) 列头: ' + JSON.stringify(headers))

  // DB
  try {
    const db = execSync(`sqlcmd -S localhost -E -d HSDZ_MES -Q "SET NOCOUNT ON; SELECT ISNULL(alias,'(空)') FROM yj_field WHERE panel_code='${PC}' AND col_name='测试时间';" -W -h -1 -f 65001`, { encoding: 'utf8' }).trim()
    console.log('6) DB: ' + db)
  } catch (e) { console.log('6) DB err') }

  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
