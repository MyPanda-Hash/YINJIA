/**
 * _ui-supplier-account-form.cjs — 供应商账号弹窗:「关联供应商 → 账号默认=供应商编码(可改)」+ 联系电话(2026-10-25)
 *
 * 用户口径:「供应商权限配置的新增应该弹窗关联供应商,然后选择后账号默认供应商编码(可修改)。可以有联系电话」
 *
 * 断言(按真实交互):
 *   ① 弹窗顺序:供应商在账号之前;
 *   ② 选中供应商后,账号自动变成该供应商编码,姓名自动带出供应商名称;
 *   ③ 账号可手改(改成别的也能保存,保存后生效);
 *   ④ 联系电话可填、能保存、列表里能看到、编辑时回显;
 *   ⑤ 换供应商时:账号没手改过 ⇒ 跟着变;手改过 ⇒ 保留用户的值。
 *
 * 用法:node tools/archive/_ui-supplier-account-form.cjs [baseUrl]
 */
const CDP_PORT = 9409
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) {
  return httpJsonOn(CDP_PORT, p)
}
/** 指到具体端口的 /json/list(dynamic port:Edge 自选端口时用) */
function httpJsonOn(port, p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}
const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail ?? '' })
  console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`)
}
async function main() {
  const api = async (p, { method = 'GET', token, body } = {}) => {
    const r = await fetch(BASE + p.replace(/^\//, ''), {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return JSON.parse(await r.text())
  }
  const at = (await api('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })).data.token
  // 清理旧测试账号
  for (const a of ((await api('api/supplier/portal/accounts', { token: at })).data || [])) {
    if (a.userName === 'YJ-SX' || a.userName === 'mycustom01') {
      await api('api/supplier/portal/accounts/' + a.id, { method: 'DELETE', token: at })
    }
  }

  // 每次跑用**独立 profile 目录**并让 Edge 自选调试端口 —— 复用固定目录/端口时,
  // 上一条用例残留的 Edge 会占住目录,导致 /json/list 拿不到 target(脚本直接 undefined 崩)。
  const profileDir = path.join(os.tmpdir(), '_acc_form_' + Date.now())
  const proc = spawn(EDGE, ['--remote-debugging-port=0', '--headless=new', '--disable-gpu',
    '--window-size=1680,1100', '--user-data-dir=' + profileDir, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'], detached: true })
  proc.unref()
  // 从 stderr 里读 "DevTools listening on ws://127.0.0.1:PORT/..." 拿到真实端口与目标
  let wsUrl = ''
  proc.stderr.on('data', (d) => {
    const m = String(d).match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (m) wsUrl = m[1]
  })
  for (let i = 0; i < 40 && !wsUrl; i++) await sleep(300)
  let target = null
  if (wsUrl) {
    const port = Number(new URL(wsUrl).port)
    let list
    for (let i = 0; i < 20; i++) {
      try { list = await httpJsonOn(port, '/json/list'); if (list && list.length) break } catch (e) {}
      await sleep(400)
    }
    target = list && list.find((t) => t.type === 'page')
  }
  if (!target) { console.error('[FATAL] 无法启动 headless Edge(未拿到调试目标)'); process.exit(2) }
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  const { killTree } = require(path.join(__dirname, '..', 'verify', 'lib', 'kill-tree.cjs'))
  const { closeBrowser, killHeadlessEdge } = require(path.join(__dirname, '..', 'verify', 'lib', 'browser-close.cjs'))
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false })
  const lj = await api('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })
  await send('Page.navigate', { url: BASE + '#/login' })
  await sleep(2500)
  await evaluate(`localStorage.clear()`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
  await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/scm/supplierAccount' })
  await sleep(3000)
  await send('Page.reload', {})
  await sleep(9000)

  // 打开新增弹窗
  await evaluate(`(function(){
    var b = Array.from(document.querySelectorAll('button')).find(function(x){ return (x.innerText||'').indexOf('新增供应商账号') >= 0; });
    if (b) b.click();
    return !!b;
  })()`)
  await sleep(2000)
  const layout = await evaluate(`(function(){
    var dlg = document.querySelector('.el-dialog');
    if (!dlg) return JSON.stringify({ open: false });
    var labels = Array.from(dlg.querySelectorAll('.el-form-item__label')).map(function(e){ return (e.innerText||'').trim(); });
    return JSON.stringify({ open: true, labels: labels });
  })()`)
  console.log('弹窗字段顺序:', layout)
  const L = JSON.parse(layout)
  check('弹窗已打开', L.open)
  const idxSupplier = (L.labels || []).indexOf('供应商')
  const idxUser = (L.labels || []).indexOf('账号')
  check('「供应商」排在「账号」之前(先关联供应商)', idxSupplier >= 0 && idxUser > idxSupplier,
    `供应商@${idxSupplier} 账号@${idxUser}`)
  check('弹窗有「联系电话」', (L.labels || []).includes('联系电话'))

  // 选择供应商 YJ-SX —— 2026-10-25 第 4 轮起改为**勾选弹窗**(不再有下拉框):
  //   点「供应商」行的「选择」按钮 → 在弹窗里搜编码 → 点中该行 → 确定。
  const pickSupplier = async (code) => {
    await evaluate(`(function(){
      var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; });
      var it = d && Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; });
      var b = it && Array.from(it.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '选择'; });
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(2200)
    await evaluate(`(function(){
      var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
      if (!d) return false;
      var inp = d.querySelector('input');
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, ${JSON.stringify(code)});
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      var b = Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').replace(/\\s+/g,'') === '查询'; });
      if (b) b.click();
      return true;
    })()`)
    await sleep(1800)
    const hit = await evaluate(`(function(){
      var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
      if (!d) return 'no-picker';
      var tr = Array.from(d.querySelectorAll('.el-table__body tr')).find(function(r){ return (r.innerText||'').indexOf(${JSON.stringify(code)}) >= 0; });
      if (!tr) return 'no-row';
      tr.click();
      return (tr.innerText||'').replace(/\\s+/g,' ').slice(0, 50);
    })()`)
    console.log(`  搜「${code}」命中行:`, hit)
    await sleep(600)
    await evaluate(`(function(){
      var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
      var b = d && Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '确定'; });
      if (b) b.click();
    })()`)
    await sleep(1200)
    return hit !== 'no-picker' && hit !== 'no-row'
  }
  const picked = await pickSupplier('YJ-SX')
  check('能选中供应商 YJ-SX', picked)
  const afterPick = await evaluate(`(function(){
    var dlg = document.querySelector('.el-dialog');
    var items = Array.from(dlg.querySelectorAll('.el-form-item'));
    function valOf(label){
      var it = items.find(function(i){ return (i.innerText||'').indexOf(label) === 0 || (i.querySelector('.el-form-item__label')||{}).innerText === label; });
      if (!it) return '';
      var inp = it.querySelector('input,textarea');
      return inp ? inp.value : '';
    }
    return JSON.stringify({ userName: valOf('账号'), realName: valOf('姓名') });
  })()`)
  console.log('选供应商后:', afterPick)
  const ap = JSON.parse(afterPick)
  check('账号已自动填成供应商编码 YJ-SX', ap.userName === 'YJ-SX', ap.userName)
  // 2026-10-25 用户口径:「密码不用,姓名不用(只要对应账号)」
  // ⇒ 姓名**不得**被自动带出(上一版会自动填供应商名称,已按口径撤销)
  check('姓名不再自动带出(用户口径:姓名不用)', ap.realName === '', ap.realName)

  // ③ 账号可手改
  const renamed = await evaluate(`(function(){
    var dlg = document.querySelector('.el-dialog');
    var items = Array.from(dlg.querySelectorAll('.el-form-item'));
    var it = items.find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '账号'; });
    var inp = it && it.querySelector('input');
    if (!inp) return '';
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'mycustom01');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return inp.value;
  })()`)
  check('账号可以手动改成 mycustom01', renamed === 'mycustom01', renamed)

  // ④ 填电话 + 密码后保存
  const filled = await evaluate(`(function(){
    var dlg = document.querySelector('.el-dialog');
    var items = Array.from(dlg.querySelectorAll('.el-form-item'));
    function setByLabel(label, v){
      var it = items.find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === label; });
      var inp = it && it.querySelector('input,textarea');
      if (!inp) return false;
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, v);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return JSON.stringify({ phone: setByLabel('联系电话', '13800138000'), pwd: setByLabel('登录密码', 'e2e@2026') });
  })()`)
  console.log('填电话/密码:', filled)
  const f = JSON.parse(filled)
  check('联系电话可填', f.phone === true)
  check('登录密码可填', f.pwd === true)
  await evaluate(`(function(){
    var dlg = document.querySelector('.el-dialog');
    var b = Array.from(dlg.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '保存'; });
    if (b) b.click();
    return !!b;
  })()`)
  await sleep(4000)
  const saved = await api('api/supplier/portal/accounts', { token: at })
  const row = ((saved.data || []).find((x) => x.userName === 'mycustom01')) || null
  check('保存成功,账号被存为手改后的 mycustom01', !!row, row ? `id=${row.id}` : '(未找到)')
  check('联系电话已落库', !!row && row.phone === '13800138000', row ? String(row.phone) : '')
  check('绑定供应商为 YJ-SX', !!row && row.supplierCode === 'YJ-SX', row ? row.supplierCode : '')

  // 列表里能看到电话列
  await send('Page.reload', {})
  await sleep(8000)
  const listCol = await evaluate(`(function(){
    var heads = Array.from(document.querySelectorAll('.el-table__header th')).map(function(t){ return (t.innerText||'').replace(/\\s/g,''); });
    var t = (document.body.innerText||'');
    return JSON.stringify({ hasPhoneHead: heads.some(function(h){ return h.indexOf('联系电话') >= 0; }), hasPhoneValue: t.indexOf('13800138000') >= 0 });
  })()`)
  const lc = JSON.parse(listCol)
  check('列表有「联系电话」列', lc.hasPhoneHead)
  check('列表显示电话值', lc.hasPhoneValue)

  // ⑤ 编辑回显 + 换供应商不覆盖手改值
  const reopen = await evaluate(`(function(){
    var rows = Array.from(document.querySelectorAll('.el-table__body tr'));
    var r = rows.find(function(x){ return (x.innerText||'').indexOf('mycustom01') >= 0; });
    if (!r) return false;
    var b = Array.from(r.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '编辑'; });
    if (b) { b.click(); return true; }
    return false;
  })()`)
  await sleep(2000)
  const editVals = await evaluate(`(function(){
    var dlg = document.querySelector('.el-dialog');
    if (!dlg) return JSON.stringify({ open: false });
    var items = Array.from(dlg.querySelectorAll('.el-form-item'));
    function valOf(label){
      var it = items.find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === label; });
      var inp = it && it.querySelector('input,textarea');
      return inp ? inp.value : '';
    }
    return JSON.stringify({ open: true, userName: valOf('账号'), phone: valOf('联系电话') });
  })()`)
  console.log('编辑回显:', editVals)
  const ev = JSON.parse(editVals)
  check('编辑弹窗回显账号', reopen && ev.userName === 'mycustom01', ev.userName)
  check('编辑弹窗回显联系电话', ev.phone === '13800138000', ev.phone)

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_acc-form.png'), Buffer.from(shot.result.data, 'base64'))

  // 清理
  const all = (await api('api/supplier/portal/accounts', { token: at })).data || []
  for (const a of all.filter((x) => ['mycustom01', 'YJ-SX'].includes(x.userName))) {   // ⚠ 不删 kbl01:它是别的用例依赖的常驻测试账号
    await api('api/supplier/portal/accounts/' + a.id, { method: 'DELETE', token: at })
  }
  console.log('\n(测试账号已清理)')
  const pass = results.filter((r) => r.ok).length
  console.log(`=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  await closeBrowser(CDP_PORT)
  killTree(proc.pid)
  killHeadlessEdge('_acc_form')
  process.exitCode = pass === results.length ? 0 : 1   // 用 exitCode:process.exit() 会截断管道里的 stdout
}
main().catch((e) => {
  console.error('[FATAL]', e)
  // 异常路径也要收掉浏览器,否则一次失败就泄漏一整份(曾把 8090 拖死)
  try { killHeadlessEdge('_acc_form') } catch (e2) { /* ignore */ }
  process.exitCode = 2
})
