/**
 * _q-wlbom-import.cjs — 活体验证「物料清单 · 新增数据下拉 → 导入商品数据」(2026-10-21)
 *
 * 验证点:
 *   ① WLBOM 明细页签的「新增数据」变成**下拉**,菜单两项 = 新增数据 / 导入商品数据
 *   ② 点「导入商品数据」开出弹窗,列出商品档案(INV):勾选列 + 存货编码/存货名称/规格型号/计量单位
 *   ③ 关键字筛选生效(按存货编码/名称)
 *   ④ 勾选两行 → 确定 → 明细行增加,且字段映射正确
 *      (子件代码←存货编码 / 子件名称←存货名称 / 规格型号←规格型号 / 子件单位←计量单位 / 标准用量=1 / 行序递增)
 *   ⑤ **不自动保存**:明细有行,但库里该单没有行(保存要用户点)
 *
 * 账套用 YJ_TEST(HSDZ_MES_TEST)—— 本脚本会**新增一张草稿单**,按两账套纪律不进正式库。
 * 用法:node tools/archive/_wlbom-import-20261021/_q-wlbom-import.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9485
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

/** 明细页签工具栏:是否已变成下拉、下拉菜单项文案 */
const headState = `(function(){
  var ics = Array.prototype.slice.call(document.querySelectorAll('.dt-ics'));
  var out = ics.map(function (d) {
    return {
      txt: d.innerText.trim().replace(/\\s+/g, ' '),
      hasDropdown: !!d.querySelector('.el-dropdown'),
      btn: (d.querySelector('.el-button') || {}).innerText || ''
    };
  });
  var items = Array.prototype.map.call(document.querySelectorAll('.el-dropdown-menu__item'), function (e) { return e.innerText.trim() });
  return JSON.stringify({ ics: out, menuItems: items });
})()`

/** 弹窗状态:标题/行数/首行各列/已选 */
const dlgState = `(function(){
  var d = document.querySelector('.el-dialog');
  if (!d) return JSON.stringify({ open: false });
  var title = (d.querySelector('.el-dialog__title') || {}).innerText || '';
  var tbl = d.querySelector('.el-table');
  var heads = tbl ? Array.prototype.map.call(tbl.querySelectorAll('thead th'), function (t) { return t.innerText.trim() }) : [];
  var bodyRows = tbl ? tbl.querySelectorAll('.el-table__body-wrapper tbody tr') : [];
  var first = bodyRows.length ? Array.prototype.map.call(bodyRows[0].querySelectorAll('td'), function (t) { return t.innerText.trim() }) : [];
  var footBtns = Array.prototype.map.call(d.querySelectorAll('.el-dialog__footer .el-button'), function (b) { return b.innerText.trim() });
  return JSON.stringify({
    open: true, title: title, heads: heads, rowCount: bodyRows.length, first: first,
    selected: (d.querySelector('.pi-sel') || {}).innerText || '',
    total: (d.querySelector('.pi-total') || {}).innerText || '',
    empty: (d.querySelector('.el-table__empty-text') || {}).innerText || '',
    footBtns: footBtns
  });
})()`

/** 明细表头 + 前几行(字段映射证据) */
const detailState = `(function(){
  var blocks = Array.prototype.slice.call(document.querySelectorAll('.detail'));
  var out = [];
  blocks.forEach(function (b) {
    var tbl = b.querySelector('.el-table');
    if (!tbl) return;
    var heads = Array.prototype.map.call(tbl.querySelectorAll('thead th'), function (t) { return t.innerText.trim() }).filter(Boolean);
    var rows = Array.prototype.slice.call(tbl.querySelectorAll('.el-table__body-wrapper tbody tr')).map(function (tr) {
      return Array.prototype.map.call(tr.querySelectorAll('td'), function (t) { return t.innerText.trim() });
    });
    out.push({ heads: heads, rowCount: rows.length, rows: rows.slice(0, 4) });
  });
  var msg = Array.prototype.map.call(document.querySelectorAll('.el-message'), function (m) { return m.innerText.trim() });
  return JSON.stringify({ blocks: out, msg: msg });
})()`

async function main() {
  // 账套 = 测试库(YJ_TEST → HSDZ_MES_TEST):本脚本会新增草稿单,按两账套纪律不进正式库
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const lj = await lr.json()
  if (!lj || !lj.data || !lj.data.token) { console.error('LOGIN FAIL ' + JSON.stringify(lj).slice(0, 300)); process.exit(1) }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_wlbomimp'), 'about:blank'], { stdio: 'ignore', detached: true })
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
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 250))
  })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(9000)

  // ① 打开物料清单面板
  await ev('location.hash = "#/panelx/list/WLBOM"'); await sleep(6000)
  console.log('TOOLBAR ' + await ev('JSON.stringify(Array.prototype.map.call(document.querySelectorAll(".act-name"),function(e){return e.innerText.trim()}))'))
  await shot('_wlbom-panel.png')

  // ② 工具栏「新增」(建一张草稿单,才进入可编辑态)
  const added = await ev(`(function(){
    var sp = Array.prototype.slice.call(document.querySelectorAll('.act-name')).find(function(b){ return b.innerText.trim() === '新增' });
    if (!sp) return 'no-add-btn';
    (sp.closest('button') || sp.parentElement || sp).click();
    return 'clicked';
  })()`)
  console.log('ADD ' + added)
  await sleep(5000)
  console.log('NEWDOC ' + await ev('JSON.stringify(Array.prototype.map.call(document.querySelectorAll(".el-message"),function(m){return m.innerText.trim()}))'))
  console.log('HEAD ' + await ev(headState))
  await shot('_wlbom-newdoc.png')

  // ③ 点「新增数据」→ 应出下拉(两项)
  const opened = await ev(`(function(){
    var d = document.querySelector('.dt-ics .el-dropdown');
    var btn = document.querySelector('.dt-ics .el-button');
    if (!btn) return 'no-btn:' + document.querySelectorAll('.dt-ics').length;
    (btn || d).click();
    return 'clicked:' + (d ? 'dropdown' : 'plain');
  })()`)
  console.log('DROPDOWN ' + opened)
  await sleep(1200)
  console.log('MENU ' + await ev(headState))
  await shot('_wlbom-dropdown.png')

  // ③b 下拉第一项「新增数据」仍然管用(不能为了加导入把原来的加行弄坏)
  console.log('BEFORE-ADD ' + await ev(detailState))
  const addRow = await ev(`(function(){
    var it = Array.prototype.slice.call(document.querySelectorAll('.el-dropdown-menu__item')).find(function(e){ return e.innerText.trim() === '新增数据' });
    if (!it) return 'no-menu-item';
    it.click();
    return 'clicked';
  })()`)
  await sleep(1200)
  console.log('AFTER-ADD ' + addRow + ' ' + await ev(detailState))

  // ④ 点「导入商品数据」
  const toImp = await ev(`(function(){
    var it = Array.prototype.slice.call(document.querySelectorAll('.el-dropdown-menu__item')).find(function(e){ return e.innerText.trim() === '导入商品数据' });
    if (!it) return 'no-menu-item';
    it.click();
    return 'clicked';
  })()`)
  console.log('OPEN-IMPORT ' + toImp)
  await sleep(9000)                              // 商品档案全量 3,917 行,首次要拉一次(约 4 MB)
  console.log('DIALOG ' + await ev(dlgState))
  await shot('_wlbom-dialog.png')

  // ⑤ 关键字筛选(按存货编码)
  const typed = await ev(`(function(){
    var inp = document.querySelector('.pi-key input');
    if (!inp) return 'no-input';
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'M-00');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`)
  console.log('FILTER ' + typed)
  await sleep(1200)
  console.log('FILTERED ' + await ev(dlgState))
  await shot('_wlbom-filter.png')

  // ⑥ 勾选前两行
  const picked = await ev(`(function(){
    var d = document.querySelector('.el-dialog');
    var cbs = Array.prototype.slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr .el-checkbox'));
    if (!cbs.length) return 'no-checkbox';
    cbs.slice(0, 2).forEach(function (c) { c.click() });
    return 'picked:' + cbs.length;
  })()`)
  console.log('PICK ' + picked)
  await sleep(800)
  console.log('PICKED ' + await ev(dlgState))
  await shot('_wlbom-picked.png')
  // 勾选行原值(便于和明细对照)
  console.log('PICKED-ROWS ' + await ev(`(function(){
    var d = document.querySelector('.el-dialog');
    var rows = Array.prototype.slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr'));
    var out = rows.filter(function(tr){ return tr.querySelector('.el-checkbox.is-checked') }).map(function(tr){
      return Array.prototype.map.call(tr.querySelectorAll('td'), function(t){ return t.innerText.trim() });
    });
    return JSON.stringify(out);
  })()`))

  // ⑦ 确定 → 明细追加
  const confirmed = await ev(`(function(){
    var d = document.querySelector('.el-dialog');
    var btns = Array.prototype.slice.call(d.querySelectorAll('.el-dialog__footer .el-button'));
    var b = btns.find(function(x){ return x.innerText.indexOf('确定') >= 0 });
    if (!b) return 'no-confirm';
    b.click();
    return 'confirmed';
  })()`)
  console.log('CONFIRM ' + confirmed)
  await sleep(2500)
  console.log('DETAIL ' + await ev(detailState))
  await shot('_wlbom-imported.png')

  // ⑦b 再导一次同样的两行 ⇒ 判重:不重复加,只提示(明细行数不变)
  await ev(`(function(){
    var btn = document.querySelector('.dt-ics .el-button'); if (btn) btn.click(); return 'ok';
  })()`)
  await sleep(900)
  await ev(`(function(){
    var it = Array.prototype.slice.call(document.querySelectorAll('.el-dropdown-menu__item')).find(function(e){ return e.innerText.trim() === '导入商品数据' });
    if (it) it.click(); return 'ok';
  })()`)
  await sleep(4000)
  await ev(`(function(){
    var inp = document.querySelector('.pi-key input');
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'M-00'); inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`)
  await sleep(1000)
  await ev(`(function(){
    var d = document.querySelector('.el-dialog');
    var cbs = Array.prototype.slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr .el-checkbox'));
    cbs.slice(0, 2).forEach(function (c) { c.click() });
    return 'ok';
  })()`)
  await sleep(600)
  await ev(`(function(){
    var d = document.querySelector('.el-dialog');
    var b = Array.prototype.slice.call(d.querySelectorAll('.el-dialog__footer .el-button')).find(function(x){ return x.innerText.indexOf('确定') >= 0 });
    if (b) b.click(); return 'ok';
  })()`)
  await sleep(1800)
  console.log('DUP-AGAIN ' + await ev(detailState))
  await shot('_wlbom-dup.png')

  // ⑧ 窄屏复核(768 / 375):弹窗宽度写的是 min(920px, 94vw),不能横向溢出
  for (const [w, h, name] of [[768, 900, '_wlbom-dialog-768.png'], [375, 812, '_wlbom-dialog-375.png']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
    await sleep(600)
    await ev(`(function(){
      var btn = document.querySelector('.dt-ics .el-button');
      if (btn) btn.click();
      return 'ok';
    })()`)
    await sleep(700)
    await ev(`(function(){
      var it = Array.prototype.slice.call(document.querySelectorAll('.el-dropdown-menu__item')).find(function(e){ return e.innerText.trim() === '导入商品数据' });
      if (it) it.click();
      return 'ok';
    })()`)
    await sleep(3000)
    console.log('NARROW-' + w + ' ' + await ev(`(function(){
      var d = document.querySelector('.el-dialog');
      if (!d) return JSON.stringify({open:false});
      var r = d.getBoundingClientRect();
      return JSON.stringify({ open:true, w: Math.round(r.width), left: Math.round(r.left),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth });
    })()`))
    await shot(name)
    // 关掉弹窗,回到面板
    await ev(`(function(){
      var d = document.querySelector('.el-dialog');
      var btns = d ? Array.prototype.slice.call(d.querySelectorAll('.el-dialog__footer .el-button')) : [];
      var c = btns.find(function(x){ return x.innerText.indexOf('取消') >= 0 });
      if (c) c.click();
      return 'closed';
    })()`)
    await sleep(500)
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  // ⑨ 回归:非白名单面板的「新增数据」必须还是**原来的按钮**,不能跟着变下拉
  for (const pc of ['INV', 'FINISH_IN', 'MANU_ORDER']) {
    await ev('location.hash = "#/panelx/list/' + pc + '"'); await sleep(7000)
    console.log('OTHER-' + pc + ' ' + await ev(headState))
    await shot('_wlbom-other-' + pc + '.png')
  }

  // ⑩ 英文界面复核(AGENTS 多语言强制):新 UI 文案必须走 en.js,biz 段没有的键会走机翻兜底
  await ev('localStorage.setItem("mes_locale","en")')
  await send('Page.reload'); await sleep(9000)
  await ev('location.hash = "#/panelx/list/WLBOM"'); await sleep(7000)
  console.log('EN-HEAD ' + await ev(headState))
  await ev(`(function(){
    var btn = document.querySelector('.dt-ics .el-button'); if (btn) btn.click(); return 'ok';
  })()`)
  await sleep(900)
  await ev(`(function(){
    var it = Array.prototype.slice.call(document.querySelectorAll('.el-dropdown-menu__item')).find(function(e){ return /Import Items/.test(e.innerText) });
    if (it) { it.click(); return 'ok' } return 'no-item';
  })()`)
  await sleep(6000)
  console.log('EN-DIALOG ' + await ev(`(function(){
    var d = document.querySelector('.el-dialog'); if (!d) return JSON.stringify({open:false});
    var tbl = d.querySelector('.el-table');
    return JSON.stringify({
      title: (d.querySelector('.el-dialog__title')||{}).innerText||'',
      tip: (d.querySelector('.pi-tip')||{}).innerText||'',
      sel: (d.querySelector('.pi-sel')||{}).innerText||'',
      heads: tbl ? Array.prototype.map.call(tbl.querySelectorAll('thead th'), function(t){return t.innerText.trim()}) : [],
      foot: Array.prototype.map.call(d.querySelectorAll('.el-dialog__footer .el-button'), function(b){return b.innerText.trim()}),
      hasChinese: /[\\u4e00-\\u9fa5]/.test(d.innerText)
    });
  })()`))
  await shot('_wlbom-dialog-en.png')
  await ev('localStorage.setItem("mes_locale","zh-CN")')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 4)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
