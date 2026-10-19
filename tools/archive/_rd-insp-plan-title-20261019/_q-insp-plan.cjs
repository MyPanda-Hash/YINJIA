/** _q-insp-plan.cjs — 复现「出货检验计划表 标题不能为空」(2026-10-19)
 *  RD_INSP_PLAN 有两个「标题」字段(query seq=10 required=0 / header seq=40 required=1),code 都是 '标题'。
 *  探针:打开表单 → 数「标题」输入框 → 读写绑定值 → 填内容保存看报错。
 *  用法(仓库根):node tools/archive/_rd-insp-plan-title-20261019/_q-insp-plan.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9481
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

// 找所有 label 文本为「标题」的 field,读它的 div/input 状态
const inspect = `(function(){
  var out = [];
  var fields = document.querySelectorAll('.fields .field');
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var lb = f.querySelector('label');
    var name = lb ? (lb.innerText || '').trim().replace('*','').trim() : '';
    if (name !== '标题') continue;
    var inp = f.querySelector('input, textarea');
    out.push({
      name: name,
      req: !!(lb && lb.querySelector('.req')),
      hasInput: !!inp,
      value: inp ? inp.value : null,
      disabled: inp ? inp.disabled : null,
      html: f.outerHTML.slice(0, 160)
    });
  }
  // 从 Vue 实例读 form['标题']
  var formTitle = null;
  try {
    var el = document.querySelector('.fields');
    var inst = el && (el.__vueParentComponent || el.parentElement.__vueParentComponent);
    var d = 0;
    while (inst && d < 20) {
      var ss = inst.setupState || {};
      if (ss.form && ss.form.value !== undefined) { formTitle = ss.form.value['标题']; break; }
      if (ss.form && typeof ss.form === 'object' && '标题' in ss.form) { formTitle = ss.form['标题']; break; }
      inst = inst.parent; d++;
    }
  } catch (e) { formTitle = 'ERR:' + e.message; }
  return JSON.stringify({ titleFields: out.length, fields: out, formTitle: formTitle });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_inspplan'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []; const warns = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 200))
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'warning') {
      warns.push(m.params.args.map((a) => String(a.value || a.description || '')).join(' ').slice(0, 180))
    }
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

  console.log('--- 打开出货检验计划表 新增表单 ---')
  await ev('location.hash = "#/panelx/form/RD_INSP_PLAN"')
  await sleep(6000)
  console.log('STATE1 ' + await ev(inspect))
  await shot('_form-new.png')

  // 往「标题」输入框打字(模拟用户),再看 form 里的值
  const typed = await ev(`(function(){
    var fields = document.querySelectorAll('.fields .field');
    var hits = [];
    for (var i = 0; i < fields.length; i++) {
      var lb = fields[i].querySelector('label');
      if (!lb) continue;
      if ((lb.innerText||'').trim().replace('*','').trim() !== '标题') continue;
      var inp = fields[i].querySelector('input');
      hits.push({ hasInput: !!inp, disabled: inp ? inp.disabled : null });
      if (inp && !inp.disabled) {
        inp.value = 'cs1';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return JSON.stringify(hits);
  })()`)
  console.log('TYPE ' + typed)
  await sleep(1500)
  console.log('STATE2 ' + await ev(inspect))
  console.log('WARNS ' + JSON.stringify(warns.filter((w) => /key|duplicate/i.test(w)).slice(0, 3)))
  await shot('_form-typed.png')
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
