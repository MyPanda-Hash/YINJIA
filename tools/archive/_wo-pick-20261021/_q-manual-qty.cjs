/**
 * _q-manual-qty.cjs — 验证「秤不可用时手输数量」能走通(2026-10-21)
 *
 * 背景:台车秤离线时原先直接报「读数不可用」,现场卡死、验证也做不了。
 * 加了「数量」输入框后必须证明:不依赖任何秤读数,扫码 + 手输就能记量。
 *
 * 验证法:故意**不插任何秤数据**(库里最新采样早已过期) ⇒ 应走手输分支;
 * 填数量后扫物料,断言该行 picked > 0。
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-manual-qty.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9487
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  var rows = document.querySelectorAll('.wop-row');
  var first = rows.length ? rows[0].innerText.replace(/\\s+/g,' ').trim() : '';
  return JSON.stringify({
    rowCount: rows.length,
    firstRow: first,
    ok: q('.wop-ok'),
    err: q('.wop-err'),
    scaleHint: q('.wop-scale-hint'),
    hasQtyInput: !!document.querySelector('.wop-qty')
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_manualqty'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/scm/workOrderPick"'); await sleep(3500)
  // 扫工单
  await ev(`(function(){
    var inp = document.querySelectorAll('.wop-input')[0];
    inp.value = 'YJ@GD-2026-10-0220@1001';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  })()`)
  await sleep(4000)
  console.log('LOADED ' + await ev(state))

  // 确认秤此刻不可用(无实时数据),再手输 5 并扫第一行的物料
  const firstCode = await ev(`(function(){
    var e = document.querySelector('.wop-code');
    return e ? e.innerText.trim() : '';
  })()`)
  console.log('FIRST_CODE ' + firstCode)

  const typed = await ev(`(function(){
    // 1) 手输数量 = 5
    var q = document.querySelector('.wop-qty');
    if (!q) return 'no-qty-input';
    q.value = '5';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    // 2) 物料码 = 第一行子件代码 + '|'
    var inps = document.querySelectorAll('.wop-input');
    var m = inps[inps.length - 1];
    m.value = ${JSON.stringify('')} + '${firstCode}|';
    m.dispatchEvent(new Event('input', { bubbles: true }));
    m.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return 'typed';
  })()`)
  console.log('TYPE ' + typed)
  await sleep(3000)
  console.log('AFTER ' + await ev(state))
  await shot('_manual-qty.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
