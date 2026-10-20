/**
 * _q-login-srv.cjs — 验证登录页的服务器地址入口(2026-10-21)
 *
 * 背景:用户报「改成本地之后,选择工厂选不了」—— 服务器地址原先只能在扫码页改,
 * 而扫码页要登录后才进得去 ⇒ 配错就死锁。登录页加了入口,必须证明它真会渲染。
 *
 * 验证法:用 Page.addScriptToEvaluateOnNewDocument 在页面初始化前注入 Capacitor 桩
 * (模拟 App 环境),再看登录页底部是否出现地址按钮、点开是否有弹窗。
 * 注意:App 环境下 apiBase() 返回绝对地址,登录页拉工厂会跨域 —— 这不影响本探针
 * (只验渲染与交互,不验接口)。
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-login-srv.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9488
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  return JSON.stringify({
    srvBtn: q('.footer-srv'),
    hasSrvBtn: !!document.querySelector('.footer-srv'),
    status: q('.footer-status'),
    dlgTitle: q('.srv-title'),
    hasInput: !!document.querySelector('.srv-input'),
    inputVal: (document.querySelector('.srv-input')||{}).value || ''
  });
})()`

async function main() {
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_loginsrv'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: true })

  // 关键:在页面任何脚本之前注入 Capacitor 桩,模拟 App 环境
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.Capacitor = { isNativePlatform: function(){ return true; }, getPlatform: function(){ return 'android'; } };`,
  })
  // 预置服务器地址为局域网(避免打公网)
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('mes_api_origin', 'http://192.168.0.238:8090'); } catch(e){}`,
  })

  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(6000)
  console.log('LOGIN ' + await ev(state))
  await shot('_login-srv-btn.png')

  // 点开弹窗
  const clicked = await ev(`(function(){
    var b = document.querySelector('.footer-srv');
    if (!b) return 'no-btn';
    b.click();
    return 'clicked';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(1200)
  console.log('DIALOG ' + await ev(state))
  await shot('_login-srv-dialog.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
