/** _walk-moldproc-edit.cjs — 成型工艺清单字段编辑验证 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execSync } = require('child_process')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9362
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mp-'))
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
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_MOLD_PROC' }); await sleep(3500)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)

  // 1) 新增进入编辑态
  await clickReal(`[...document.querySelectorAll('.as-side-btn')].find(e => e.textContent.trim() === '新增')`)
  await sleep(2500)

  // 2) 查找字段编辑按钮(应在检验要求 bar 上)
  const btn = await evaluate(`(() => { const b = document.querySelector('.rs-field-edit-btn'); return b ? { found: true, parent: b.closest('.rs-sectionbar')?.textContent?.trim().slice(0, 10) } : { found: false } })()`)
  console.log('1) 按钮: ' + JSON.stringify(btn))

  // 3) 点击打开弹窗
  await clickReal(`document.querySelector('.rs-field-edit-btn')`)
  await sleep(1000)
  const dialog = await evaluate(`(() => ({
    visible: !!document.querySelector('.el-dialog'),
    title: document.querySelector('.el-dialog__title')?.textContent?.trim(),
    rows: document.querySelectorAll('.fe-row').length,
    firstRows: [...document.querySelectorAll('.fe-row')].slice(0, 5).map(r => r.querySelector('.fe-key')?.textContent?.trim()),
  }))()`)
  console.log('2) 弹窗: ' + JSON.stringify(dialog))

  // 4) 改名:找「外径mm」行改别名
  const edited = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.fe-row')]
    const target = rows.find(r => r.textContent.includes('外径mm'))
    if (!target) return 'NOT_FOUND rows=' + rows.length
    const input = target.querySelector('.fe-alias input')
    if (!input) return 'NO_INPUT'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'E2E外径改')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'OK'
  })()`)
  console.log('3) 改名: ' + edited)

  // 5) 保存
  await clickReal(`[...document.querySelectorAll('.el-dialog .el-button--primary')].find(b => b.textContent.includes('保存'))`)
  await sleep(2500)
  const toast = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join('|')`)
  console.log('4) 保存: ' + toast)

  // 6) 检查列头变化
  await sleep(1000)
  const labels = await evaluate(`[...document.querySelectorAll('.rs-label')].map(t => t.textContent.trim()).filter(t => t.includes('外径') || t.includes('E2E'))`)
  console.log('5) 标签: ' + JSON.stringify(labels))

  // 7) 刷新验证
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_MOLD_PROC' }); await sleep(3500)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  await clickReal(`[...document.querySelectorAll('.as-side-btn')].find(e => e.textContent.trim() === '新增')`)
  await sleep(2000)
  const labelsAfter = await evaluate(`[...document.querySelectorAll('.rs-label')].map(t => t.textContent.trim()).filter(t => t.includes('外径') || t.includes('E2E'))`)
  console.log('6) 刷新后: ' + JSON.stringify(labelsAfter))

  // DB check
  try {
    const db = execSync(`sqlcmd -S localhost -E -d HSDZ_MES -Q "SET NOCOUNT ON; SELECT ISNULL(alias,'(空)') FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name='外径mm';" -W -h -1 -f 65001`, { encoding: 'utf8' }).trim()
    console.log('7) DB: ' + db)
  } catch (e) { console.log('7) DB err') }

  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
