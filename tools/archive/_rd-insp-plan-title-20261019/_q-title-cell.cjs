/** _q-title-cell.cjs — 验证「出货检验计划表」大标题格已变成可填输入框(2026-10-19)
 *  列表页打开单据 → 看 .rs-topic-cell 里是否有 input(修前是静态 span) + 校验失败能否高亮定位。
 *  用法(仓库根):node tools/archive/_rd-insp-plan-title-20261019/_q-title-cell.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9484
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const probe = `(function(){
  var cell = document.querySelector('.rs-topic-cell');
  var inp = cell ? cell.querySelector('input, textarea') : null;
  var span = cell ? cell.querySelector('span.rs-topic') : null;
  return JSON.stringify({
    hasCell: !!cell,
    hasInput: !!inp,
    placeholder: inp ? inp.placeholder : null,
    value: inp ? inp.value : (span ? span.innerText : null),
    isStdic: !!span,
    focusEls: document.querySelectorAll('.rs-focus').length
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_titleCell'), 'about:blank'], { stdio: 'ignore', detached: true })
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

  await ev('location.hash = "#/panelx/list/RD_INSP_PLAN"'); await sleep(8000)
  console.log('LIST ' + await ev(probe))
  await shot('_list-title.png')

  // 找保存按钮(列表页草稿内联编辑,右侧栏)
  const btns = await ev(`JSON.stringify(Array.prototype.map.call(document.querySelectorAll('button, [role="button"], .el-button'), function(b){ return (b.innerText||'').trim() }).filter(Boolean).slice(0, 30))`)
  console.log('BTNS ' + btns)

  // 清空大标题 → 点「保存」→ 期望:提示「标题不能为空」+ 大标题格高亮(rs-focus)
  await ev(`(function(){
    var inp = document.querySelector('.rs-topic-cell input');
    if (inp) { inp.value=''; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); }
    return 'cleared';
  })()`)
  await sleep(600)
  const clicked = await ev(`(function(){
    var bs = document.querySelectorAll('button, [role="button"], .el-button, .as-side-btn');
    for (var i=0;i<bs.length;i++){ if ((bs[i].innerText||'').trim() === '保存'){ bs[i].click(); return 'clicked-保存' } }
    return 'no-save';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(1200)
  console.log('AFTER ' + await ev(`(function(){
    var msgs = Array.prototype.map.call(document.querySelectorAll('.el-message__content, .el-message'), function(e){ return (e.innerText||'').trim() }).filter(Boolean);
    return JSON.stringify({
      messages: msgs.slice(-2),
      topicFocus: !!document.querySelector('.rs-topic-cell.rs-focus'),
      anyFocus: document.querySelectorAll('.rs-focus').length,
      anyBlink: document.querySelectorAll('.field-blink').length
    });
  })()`))
  await shot('_save-empty.png')
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
