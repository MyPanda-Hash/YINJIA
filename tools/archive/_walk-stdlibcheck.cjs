/** _walk-stdlibcheck.cjs — 标准库全链路:7/8 默认预填 + 章节库勾选/自补充 + 检验库自定义补充 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9355
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-std-'))
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
  const clickReal = async (expr) => { const r = await evaluate(`(() => { const el = ${expr}; if (!el) return false; const b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } })()`); if (!r) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 }); return true }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3200)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)

  // 1) 新增 → 7./8. 默认预填(第4页)
  await clickReal(`[...document.querySelectorAll('.as-side-btn')].find(e => e.textContent.trim() === '新增')`)
  await sleep(2500)
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][3]; if (t) t.click(); return 1 })()`); await sleep(900)
  const defaults = await evaluate(`(() => ({
    all: [...document.querySelectorAll('.rsp-doccell')].map(c => c.textContent.trim().slice(0, 8)),
    运输: (() => { const tas = [...document.querySelectorAll('.rsp-doccell textarea')]; const t = tas.find(x => x.closest('.rsp-doccell').textContent.includes('运输要求')); return t ? t.value.slice(0, 32) : '(无)' })(),
    存储: (() => { const tas = [...document.querySelectorAll('.rsp-doccell textarea')]; const t = tas.find(x => x.closest('.rsp-doccell').textContent.includes('存储环境')); return t ? t.value.slice(0, 32) : '(无)' })(),
  }))()`)
  console.log('1) 默认预填: ' + JSON.stringify(defaults))

  // 2) 章节标准库:第2页 1.适用范围 打开→勾选第1条→回填
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][2]; if (t) t.click(); return 1 })()`); await sleep(800)
  await clickReal(`[...document.querySelectorAll('.rsp-lib-pick')][0]`)
  await sleep(1000)
  const libOpen = await evaluate(`(() => ({ visible: !!document.querySelector('.el-dialog'), title: document.querySelector('.el-dialog__title')?.textContent?.trim(), items: document.querySelectorAll('.sec-lib-item').length }))()`)
  console.log('2) 章节库打开: ' + JSON.stringify(libOpen))
  await clickReal(`document.querySelector('.sec-lib-item')`)
  await sleep(700)
  const applied = await evaluate(`(() => { const ta = document.querySelectorAll('.rsp-doccell textarea')[0]; return ta ? ta.value.slice(0, 24) : null })()`)
  console.log('   勾选回填: ' + JSON.stringify(applied))

  // 3) 自行补充章节条目(对话框新增 → 列表出现)
  await clickReal(`[...document.querySelectorAll('.rsp-lib-pick')][0]`)
  await sleep(900)
  await evaluate(`(() => { const ta = document.querySelector('.sec-lib-add textarea'); if (!ta) return 'NO'; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, 'E2E自定义条目-测试'); ta.dispatchEvent(new Event('input', { bubbles: true })); return 'OK' })()`)
  await sleep(300)
  await clickReal(`[...document.querySelectorAll('.el-dialog')].find(d => d.textContent.includes('章节标准库'))?.querySelector('.sec-lib-add button')`)
  await sleep(1200)
  const added = await evaluate(`(() => ({ items: document.querySelectorAll('.sec-lib-item').length, hasE2E: [...document.querySelectorAll('.sec-lib-text')].some(e => e.textContent.includes('E2E自定义条目')) }))()`)
  console.log('3) 自行补充: ' + JSON.stringify(added))
  await evaluate(`[...document.querySelectorAll('.el-dialog__headerbtn')].pop()?.click(); 1`); await sleep(500)

  // 4) 检验项目库:自定义补充 → 合并分组出现
  await clickReal(`document.querySelector('.rs-lib-btn')`)
  await sleep(1000)
  await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.textContent.includes('检验项目标准库'))
    if (!dlg) return 'NO_DIALOG'
    const set = (sel, val) => { const i = dlg.querySelector(sel); if (!i) return false; const s = Object.getOwnPropertyDescriptor(i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; s.call(i, val); i.dispatchEvent(new Event('input', { bubbles: true })); return true }
    set('.lib-custom-form .el-input__inner', 'E2E自定义组')
    const tas = [...dlg.querySelectorAll('.lib-custom-form textarea')]
    if (tas[0]) { const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; s.call(tas[0], 'E2E自定义要求'); tas[0].dispatchEvent(new Event('input', { bubbles: true })) }
    return 'OK'
  })()`)
  await sleep(300)
  await clickReal(`[...document.querySelectorAll('.el-dialog')].find(d => d.textContent.includes('检验项目标准库'))?.querySelector('.lib-custom-form button')`)
  await sleep(1500)
  const custom = await evaluate(`(() => ({
    groups: document.querySelectorAll('.lib-group').length,
    hasE2E: [...document.querySelectorAll('.lib-group-name')].some(e => e.textContent.includes('E2E自定义组')),
  }))()`)
  console.log('4) 检验库自定义: ' + JSON.stringify(custom))
  await evaluate(`[...document.querySelectorAll('.el-dialog__headerbtn')].pop()?.click(); 1`)
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
