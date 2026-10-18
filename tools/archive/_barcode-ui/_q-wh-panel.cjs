/**
 * _q-wh-panel.cjs — 仓库(WH)面板打不开的现场取证:控制台异常 + 截图
 * 用法: node tools/archive/_barcode-ui/_q-wh-panel.cjs [PANEL]
 */
const CDP_PORT = 9419
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = process.argv[2] || 'WH'
const OUT = __dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const U = process.env.PROBE_USER || 'admin'
  const P = process.env.PROBE_PASS || '123456'
  console.log('LOGIN_AS', U)
  const FACTORY = process.env.PROBE_FACTORY || 'YJ'
  console.log('FACTORY', FACTORY)
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: U, password: P, factory: FACTORY }) })
  const lj = await lr.json()
  const token = lj.data.token
  const user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--window-size=1600,1000', '--user-data-dir=' + path.join(require('os').tmpdir(), '_wh_cdp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []; const logs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => {
    const m = JSON.parse(data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      errs.push((d.exception && (d.exception.description || d.exception.value)) || d.text)
    }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300))
    }
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  const BASE = process.env.PROBE_BASE || 'http://localhost:5173'
  console.log('BASE', BASE)
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload', {}); await sleep(7000)
  await ev('location.hash = "#/panelx/list/' + PANEL + '"'); await sleep(9000)
  const state = JSON.parse(await ev(`(function(){
    return JSON.stringify({
      hash: location.hash,
      bodyText: (document.body.innerText || '').replace(/\\s+/g,' ').trim().slice(0, 400),
      tables: document.querySelectorAll('.el-table').length,
      rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
      hasErrorBox: !!document.querySelector('.el-message--error, .error-boundary, .empty-block')
    })
  })()`))
  console.log('STATE', JSON.stringify(state))
  await shot('_wh-' + PANEL + '.png')

  // 点「新增」:档案面板应进入编辑态(出现可填的表单格)
  const addClicked = await ev(`(function(){
    var all = Array.prototype.slice.call(document.querySelectorAll('.tb-group *'))
    for (var i=0;i<all.length;i++){ if ((all[i].innerText||'').replace(/\\s+/g,'').trim()==='新增'){ all[i].click(); return 'clicked' } }
    return 'not-found'
  })()`)
  await sleep(3000)
  const afterAdd = JSON.parse(await ev(`(function(){
    var msgs = Array.prototype.slice.call(document.querySelectorAll('.el-message')).map(function(m){ return (m.innerText||'').trim() })
    var rows = document.querySelectorAll('.el-table__body-wrapper tbody tr')
    return JSON.stringify({
      inputs: document.querySelectorAll('.el-table input, .fields input').length,
      editableCells: document.querySelectorAll('.cell-edit, .inline-input, td .el-input').length,
      dialog: !!document.querySelector('.el-dialog'),
      messages: msgs,
      rowCount: rows.length,
      firstRow: rows[0] ? rows[0].innerText.replace(/\\s+/g,' ').trim().slice(0, 120) : null,
      bodyTail: (document.body.innerText || '').replace(/\\s+/g,' ').trim().slice(0, 160)
    })
  })()`))
  console.log('ADD', addClicked, JSON.stringify(afterAdd))

  // 双击第一行:档案面板应进入该行编辑态
  const dbl = await ev(`(function(){
    var tr = document.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
    if (!tr) return 'no-row'
    var r = tr.getBoundingClientRect()
    var x = r.x + Math.min(180, r.width/3), y = r.y + r.height/2
    var evs = ['mousedown','mouseup','click','mousedown','mouseup','click','dblclick']
    evs.forEach(function(t){ tr.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window, clientX:x, clientY:y, detail: t==='dblclick'?2:1})) })
    return 'sent'
  })()`)
  await sleep(2500)
  const afterDbl = JSON.parse(await ev(`(function(){
    var msgs = Array.prototype.slice.call(document.querySelectorAll('.el-message')).map(function(m){ return (m.innerText||'').trim() })
    return JSON.stringify({
      dbl: true,
      inputs: document.querySelectorAll('.el-table input').length,
      messages: msgs,
      firstRowInputs: document.querySelectorAll('.el-table__body-wrapper tbody tr')[0] ? document.querySelectorAll('.el-table__body-wrapper tbody tr')[0].querySelectorAll('input').length : 0
    })
  })()`))
  // 单击第一行第 2、3 个单元格:档案面板应就地进入编辑态(WHLOC 能进,WH 若进不去就是真 bug)
  const clickCell = await ev(`(function(){
    var tr = document.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
    if (!tr) return 'no-row'
    var tds = tr.querySelectorAll('td')
    var out = []
    for (var i = 1; i <= 3 && i < tds.length; i++) {
      var r = tds[i].getBoundingClientRect()
      var x = r.x + r.width/2, y = r.y + r.height/2
      ;['mousedown','mouseup','click'].forEach(function(t){ tds[i].dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window, clientX:x, clientY:y})) })
      out.push(i)
    }
    return out.join(',')
  })()`)
  await sleep(2000)
  const afterClick = JSON.parse(await ev(`(function(){
    var tr = document.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
    var msgs = Array.prototype.slice.call(document.querySelectorAll('.el-message')).map(function(m){ return (m.innerText||'').trim() })
    return JSON.stringify({
      inputsInRow: tr ? tr.querySelectorAll('input').length : 0,
      inputsAll: document.querySelectorAll('.el-table input').length,
      messages: msgs
    })
  })()`))
  console.log('CLICK', clickCell, JSON.stringify(afterClick))
  // 「新增数据」(档案明细加一行)是否可用
  const addRow = await ev(`(function(){
    var all = Array.prototype.slice.call(document.querySelectorAll('button, .el-button, span, div'))
    for (var i=0;i<all.length;i++){ if ((all[i].innerText||'').replace(/\\s+/g,'').trim()==='新增数据'){ all[i].click(); return 'clicked' } }
    return 'not-found'
  })()`)
  await sleep(2500)
  const afterAddRow = JSON.parse(await ev(`(function(){
    var rows = document.querySelectorAll('.el-table__body-wrapper tbody tr')
    var msgs = Array.prototype.slice.call(document.querySelectorAll('.el-message')).map(function(m){ return (m.innerText||'').trim() })
    return JSON.stringify({ rows: rows.length, inputs: document.querySelectorAll('.el-table input').length, messages: msgs })
  })()`))
  console.log('ADDROW', addRow, JSON.stringify(afterAddRow))
  const cellCls = await ev(`(function(){
    var tr = document.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
    if (!tr) return 'no-row'
    var tds = Array.prototype.slice.call(tr.querySelectorAll('td')).slice(1,4)
    return tds.map(function(td){
      var inner = td.querySelector('span,div')
      return (td.className||'').trim() + ' > ' + (inner ? (inner.className||'').trim() : 'plain') + ' :: ' + (td.innerText||'').trim().slice(0,20)
    }).join(' | ')
  })()`)
  console.log('CELLS', cellCls)
  console.log('DBL', dbl, JSON.stringify(afterDbl))
  console.log('ERRS', JSON.stringify(errs.slice(0, 6)))
  await shot('_wh-add-' + PANEL + '.png')
  process.exit(0)
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
