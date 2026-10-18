/** _q-dc-ui.cjs — 数采平台三页活体取证(config/monitor/stats + 受限账号写按钮隐藏) 2026-10-18 */
const CDP_PORT = 9446
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname, BASE = 'http://127.0.0.1:8090'
const ACC = process.argv[2] || 'admin'
const PWD = process.argv[3] || '123456'
const FACTORY = process.argv[4] || 'YJ'   // YJ=正式账套 / YJ_TEST=测试账套
const TAG = FACTORY === 'YJ' ? '' : '-test'   // 截图后缀,避免两账套互相覆盖
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const readKpis = "(function(){ return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-kpi'), function (k) { return { label: (k.querySelector('.dc-kpi-label')||{}).innerText || '', num: (k.querySelector('.dc-kpi-num')||{}).innerText || '' } })) })()"
const readTables = "(function(){ return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-table'), function (tb, i) { var rows = Array.prototype.map.call(tb.querySelectorAll('.el-table__body-wrapper tbody tr'), function (tr) { return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) { return (td.innerText||'').trim() }).join(' | ') }); var empty = tb.querySelector('.el-table__empty-text'); return { i: i, rows: rows, empty: empty ? (empty.innerText||'').trim() : null } })) })()"

async function main() {
  const lr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: ACC, password: PWD, factory: FACTORY }) })
  const lj = await lr.json()
  if (!lj.data || !lj.data.token) { console.log('LOGIN_FAIL ' + JSON.stringify(lj).slice(0, 300)); process.exit(1) }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_dcdc_' + ACC), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 200)) })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const res = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (res.result && res.result.exceptionDetails) throw new Error('EVAL: ' + String(res.result.exceptionDetails.exception && res.result.exceptionDetails.exception.description || '').slice(0, 300)); return res.result && res.result.result ? res.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(7000)
  console.log('AUTH ' + await ev('JSON.stringify({ hash: location.hash, token: !!localStorage.getItem("mes_token") })'))
  console.log('MENU ' + await ev("(function(){ var t = (document.querySelector('.app-aside, aside, .el-menu') || document.body).innerText; return JSON.stringify({ hasDc: t.indexOf('数采') >= 0, snippet: t.slice(0, 240) }) })()"))

  const go = async (hash) => { await ev('location.hash = "' + hash + '"'); await sleep(4500) }
  await go('#/dc/config')
  console.log('CFG_TITLE ' + await ev('JSON.stringify({ h1: (document.querySelector("h1.dc-title")||{}).innerText, hash: location.hash })'))
  console.log('CFG_KPI ' + await ev(readKpis))
  console.log('CFG_TABLES ' + await ev(readTables))
  console.log('CFG_BAR ' + await ev("JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-bar .el-button'), function (b) { return (b.innerText||'').trim() }).concat([(document.querySelector('.dc-readonly-tip')||{}).innerText||'']).filter(Boolean))"))
  console.log('CFG_OPS ' + await ev("JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.dc-row-btns'), function (s) { return (s.innerText||'').trim() }))"))
  await shot('_dc-config-1440-' + ACC + TAG + '.png')
  // 采集点/规则弹窗(本轮新增功能):点开弹窗取标题+表格行
  const openDlg = async (btnSel, name, shotName) => {
    const clicked = await ev('(function(){ var b = document.querySelector(' + JSON.stringify(btnSel) + '); if (!b) return false; b.click(); return true })()')
    if (!clicked) { console.log(name + ' NO_BUTTON ' + btnSel); return }
    await sleep(2500)
    console.log(name + ' ' + await ev('(function(){ var cs = document.querySelectorAll(".el-dialog"); var d = null; for (var ci = 0; ci < cs.length; ci++) { if (cs[ci].offsetParent !== null) { d = cs[ci]; break } } if (!d) return JSON.stringify({ open: false }); var trs = Array.prototype.map.call(d.querySelectorAll(".el-table__body-wrapper tbody tr"), function (tr) { return Array.prototype.map.call(tr.querySelectorAll("td"), function (td) { return (td.innerText||"").trim() }).join(" | ") }); var labels = Array.prototype.map.call(d.querySelectorAll(".el-form-item__label"), function (l) { return (l.innerText||"").trim() }); return JSON.stringify({ open: true, title: (d.querySelector(".el-dialog__title")||{}).innerText || "", rows: trs, fields: labels }) })()'))
    await shot(shotName + '-' + ACC + TAG + '.png')
    // 只点“可见那个”弹窗的关闭按钮(两个弹窗都渲染在 DOM 里,取最后一个会点到 display:none 的)
    await ev('(function(){ var ds = document.querySelectorAll(".el-dialog"); for (var i = 0; i < ds.length; i++) { if (ds[i].offsetParent === null) continue; var b = ds[i].querySelector(".el-dialog__headerbtn"); if (b) { b.click(); return "closed" } } return "none" })()')
    await sleep(1500)
  }
  // 设备表列序:编码|名称|类型|网关|进度|缺项|采集点(7)|规则(8)|操作 ⇒ 用 td 序号点链接按钮
  await openDlg('.dc-table tbody tr:nth-child(1) td:nth-child(8) .el-button', 'CFG_POINT_DLG', '_dc-points-1440')
  await openDlg('.dc-table tbody tr:nth-child(1) td:nth-child(9) .el-button', 'CFG_RULE_DLG', '_dc-rules-1440')
  const widths = [[768, 900, '768'], [375, 780, '375']]
  for (let w = 0; w < widths.length; w++) {
    await send('Emulation.setDeviceMetricsOverride', { width: widths[w][0], height: widths[w][1], deviceScaleFactor: 1, mobile: widths[w][0] < 500 })
    await sleep(1800)
    console.log('WIDTH_' + widths[w][2] + ' ' + await ev('JSON.stringify({ docW: document.documentElement.scrollWidth, winW: window.innerWidth })'))
    await shot('_dc-config-' + widths[w][2] + '-' + ACC + TAG + '.png')
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(1200)

  await go('#/dc/monitor')
  console.log('MON ' + await ev("(function(){ var devs = Array.prototype.map.call(document.querySelectorAll('.dc-dev'), function (d) { return { name: (d.querySelector('.dc-dev-name')||{}).innerText || '', meta: (d.querySelector('.dc-dev-meta')||{}).innerText || '' } }); var heads = Array.prototype.map.call(document.querySelectorAll('.dc-card-title'), function (h) { return (h.innerText||'').trim() }); var empties = Array.prototype.map.call(document.querySelectorAll('.dc-empty, .dc-side-empty'), function (e) { return (e.innerText||'').trim().slice(0, 90) }); return JSON.stringify({ h1: (document.querySelector('h1.dc-title')||{}).innerText, devs: devs, cards: heads, empties: empties.slice(0, 4) }) })()"))
  console.log('MON_TABLES ' + await ev(readTables))
  await shot('_dc-monitor-1440-' + ACC + TAG + '.png')

  await go('#/dc/stats')
  console.log('ST_TITLE ' + await ev('JSON.stringify({ h1: (document.querySelector("h1.dc-title")||{}).innerText })'))
  console.log('ST_KPI ' + await ev(readKpis))
  console.log('ST_TREND ' + await ev("JSON.stringify({ cols: document.querySelectorAll('.dc-trend-col').length, empty: Array.prototype.map.call(document.querySelectorAll('.dc-empty'), function (e) { return (e.innerText||'').trim().slice(0, 70) }).slice(0, 3) })"))
  console.log('ST_TABLES ' + await ev(readTables))
  await shot('_dc-stats-1440-' + ACC + TAG + '.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) {}
  process.exit(0)
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })