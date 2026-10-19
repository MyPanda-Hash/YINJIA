/** _q-verify-fix.cjs — 验证「标题不能为空」定位修复(2026-10-19)
 *  1) 打开 RD_INSP_PLAN 编辑表单
 *  2) 找保存入口(按钮/下拉/侧栏,不限 <button>)
 *  3) 清空标题后点保存 → 期望 .field-blink 出现在「标题」那一栏 + 自动滚动 + 焦点进输入框
 *  用法(仓库根):node tools/archive/_rd-insp-plan-title-20261019/_q-verify-fix.cjs [code] [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const CODE = process.argv[2] || 'IP-2026-10-0001'
const PORT = process.argv[3] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9483
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var msgs = Array.prototype.map.call(document.querySelectorAll('.el-message__content, .el-message'), function(e){ return (e.innerText||'').trim() }).filter(Boolean);
  var blink = document.querySelectorAll('.fields .field.field-blink');
  var blinkInfo = [];
  blink.forEach(function(el){ var lb = el.querySelector('label'); blinkInfo.push({ code: el.dataset.code, label: lb ? lb.innerText.trim() : '' }) });
  var focused = document.activeElement;
  return JSON.stringify({
    messages: msgs.slice(-2),
    blinkCount: blink.length,
    blinkInfo: blinkInfo,
    activeInTitle: !!(focused && focused.closest && focused.closest('.field') && focused.closest('.field').dataset.code === '标题'),
    scrollY: Math.round(window.scrollY || 0)
  });
})()`

// 列出所有"像按钮"的元素(button 以及带 role/class 的可点击块),取其文案
const listClickables = `(function(){
  var out = [];
  document.querySelectorAll('button, [role="button"], .el-button, .as-side-btn, .as-btn, [class*="btn"]').forEach(function(e){
    var t = (e.innerText || '').trim();
    if (t && t.length <= 12) out.push(t);
  });
  return JSON.stringify(Array.from(new Set(out)).slice(0, 50));
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_verifyfix'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/panelx/form/RD_INSP_PLAN?code=' + CODE + '"')
  await sleep(7000)
  console.log('CLICKABLES ' + await ev(listClickables))

  // 清空标题(模拟用户没填就点保存)
  await ev(`(function(){
    document.querySelectorAll('.fields .field').forEach(function(f){
      if (!f.dataset || f.dataset.code !== '标题') return;
      var inp = f.querySelector('input,textarea');
      if (inp && !inp.disabled) { inp.value=''; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); }
    });
    return 'cleared';
  })()`)
  await sleep(800)
  console.log('BEFORE ' + await ev(state))

  // 点保存(遍历所有可点击元素找文案)
  const clicked = await ev(`(function(){
    var want = ['保存','提交','保存为草稿','保存新增','保存并提交'];
    var els = document.querySelectorAll('button, [role="button"], .el-button, .as-side-btn, [class*="btn"]');
    for (var i=0;i<els.length;i++){
      var t=(els[i].innerText||'').trim();
      if (want.indexOf(t) >= 0) { els[i].click(); return t + '@' + (els[i].className||''); }
    }
    return 'no-save';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(1500)
  console.log('AFTER-1.5s ' + await ev(state))
  await shot('_verify-blink.png')
  await sleep(2500)
  console.log('AFTER-4s ' + await ev(state))
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
