/**
 * _q-barcode-ui.cjs — 条码面板「勾选行 → 打印标签」活体验证(2026-10-18)
 * 用法: node tools/archive/_barcode-ui/_q-barcode-ui.cjs
 * 产出: 同目录 _barcode-*.png + 控制台 JSON(行数/勾选列/按钮/对话框/打印请求)
 */
const CDP_PORT = 9417
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = process.argv[2] || 'BARCODE_MAT'    // 三个条码面板共用同一套渲染,逐个可验
const OUT = __dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}
async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  if (!lj.data?.token) throw new Error('登录失败 ' + JSON.stringify(lj))
  const token = lj.data.token
  const user = JSON.stringify(lj.data.user || {})

  const proc = spawn(EDGE, [
    '--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--window-size=1600,1000', '--user-data-dir=' + path.join(require('os').tmpdir(), '_barcode_cdp'),
    'about:blank',
  ], { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0
  const pending = new Map()
  const netLog = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return }
    if (msg.method === 'Network.requestWillBeSent' && /\/api\//.test(msg.params.request.url)) {
      netLog.push(msg.params.request.method + ' ' + msg.params.request.url.replace('http://localhost:5173', '').replace('http://127.0.0.1:8090', ''))
    }
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text))
    return r.result?.result?.value
  }
  const clickAt = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
  }
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  }

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
  await sleep(3500)
  await evaluate('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await evaluate('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  // 先 reload 让 Pinia 从 localStorage 恢复会话,再切 hash 到目标面板
  // (先 navigate 再 reload 会被登录守卫弹回 dashboard —— 实测 2026-10-18)
  await send('Page.reload', {})
  await sleep(7000)
  await evaluate('location.hash = "#/panelx/list/' + PANEL + '"')
  await sleep(9000)

  const diag = JSON.parse(await evaluate(`(function(){
    return JSON.stringify({
      tbGroups: Array.prototype.map.call(document.querySelectorAll('.tb-group'), function(g){ return (g.innerText||'').replace(/\\s+/g,' ').trim() }).slice(0,20),
      thCheckboxes: document.querySelectorAll('.el-table th .el-checkbox').length,
      firstTh: Array.prototype.map.call(document.querySelectorAll('.el-table th'), function(t){ return (t.innerText||'').trim() }).slice(0,8),
      cfgQr: window.__cfgQr === undefined ? 'n/a' : window.__cfgQr
    })
  })()`))
  console.log('DIAG', JSON.stringify(diag))
  const cfgProbe = await evaluate(`(async function(){
    var t = localStorage.getItem('mes_token')
    var r = await fetch('/api/px/getPanelConfig?panelCode=' + (localStorage.getItem('probe_panel') || 'BARCODE_MAT'), { headers: { Authorization: 'Bearer ' + t } })
    var j = await r.json()
    return JSON.stringify({ qrLabelKey: j.data && j.data.metadata && j.data.metadata.qrLabelKey, qrLabelKind: j.data && j.data.metadata && j.data.metadata.qrLabelKind, groups: (j.data && j.data.metadata && j.data.metadata.buttonGroups || []).map(function(g){ return g.name + ':' + (g.buttons||[]).join(',') }) })
  })()`)
  console.log('CFG', cfgProbe)

  const state = JSON.parse(await evaluate(`(function(){
    var rows = document.querySelectorAll('.el-table__body-wrapper tbody tr')
    var cbs = document.querySelectorAll('.el-table__body-wrapper .el-checkbox')
    var btns = Array.prototype.map.call(document.querySelectorAll('.el-button, .el-button--primary'), function(b){ return (b.innerText||'').replace(/\\s+/g,' ').trim() })
    var grid = document.querySelectorAll('.el-table')
    return JSON.stringify({
      hash: location.hash,
      rows: rows.length,
      checkboxes: cbs.length,
      buttons: btns.filter(Boolean).slice(0, 30),
      tables: grid.length,
      firstRow: rows[0] ? rows[0].innerText.replace(/\\s+/g,' ').trim().slice(0, 160) : null
    })
  })()`))
  console.log('STATE', JSON.stringify(state))
  await shot('_barcode-mat-1.png')

  const toolbarHtml = await evaluate(`(function(){
    var g = Array.prototype.filter.call(document.querySelectorAll('.tb-group'), function(x){ return (x.innerText||'').indexOf('标签') >= 0 })
    return g.length ? g[g.length-1].outerHTML.replace(/\\s+/g,' ').slice(0, 400) : '(无 标签 组)'
  })()`)
  console.log('TOOLBAR', toolbarHtml)

  if (state.checkboxes > 0) {
    // 用 JS 直接点勾选框里的 input(坐标点击在 Element Plus 上偶发不生效)
    const clicked = await evaluate(`(function(){
      var cb = document.querySelectorAll('.el-table__body-wrapper .el-checkbox')
      if (!cb.length) return 0
      var inp = cb[0].querySelector('input')
      if (inp) { inp.click(); return 1 }
      cb[0].click(); return 1
    })()`)
    await sleep(1500)
    const sel = await evaluate(`document.querySelectorAll('.el-table__body-wrapper .el-checkbox.is-checked').length`)
    console.log('CHECKED', sel, 'clicked=', clicked)

    // 点「打印标签」(工具栏按钮可能是 button/.tb-btn/span 任意形态,按文本精确找)
    const btn = await evaluate(`(function(){
      var all = Array.prototype.slice.call(document.querySelectorAll('.tb-group *'))
      for (var i=0;i<all.length;i++){
        var t=(all[i].innerText||'').replace(/\\s+/g,'').trim()
        if(t==='打印标签'){ all[i].click(); return 'clicked:' + t }
      }
      return 'not-found'
    })()`)
    console.log('PRINT_BTN', btn)
    await sleep(5000)
    const dlg = JSON.parse(await evaluate(`(function(){
      var d = document.querySelector('.qr-label-dlg')
      return JSON.stringify({ visible: !!d, cards: d ? d.querySelectorAll('.qr-label-card').length : 0, text: d ? d.innerText.replace(/\\s+/g,' ').trim().slice(0,200) : null })
    })()`))
    console.log('DIALOG', JSON.stringify(dlg))
    await shot('_barcode-mat-2.png')
  }
  console.log('NET', JSON.stringify(netLog.filter((u) => /barcode/.test(u))))
  sock.close && sock.close()
  await send('Browser.close').catch(() => {})
  process.exit(0)
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
