/**
 * _walk-docrowcheck.cjs — 文档式章节行(1.适用范围/2.整体规格参数/3.产品主要性能)填写链路验证
 * 流程:新增草稿 → 页签2 → 三行输入 → 保存 → 重载 → 读回
 * 用法: node --experimental-websocket tools/_walk-docrowcheck.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9348
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-doc-'))
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  const open = async () => { await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200); await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`); await send('Page.navigate', { url: 'about:blank' }); await sleep(600); await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3200); await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(700) }
  await open()

  // 1) 新增草稿
  const added = await evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((e) => e.textContent.trim() === '新增'); if (!b) return 'NO_BTN'; b.click(); return 'CLICKED' })()`)
  await sleep(2500)
  const docno = await evaluate(`document.querySelector('.rs-docno')?.textContent?.trim()`)
  console.log('ADD: ' + added + ' docno=' + docno)

  // 1.5) 封面(页签0)填 名称(必填,否则保存被拦)
  await evaluate(`(() => {
    const line = [...document.querySelectorAll('.rsp-cover-line')].find((l) => l.textContent.includes('名 称'))
    const inp = line ? line.querySelector('input') : null
    if (!inp) return 'NO_NAME_INPUT'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(inp, 'E2E-填写链路测试')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return 'OK'
  })()`)
  await sleep(400)

  // 2) 切页签 2(检验项目及标准)
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][2]; if (t) t.click(); return 1 })()`)
  await sleep(900)

  // 3) 三行输入(native setter + input 事件)
  const typed = await evaluate(`(() => {
    const out = []
    const cells = [...document.querySelectorAll('.rsp-doccell')]
    const targets = cells.filter((c) => /适用范围|整体规格参数|产品主要性能/.test(c.textContent))
    for (const c of targets) {
      const ta = c.querySelector('textarea')
      if (!ta) { out.push(c.textContent.slice(0, 14) + ':NO_TEXTAREA'); continue }
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, '测试填写-' + c.textContent.slice(0, 6))
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      out.push(c.textContent.slice(0, 14) + ':OK')
    }
    return out
  })()`)
  console.log('TYPED: ' + JSON.stringify(typed))
  const editStyle = await evaluate(`(() => { const ta = document.querySelector('.rsp-doccell textarea'); if (!ta) return null; const cs = getComputedStyle(ta); return cs.borderBottomWidth + ' ' + cs.borderBottomStyle + ' ' + cs.borderBottomColor } )()`)
  console.log('EDIT_STYLE: ' + editStyle)
  await sleep(500)

  // 4) 保存
  const saved = await evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((e) => e.textContent.trim() === '保存'); if (!b) return 'NO_BTN'; b.click(); return 'CLICKED' })()`)
  await sleep(2500)
  const toast = await evaluate(`[...document.querySelectorAll('.el-message')].map((e) => e.textContent.trim()).join('|')`)
  console.log('SAVE: ' + saved + ' toast=' + toast)

  // 5) 重载读回
  await open()
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][2]; if (t) t.click(); return 1 })()`)
  await sleep(900)
  const readBack = await evaluate(`(() => ({
    docno: document.querySelector('.rs-docno')?.textContent?.trim(),
    rows: [...document.querySelectorAll('.rsp-doccell')].map((c) => c.textContent.trim().slice(0, 40)),
    hasTextarea: !!document.querySelector('.rsp-doccell textarea'),
    taVisible: (() => { const ta = document.querySelector('.rsp-doccell textarea'); if (!ta) return null; const cs = getComputedStyle(ta); return cs.borderBottomWidth + '/' + cs.backgroundColor } )(),
  }))()`)
  console.log('READBACK: ' + JSON.stringify(readBack, null, 1))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
