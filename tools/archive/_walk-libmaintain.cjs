/** _walk-libmaintain.cjs — 检验项目标准库:新增自定义项(✦标记)→删除→消失 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execSync } = require('child_process')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9368
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lm-'))
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
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3500)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  // 新增进入编辑态
  await clickReal(`[...document.querySelectorAll('.as-side-btn')].find(e => e.textContent.trim() === '新增')`)
  await sleep(2500)
  // 切到检验页签,点标准库
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][2]; if (t) t.click(); return 1 })()`); await sleep(900)
  await clickReal(`document.querySelector('.rs-lib-btn')`)
  await sleep(1200)

  // 1) 新增自定义项
  const before = await evaluate(`(() => ({ groups: document.querySelectorAll('.lib-group').length, customs: document.querySelectorAll('.lib-sub-custom').length }))()`)
  console.log('1) 打开: ' + JSON.stringify(before))

  await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.textContent.includes('检验项目标准库'))
    if (!dlg) return 'NO_DIALOG'
    const inputs = [...dlg.querySelectorAll('.lib-custom-form input')]
    const tas = [...dlg.querySelectorAll('.lib-custom-form textarea')]
    const set = (el, val) => { if (!el) return; const s = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; s.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })) }
    if (inputs[0]) set(inputs[0], 'E2E维护测试组')
    if (inputs[1]) set(inputs[1], 'E2E子项')
    if (tas[0]) set(tas[0], 'E2E要求内容')
    return 'OK'
  })()`)
  await sleep(400)
  await clickReal(`[...document.querySelectorAll('.el-dialog')].find(d => d.textContent.includes('检验项目标准库'))?.querySelector('.lib-custom-form button')`)
  await sleep(2000)

  // 2) 检查✦标记和删除按钮
  const afterAdd = await evaluate(`(() => ({
    customs: document.querySelectorAll('.lib-sub-custom').length,
    dels: document.querySelectorAll('.lib-sub-del').length,
    hasE2E: [...document.querySelectorAll('.lib-sub-name')].some(e => e.textContent.includes('E2E维护测试组') || e.textContent.includes('E2E子项')),
  }))()`)
  console.log('2) 新增后: ' + JSON.stringify(afterAdd))

  // 3) 直接 JS 调用删除(绕过 CDP 点击)
  const delResult = await evaluate(`(async () => {
    // 找到自定义条目的 dbId
    const delBtn = [...document.querySelectorAll('.lib-sub-del')][0]
    if (!delBtn) return 'NO_BTN'
    // 直接触发 click 事件
    delBtn.dispatchEvent(new MouseEvent('click', { bubbles: false }))
    await new Promise(r => setTimeout(r, 2000))
    return {
      customsAfter: document.querySelectorAll('.lib-sub-custom').length,
      hasE2EAfter: [...document.querySelectorAll('.lib-sub-name')].some(e => e.textContent.includes('E2E')),
      toast: [...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join('|'),
    }
  })()`)
  console.log('3) JS删除: ' + JSON.stringify(delResult))

  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
