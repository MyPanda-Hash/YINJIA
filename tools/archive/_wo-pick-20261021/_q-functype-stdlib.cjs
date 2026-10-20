/**
 * _q-functype-stdlib.cjs — 验证「产品功能类别」已变成标准库类型(2026-10-21)
 *
 * 判据三条:
 *   ① 该字段旁边出现「⧉ 标准库维护」入口(说明 data_type=标准库 被前端识别)
 *   ② 点开维护弹窗能看到 除余氯/VOC/重金属 三条
 *   ③ 下拉能选到这三项
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-functype-stdlib.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9492
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var txt = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  var libBtns = Array.prototype.map.call(document.querySelectorAll('.rs-lib-btn, .lib-btn, [class*=lib-btn]'), function(e){return e.innerText.trim()});
  // 找到「产品功能类别」所在的行，看它后面有没有 lib 按钮
  var found = null;
  var labels = Array.prototype.slice.call(document.querySelectorAll('.rs-label'));
  for (var i=0;i<labels.length;i++){
    if (labels[i].innerText.replace(/\\s/g,'').indexOf('产品功能类别')>=0){
      var tr = labels[i].closest('tr');
      if (tr) found = { rowText: tr.innerText.replace(/\\s+/g,' ').trim().slice(0,120), hasLib: !!tr.querySelector('.rs-lib-btn') };
      break;
    }
  }
  var ctrl = null;
  for (var j=0;j<labels.length;j++){
    if (labels[j].innerText.replace(/s/g,'').indexOf('产品管控等级')>=0){
      var tr2 = labels[j].closest('tr');
      if (tr2) ctrl = { rowText: tr2.innerText.replace(/s+/g,' ').trim().slice(0,120), hasLib: !!tr2.querySelector('.rs-lib-btn, [class*=lib-btn]') };
      break;
    }
  }
  return JSON.stringify({
    ctrlRow: ctrl,
    libBtnCount: libBtns.length,
    libBtns: libBtns.slice(0,8),
    funcTypeRow: found,
    dlgTitle: txt('.el-dialog__title')
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_functype'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/panelx/list/RD_PROD_INFO"'); await sleep(7000)
  console.log('FORM ' + await ev(state))
  await shot('_functype-form.png')

  // 点产品功能类别旁的维护按钮
  const clicked = await ev(`(function(){
    var labels = Array.prototype.slice.call(document.querySelectorAll('.rs-label'));
    for (var i=0;i<labels.length;i++){
      if (labels[i].innerText.replace(/\\s/g,'').indexOf('产品功能类别')>=0){
        var tr = labels[i].closest('tr');
        var b = tr && tr.querySelector('.rs-lib-btn');
        if (b) { b.click(); return 'clicked'; }
        return 'no-btn';
      }
    }
    return 'no-row';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(2500)
  console.log('DIALOG ' + await ev(`(function(){
    var t = document.querySelector('.el-dialog__title');
    var rows = document.querySelectorAll('.el-dialog .el-table__row, .el-dialog .el-table tbody tr');
    var texts = Array.prototype.map.call(rows, function(r){return r.innerText.replace(/\\s+/g,' ').trim().slice(0,40)}).slice(0,8);
    return JSON.stringify({ title: t?t.innerText.trim():'', rowCount: rows.length, rows: texts });
  })()`))
  await shot('_functype-stdlib.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
