/**
 * _q-matpick-expand.cjs — 验证「从物料清单引用」勾选即展开/可收起(2026-10-21)
 *
 * 用户口径:「再优化一下,勾选就会展开子件内容,也可以点击收起来」
 *
 * 断言:
 *   ① 勾选一行 → 该行下方展开子件表(含 子件代码/名称/单位/标准用量)
 *   ② 取消勾选 → 展开收起
 *   ③ 弹窗列仍是 物料编码|单据日期|物料代码|物料名称|子件数
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-matpick-expand.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9494
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const dlgState = `(function(){
  var dlg = Array.prototype.slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.offsetParent !== null });
  if (!dlg.length) return JSON.stringify({ noDialog: true });
  var d = dlg[dlg.length-1];
  var heads = Array.prototype.map.call(d.querySelectorAll('thead th'), function(e){return e.innerText.trim()});
  var bodyRows = d.querySelectorAll('tbody tr.el-table__row');
  var expandRows = d.querySelectorAll('tbody tr.el-table__row--level-0, tbody tr[class*="expanded"], .mp-kids');
  var kids = d.querySelectorAll('.mp-kids');
  var kidText = kids.length ? kids[0].innerText.replace(/\\s+/g,' ').trim().slice(0,160) : '';
  return JSON.stringify({
    title: (d.querySelector('.el-dialog__title')||{}).innerText || '',
    heads: heads,
    bodyRowCount: bodyRows.length,
    expandBlockCount: kids.length,
    kidText: kidText
  });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_matpickexp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 200))
  })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/panelx/list/RD_SPEC_DOC"'); await sleep(7000)

  // 先建一张草稿单(已归档的只读,页面上不渲染「从物料清单引用」按钮)
  const addR = await ev(`(function(){ var bs = Array.prototype.slice.call(document.querySelectorAll('button')); var b = bs.find(function(e){ return e.innerText.trim()==='新增' }); if(!b) return 'no-add'; b.click(); return 'add-clicked'; })()`)
  console.log('ADD ' + addR)
  await sleep(6000)

  // 切到「成品及包装运输」页:按文本找最内层元素,点它自己和父级
  const tabR = await ev(`(function(){
    var els = Array.prototype.slice.call(document.querySelectorAll('*'));
    var t = els.filter(function(e){ return e.children.length===0 && e.innerText && e.innerText.trim()==='成品及包装运输' });
    if (!t.length) return 'no-tab';
    t[0].click();
    if (t[0].parentElement) t[0].parentElement.click();
    return 'tab-clicked';
  })()`)
  console.log('TAB ' + tabR)
  await sleep(2500)

  const openR = await ev(`(function(){
    var els = Array.prototype.slice.call(document.querySelectorAll('*'));
    var b = els.filter(function(e){ return e.innerText && e.innerText.trim().indexOf('从物料清单引用')>=0 && e.offsetParent!==null });
    if (!b.length) return 'no-btn';
    b[b.length-1].click();
    return 'clicked';
  })()`)
  console.log('OPEN ' + openR)
  await sleep(3500)
  console.log('BEFORE ' + await ev(dlgState))
  await shot('_matpick-expand-before.png')

  // 勾第一行
  const chk = await ev(`(function(){
    var dlg = Array.prototype.slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.offsetParent !== null });
    if (!dlg.length) return 'no-dialog';
    var d = dlg[dlg.length-1];
    var tr = d.querySelector('tbody tr.el-table__row');
    if (!tr) return 'no-row';
    var cb = tr.querySelector('.el-checkbox');
    if (!cb) return 'no-cb';
    cb.click();
    return 'checked';
  })()`)
  console.log('CHECK ' + chk)
  await sleep(1500)
  console.log('AFTER_CHECK ' + await ev(dlgState))
  await shot('_matpick-expand-open.png')

  // 再点一次取消勾选,应收起
  const unchk = await ev(`(function(){
    var dlg = Array.prototype.slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){ return d.offsetParent !== null });
    if (!dlg.length) return 'no-dialog';
    var d = dlg[dlg.length-1];
    var tr = d.querySelector('tbody tr.el-table__row');
    var cb = tr && tr.querySelector('.el-checkbox');
    if (!cb) return 'no-cb';
    cb.click();
    return 'unchecked';
  })()`)
  console.log('UNCHECK ' + unchk)
  await sleep(1500)
  console.log('AFTER_UNCHECK ' + await ev(dlgState))
  await shot('_matpick-expand-close.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
