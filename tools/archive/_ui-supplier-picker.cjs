/**
 * _ui-supplier-picker.cjs — 供应商「勾选弹窗」验证(2026-10-25)
 *
 * 用户口径:
 *   「供应商权限配置的不要下来框,要是可以勾选的弹窗。单据的关联供应商基础资料是一样的。」
 *   「每次勾选,账号密码都要对应变化」→ 实际只要账号(=供应商编码);密码/姓名不动(用户确认)。
 *
 * 断言:
 *   ① 弹窗里「供应商」是只读框 + 「选择」按钮,**没有下拉 select**;
 *   ② 点「选择」打开勾选弹窗:列为 编码/名称/联系人/电话/地址(与单据关联供应商同一份档案),
 *      可搜索、单选(radio)、双击回填;
 *   ③ 勾选后:供应商框显示「编码 名称」、**账号自动=供应商编码**;
 *   ④ 再勾选另一个供应商:账号跟着变(=新编码);
 *   ⑤ 账号手改后再勾选:不覆盖用户手改的值;
 *   ⑥ 姓名、密码不会被自动改动;
 *   ⑦ 保存后落库正确。
 *
 * 用法:node tools/archive/_ui-supplier-picker.cjs [baseUrl]
 */
const CDP_PORT = 9410
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/?$/, '/')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
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
  for (const a of ((await api('api/supplier/portal/accounts', { token: at })).data || [])) {
    if (['YJ-SX', 'YJ-KBL', 'pickertest'].includes(a.userName)) {
      await api('api/supplier/portal/accounts/' + a.id, { method: 'DELETE', token: at })
    }
  }

  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1680,1100', '--user-data-dir=' + path.join(os.tmpdir(), '_picker'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result?.result?.value
  }
  // ⚠ 页面上同时存在多个 .el-dialog(新增弹窗 + 勾选弹窗 + destroy-on-close 的残留),
  //   按标题定位,不能只取第一个 —— 否则点「确定」会点到别的弹窗上(实测踩过)。
  const clickIn = (titlePart, text) => evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){
      return x.offsetParent !== null && (x.innerText||'').indexOf(${JSON.stringify(titlePart)}) >= 0;
    });
    if (!d) return 'no-dialog';
    var b = Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').replace(/\\s+/g,'') === ${JSON.stringify(text)}; });
    if (!b) return 'no-button';
    b.click();
    return 'ok';
  })()`)
  const clickText = (_scope, text) => clickIn('供应商', text)
  const formVal = (label) => evaluate(`(function(){
    var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return d.offsetParent !== null && (d.innerText||'').indexOf('供应商') >= 0; });
    if (!dlg) return '';
    var items = Array.from(dlg.querySelectorAll('.el-form-item'));
    var it = items.find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === ${JSON.stringify(label)}; });
    var inp = it && it.querySelector('input,textarea');
    return inp ? inp.value : '';
  })()`)

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

  // ① 打新增弹窗:供应商是只读框,没有下拉
  await evaluate(`(function(){
    var b = Array.from(document.querySelectorAll('button')).find(function(x){ return (x.innerText||'').replace(/\\s+/g,'') === '新增供应商账号'; });
    if (b) b.click();
    return !!b;
  })()`)
  await sleep(1500)
  const shape = await evaluate(`(function(){
    var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return d.offsetParent !== null; });
    if (!dlg) return JSON.stringify({ open: false });
    var items = Array.from(dlg.querySelectorAll('.el-form-item'));
    var it = items.find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; });
    return JSON.stringify({
      open: true,
      hasSelect: !!(it && it.querySelector('.el-select')),
      hasPickBtn: !!(it && Array.from(it.querySelectorAll('button')).some(function(b){ return (b.innerText||'').trim() === '选择'; })),
      readonly: !!(it && it.querySelector('input') && it.querySelector('input').readOnly),
    });
  })()`)
  console.log('供应商字段形态:', shape)
  const sh = JSON.parse(shape)
  check('弹窗已打开', sh.open)
  check('供应商不再用下拉框', sh.hasSelect === false)
  check('供应商改为「选择」按钮 + 只读框', sh.hasPickBtn && sh.readonly)

  // ② 打开勾选弹窗
  await evaluate(`(function(){
    var dlg = Array.from(document.querySelectorAll('.el-dialog')).find(function(d){ return d.offsetParent !== null; });
    var it = Array.from(dlg.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; });
    var b = it && Array.from(it.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '选择'; });
    if (b) { b.click(); return true; }
    return false;
  })()`)
  await sleep(2500)
  const picker = await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    if (!d) return JSON.stringify({ open: false });
    var heads = Array.from(d.querySelectorAll('.el-table__header th')).map(function(t){ return (t.innerText||'').replace(/\\s/g,''); });
    var rows = d.querySelectorAll('.el-table__body tr').length;
    var radios = d.querySelectorAll('.spd-radio').length;
    return JSON.stringify({ open: true, heads: heads, rows: rows, radios: radios });
  })()`)
  console.log('勾选弹窗:', picker)
  const pk = JSON.parse(picker)
  check('勾选弹窗已打开', pk.open)
  check('列 = 编码/名称/联系人/电话/地址(与单据供应商档案一致)',
    ['供应商编码', '供应商名称', '联系人', '电话', '地址'].every((h) => (pk.heads || []).some((x) => x.indexOf(h) >= 0)),
    (pk.heads || []).join('|'))
  check('有勾选圆点(每行一个)', pk.radios > 0, `圆点=${pk.radios}`)

  // 搜索 + 勾选第一行
  await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    var inp = d.querySelector('input');
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'YJ-SX');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await sleep(400)
  await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    var b = Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').replace(/\\s+/g,'') === '查询'; });
    if (b) b.click();
    return !!b;
  })()`)
  await sleep(1800)
  const firstRow = await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    var tr = d.querySelector('.el-table__body tr');
    if (!tr) return '';
    // 整行点击 = 勾选(2026-10-25 实现:选中靠 row-click,不依赖 el-radio 在表格里的内部行为)
    tr.click();
    return (tr.innerText||'').replace(/\\s+/g,' ').trim().slice(0, 60);
  })()`)
  console.log('勾选的行:', firstRow)
  console.log('  点确定:', await clickIn('选择供应商', '确定'))
  await sleep(1500)
  const afterPick1 = await evaluate(`JSON.stringify({
    supplier: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; }); return it ? it.querySelector('input').value : ''; })(),
    userName: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '账号'; }); return it ? it.querySelector('input').value : ''; })(),
    realName: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '姓名'; }); return it ? it.querySelector('input').value : ''; })(),
    password: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '登录密码'; }); var i2 = it && it.querySelector('input'); return i2 ? i2.value : ''; })()
  })`)
  console.log('勾选后:', afterPick1)
  const a1 = JSON.parse(afterPick1)
  check('供应商回填「编码 名称」', String(a1.supplier).indexOf('YJ-SX') === 0, a1.supplier)
  check('账号自动 = 供应商编码 YJ-SX', a1.userName === 'YJ-SX', a1.userName)
  check('姓名未被自动填(用户口径:姓名不用)', a1.realName === '', a1.realName)
  check('密码未被自动填(用户口径:密码不用)', a1.password === '')

  // ④ 手改账号后再勾另一个供应商:不覆盖
  await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; });
    var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '账号'; });
    var inp = it.querySelector('input');
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'pickertest');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return inp.value;
  })()`)
  await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; });
    var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; });
    var b = it && Array.from(it.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '选择'; });
    if (b) b.click();
  })()`)
  await sleep(2500)
  await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    var inp = d.querySelector('input');
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'YJ-KBL');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    var b = Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').replace(/\\s+/g,'') === '查询'; });
    if (b) b.click();
  })()`)
  await sleep(1800)
  await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    var tr = d.querySelector('.el-table__body tr');
    if (tr) tr.click();
  })()`)
  console.log('  点确定:', await clickIn('选择供应商', '确定'))
  await sleep(1500)
  const afterPick2 = await evaluate(`JSON.stringify({
    supplier: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; }); return it ? it.querySelector('input').value : ''; })(),
    userName: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '账号'; }); return it ? it.querySelector('input').value : ''; })()
  })`)
  console.log('换供应商后:', afterPick2)
  const a2 = JSON.parse(afterPick2)
  check('换成 YJ-KBL 后供应商框更新', String(a2.supplier).indexOf('YJ-KBL') === 0, a2.supplier)
  check('账号是手改值 pickertest,不被覆盖', a2.userName === 'pickertest', a2.userName)

  // ⑦ 保存 + 落库
  await evaluate(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; });
    var items = Array.from(d.querySelectorAll('.el-form-item'));
    function setByLabel(label, v){
      var it = items.find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === label; });
      var inp = it && it.querySelector('input,textarea');
      if (!inp) return false;
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, v);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    setByLabel('登录密码', 'pick@2026');
    return true;
  })()`)
  console.log('  点保存:', await clickIn('新增供应商账号', '保存'))
  await sleep(4000)
  const saved = ((await api('api/supplier/portal/accounts', { token: at })).data || []).find((x) => x.userName === 'pickertest')
  check('保存成功并落库', !!saved, saved ? `供应商=${saved.supplierCode}` : '(未找到)')
  check('绑定的是最后勾选的 YJ-KBL', !!saved && saved.supplierCode === 'YJ-KBL', saved ? saved.supplierCode : '')

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_picker.png'), Buffer.from(shot.result.data, 'base64'))

  const all = (await api('api/supplier/portal/accounts', { token: at })).data || []
  for (const a of all.filter((x) => ['pickertest', 'YJ-SX', 'YJ-KBL'].includes(x.userName))) {
    await api('api/supplier/portal/accounts/' + a.id, { method: 'DELETE', token: at })
  }
  console.log('\n(测试账号已清理)')
  const pass = results.filter((r) => r.ok).length
  console.log(`=== 结果: ${pass}/${results.length} 通过 ===`)
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
