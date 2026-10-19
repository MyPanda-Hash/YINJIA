/** _q-edit-save.cjs — 编辑态复现「标题不能为空」(2026-10-19)
 *  单据 IP-2026-10-0001(标题 null)。打开编辑 → 填标题 → 点保存 → 抓实际报错文案。
 *  用法(仓库根):node tools/archive/_rd-insp-plan-title-20261019/_q-edit-save.cjs [code] [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const CODE = process.argv[2] || 'IP-2026-10-0001'
const PORT = process.argv[3] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9482
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const snap = `(function(){
  var msgs = Array.prototype.map.call(document.querySelectorAll('.el-message, .el-message__content'), function(e){ return (e.innerText||'').trim() }).filter(Boolean);
  var fields = [];
  document.querySelectorAll('.fields .field').forEach(function(f){
    var lb = f.querySelector('label'); if (!lb) return;
    var nm = (lb.innerText||'').trim().replace('*','').trim();
    var inp = f.querySelector('input,textarea');
    fields.push({ n: nm, req: !!lb.querySelector('.req'), v: inp ? inp.value : null });
  });
  var formTitle = null, formKeys = null;
  try {
    var el = document.querySelector('.fields');
    var inst = el && (el.__vueParentComponent || el.parentElement.__vueParentComponent);
    var d = 0;
    while (inst && d < 20) {
      var ss = inst.setupState || {};
      var fv = ss.form && ss.form.value !== undefined ? ss.form.value : ss.form;
      if (fv && typeof fv === 'object') { formTitle = fv['标题']; formKeys = Object.keys(fv).filter(function(k){return /标题/.test(k)}); break; }
      inst = inst.parent; d++;
    }
  } catch(e) { formTitle = 'ERR:' + e.message; }
  return JSON.stringify({ messages: msgs.slice(-3), fieldCount: fields.length, titleFields: fields.filter(function(f){return f.n==='标题'}), emptyRequired: fields.filter(function(f){ return f.req && (!f.v || !String(f.v).trim()) }).map(function(f){return f.n}), formTitle: formTitle, formKeys: formKeys });
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_editSave'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  console.log('EDIT ' + await ev(snap))
  await shot('_edit-open.png')

  // 填标题 + 审核人(截图里用户填了冯加劲)
  await ev(`(function(){
    document.querySelectorAll('.fields .field').forEach(function(f){
      var lb = f.querySelector('label'); if (!lb) return;
      var nm = (lb.innerText||'').trim().replace('*','').trim();
      if (nm !== '标题') return;
      var inp = f.querySelector('input,textarea');
      if (inp && !inp.disabled) {
        inp.value = 'cs1';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    return 'ok';
  })()`)
  await sleep(1000)
  console.log('FILLED ' + await ev(snap))

  // 点保存
  console.log('BUTTONS ' + await ev(`JSON.stringify(Array.prototype.map.call(document.querySelectorAll('button, .el-button, .btn'), function(b){ return (b.innerText||'').trim() }).filter(Boolean).slice(0, 40))`))
  const clicked = await ev(`(function(){
    var want = ['保存','提交','保存为草稿','保存新增'];
    var bs = document.querySelectorAll('button');
    for (var i=0;i<bs.length;i++){ var t=(bs[i].innerText||'').trim(); if (want.indexOf(t) >= 0){ bs[i].click(); return t } }
    return 'no-save-btn';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(4000)
  console.log('AFTER-SAVE ' + await ev(snap))
  await shot('_edit-saved.png')
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
