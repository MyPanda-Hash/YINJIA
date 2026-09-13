/**
 * _walk-inspcheck.cjs — 检验项目及标准页:分组表渲染 + 标准库勾选填入 全链路验证
 * 用法: node --experimental-websocket tools/_walk-inspcheck.cjs [locale]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9347
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const LOCALE = process.argv[2] || 'zh-CN'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-insp-'))
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
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true }); fs.writeFileSync(path.join(__dirname, '_walk', 'shots', name + '.png'), Buffer.from(r.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2500)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');localStorage.setItem('mes_locale', ${JSON.stringify(LOCALE)});'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(800)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3500)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(600)
  // 切到 检验项目及标准 页(第 3 个页签)
  await evaluate(`(() => { const tabs = [...document.querySelectorAll('.rsp-page-tab')]; const t = tabs[2]; if (t) t.click(); return tabs.map((x) => x.textContent.trim()) })()`)
  await sleep(1000)
  await shot('RD_SPEC_DOC-insp-' + LOCALE)
  const before = await evaluate(`(() => ({
    headers: [...document.querySelectorAll('.rsp-dt-wrap')].map((w) => [...w.querySelectorAll('.rs-th')].map((t) => t.textContent.trim()).join('|')),
    rows: document.querySelectorAll('.rs-dt tbody tr').length,
  }))()`)
  console.log('BEFORE: ' + JSON.stringify(before))
  // 打开标准库勾选
  const opened = await evaluate(`(() => { const b = document.querySelector('.rs-lib-btn'); if (!b) return 'NO_BTN'; b.click(); return 'OPENED' })()`)
  await sleep(1000)
  const libInfo = await evaluate(`(() => ({
    groups: document.querySelectorAll('.lib-group').length,
    firstName: document.querySelector('.lib-group-name')?.textContent?.trim() || null,
    checkboxes: document.querySelectorAll('.lib-group .el-checkbox').length,
    dialogVisible: !!document.querySelector('.el-dialog'),
  }))()`)
  console.log('LIB: ' + opened + ' ' + JSON.stringify(libInfo))
  // 勾选:组1(尺寸)两个子项 + 组2(重量)两个子项 + 组5(黑水)两个子项
  const checked = await evaluate(`(() => {
    const boxes = [...document.querySelectorAll('.lib-group')]
    const picks = []
    const idx = [[1, 0], [1, 1], [2, 0], [2, 1], [5, 0], [5, 1]]
    for (const [gi, si] of idx) {
      const g = boxes[gi]
      if (!g) continue
      const cb = [...g.querySelectorAll('.el-checkbox')][si]
      if (cb) { cb.click(); picks.push(g.querySelector('.lib-group-name')?.textContent?.trim() + '#' + si) }
    }
    return picks
  })()`)
  await sleep(400)
  const confirmed = await evaluate(`(() => { const btn = [...document.querySelectorAll('.el-dialog .el-button--primary')].find((b) => b.textContent.includes('追加') || b.textContent.includes('Add Selected')); if (!btn) return 'NO_BTN'; btn.click(); return 'CONFIRMED' })()`)
  await sleep(1200)
  await shot('RD_SPEC_DOC-insp-filled-' + LOCALE)
  const after = await evaluate(`(() => {
    const wrap = [...document.querySelectorAll('.rsp-dt-wrap')].find((w) => w.textContent.includes('4.') || w.textContent.includes('Inspection Items'))
    const rows = wrap ? [...wrap.querySelectorAll('tbody tr')] : []
    return {
      rowCount: rows.length,
      firstCells: rows.slice(0, 10).map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent.trim()).slice(0, 3).join('|')),
      rowSpans: rows.slice(0, 10).map((r) => [...r.querySelectorAll('td')].map((td) => td.getAttribute('rowspan') || td.getAttribute('colspan') || '').join(',')),
    }
  })()`)
  console.log('AFTER: ' + confirmed + ' picks=' + JSON.stringify(checked))
  console.log(JSON.stringify(after, null, 1))
  const metrics = await evaluate(`(() => {
    const wrap = [...document.querySelectorAll('.rsp-dt-wrap')].find((w) => w.textContent.includes('4.'))
    const tbl = wrap ? wrap.querySelector('table.rs-dt') : null
    if (!tbl) return null
    const cols = [...tbl.querySelectorAll('colgroup > col')].map((c) => Math.round(parseFloat(c.style.width)))
    const th = tbl.querySelector('tr.rs-grp th')
    const td = tbl.querySelector('tbody tr.rsp-design td')
    return {
      tableW: Math.round(tbl.getBoundingClientRect().width),
      colW: cols,
      headerH: th ? Math.round(th.getBoundingClientRect().height) : null,
      headerFont: th ? getComputedStyle(th).fontSize : null,
      tdFont: td ? getComputedStyle(td).fontSize : null,
      tdAlign: td ? getComputedStyle(td).textAlign : null,
      thBg: th ? getComputedStyle(th).backgroundColor : null,
    }
  })()`)
  console.log('METRICS: ' + JSON.stringify(metrics))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
