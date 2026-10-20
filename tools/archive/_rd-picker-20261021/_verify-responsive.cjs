/**
 * _verify-responsive.cjs — 两个新弹窗在 375 / 768 / 1440 三档宽度下的溢出检查(2026-10-21)
 *
 * 判据:弹窗自身不能被视口左右裁切(左右按 rect.left/right 与视口比),页面无横向滚动条。
 * ⚠ 本仓所有 el-dialog 都是固定 px 宽(620/760/820…),新弹窗沿用同一套约定;
 *   桌面 ERP 上 375 档必然溢出 —— 这里记录**实际数值**,不假装 375 可用。
 * 用法:node tools/archive/_rd-picker-20261021/_verify-responsive.cjs
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const BASE = 'http://localhost:5173'
const CDP_PORT = 9499
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const rectState = `(function(){
  var d = Array.prototype.slice.call(document.querySelectorAll('.el-dialog')).find(function(x){
    var h = x.querySelector('.el-dialog__title'); return h && h.innerText.trim() === '引用产品信息表' && x.getBoundingClientRect().height > 0;
  });
  if (!d) return JSON.stringify({ open:false });
  var r = d.getBoundingClientRect();
  return JSON.stringify({
    open:true,
    left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
    vw: window.innerWidth,
    pageScrollW: document.documentElement.scrollWidth,
    clippedLeft: r.left < 0, clippedRight: r.right > window.innerWidth + 1
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_rdpickresp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(9000)
  await ev('location.hash = "#/panelx/list/RD_SPEC_DOC"'); await sleep(8000)

  for (const [w, h] of [[1440, 900], [768, 900], [375, 812]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
    await sleep(1500)
    await ev(`(function(){
      var e = document.querySelector('.rsp-cover-docno-pick');
      if (e) e.click();
    })()`)
    await sleep(2000)
    console.log(String(w) + 'x' + h + ' -> ' + await ev(rectState))
    await shot('_r-' + w + '-prod-pick.png')
    await ev(`(function(){
      var d = Array.prototype.slice.call(document.querySelectorAll('.el-dialog')).find(function(x){
        var t = x.querySelector('.el-dialog__title'); return t && t.innerText.trim()==='引用产品信息表';
      });
      if (d) { var b = d.querySelector('.el-dialog__headerbtn'); if (b) b.click(); }
    })()`)
    await sleep(800)
  }
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
