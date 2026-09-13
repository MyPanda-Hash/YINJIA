/**
 * _walk-realclick.cjs — 规格书 1./2./3. 章节行「真实点击+真实输入」功能完善性测试
 * 场景A:已归档单据(只读)——点击应无输入框(设计如此,保存即归档)
 * 场景B:新增草稿——真实鼠标点击聚焦 + 真实键盘输入 → 值写入 → 保存 → 重载读回
 * 用法: node --experimental-websocket tools/_walk-realclick.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9349
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-click-'))
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

  /** 真实点击:取元素内目标点坐标 → CDP 鼠标按下/释放 */
  const realClick = async (expr, anchor = 'input') => {
    const composed = `(() => {
      const el = ${expr}
      if (!el) return null
      const r = el.getBoundingClientRect()
      const label = el.querySelector('.rsp-doclabel')
      const lr = label ? label.getBoundingClientRect() : null
      const x = ${JSON.stringify(anchor)} === 'input' && lr ? (lr.right + r.right) / 2 : (r.left + r.right) / 2
      return { x: Math.round(x), y: Math.round((r.top + r.bottom) / 2), w: Math.round(r.width), h: Math.round(r.height) }
    })()`
    const raw = await send('Runtime.evaluate', { expression: composed, returnByValue: true, awaitPromise: true })
    const rect = raw.result?.result?.value
    console.log('   [realClick] rect=' + JSON.stringify(rect))
    if (!rect) return { ok: false, why: 'NO_EL' }
    const hit = await evaluate(`(() => {
      const el = document.elementFromPoint(${rect.x}, ${rect.y})
      const ta = document.elementFromPoint(${rect.x}, ${rect.y})?.closest('textarea') || null
      const cellTa = ${expr}?.querySelector('textarea')
      const tr = cellTa ? cellTa.getBoundingClientRect() : null
      return { hit: el ? el.tagName + '.' + String(el.className).slice(0, 30) : null, taRect: tr ? { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height) } : null }
    })()`)
    console.log('   [hit] ' + JSON.stringify(hit))
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    return { ok: true, ...rect }
  }
  /** 真实键盘输入(走输入管线,等效人工敲字) */
  const realType = async (text) => { await send('Input.insertText', { text }) }

  const open = async () => { await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200); await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`); await send('Page.navigate', { url: 'about:blank' }); await sleep(600); await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3200); await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(700) }
  const gotoTab2 = async () => { await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][2]; if (t) t.click(); return 1 })()`); await sleep(900) }
  const cellExpr = (name) => `[...document.querySelectorAll('.rsp-doccell')].find((c) => c.textContent.includes('${name}'))`

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await open()

  // ═══ 场景A:当前单据(已归档)——点击 1.适用范围 ═══
  await gotoTab2()
  const archInfo = await evaluate(`(() => ({
    status: document.querySelector('.doc-status')?.textContent?.trim() || document.querySelector('.as-side-status-row .doc-status')?.textContent?.trim() || null,
    hasTextarea: !!${cellExpr('适用范围')}?.querySelector('textarea'),
  }))()`)
  const aClick = await realClick(cellExpr('适用范围'))
  await realType('A场景输入')
  await sleep(400)
  const aAfter = await evaluate(`(() => ({
    activeTag: document.activeElement ? document.activeElement.tagName : null,
    rowText: ${cellExpr('适用范围')}?.textContent?.trim().slice(0, 30) || null,
  }))()`)
  console.log('A(已归档): ' + JSON.stringify({ ...archInfo, click: aClick, after: aAfter }))

  // ═══ 场景B:新增草稿——真实点击三行并敲字 ═══
  const added = await evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((e) => e.textContent.trim() === '新增'); if (!b) return 'NO_BTN'; b.click(); return 'CLICKED' })()`)
  await sleep(2500)
  const bStatus = await evaluate(`document.querySelector('.doc-status')?.textContent?.trim() || document.querySelector('.as-side-status-row .doc-status')?.textContent?.trim()`)
  console.log('B(新增): ' + added + ' 状态=' + bStatus)
  // 封面名称(必填;封面 v-if 仅页签0渲染,先切回)
  await evaluate(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][0]; if (t) t.click(); return 1 })()`)
  await sleep(700)
  const nameFilled = await evaluate(`(() => {
    const line = [...document.querySelectorAll('.rsp-cover-line')].find((l) => l.textContent.includes('名 称'))
    const inp = line ? line.querySelector('input') : null
    if (!inp) return 'NO_NAME_INPUT'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(inp, '真实点击测试')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return 'OK'
  })()`)
  console.log('B(名称): ' + nameFilled)
  await sleep(300)
  await gotoTab2()
  const results = []
  for (const name of ['1.适用范围', '2.整体规格参数', '3.产品主要性能']) {
    const click = await realClick(cellExpr(name))
    await sleep(250)
    const focus = await evaluate(`document.activeElement ? document.activeElement.tagName + '/' + (document.activeElement.className || '') : 'none'`)
    await realType('真实点击填入-' + name.slice(0, 4))
    await sleep(300)
    const val = await evaluate(`(() => { const ta = ${cellExpr(name)}?.querySelector('textarea'); return ta ? ta.value : null })()`)
    results.push({ name, click: click.ok, focus, val: (val || '').slice(0, 18) })
  }
  console.log('B(草稿三行): ' + JSON.stringify(results, null, 1))
  // 保存 + 重载读回
  await evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((e) => e.textContent.trim() === '保存'); if (!b) return 'NO_BTN'; b.click(); return 'CLICKED' })()`)
  await sleep(2500)
  const toast = await evaluate(`[...document.querySelectorAll('.el-message')].map((e) => e.textContent.trim()).join('|')`)
  console.log('B(保存): ' + toast)
  await open()
  await gotoTab2()
  const readBack = await evaluate(`[...document.querySelectorAll('.rsp-doccell')].slice(0, 3).map((c) => c.textContent.trim().slice(0, 26))`)
  console.log('B(重载读回): ' + JSON.stringify(readBack))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
