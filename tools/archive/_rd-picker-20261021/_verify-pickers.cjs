/**
 * _verify-pickers.cjs — 活体验证「引用产品信息表」+「从物料清单引用」两个弹窗(2026-10-21)
 *
 * 验什么(逐条打 PASS/FAIL,不靠肉眼):
 *   ① 封面右上角产品编号是**引用控件**(不是输入框),点开出弹窗
 *   ② 弹窗数据源 = 产品信息表,按最新在前排序(单据日期/单据编号 双键倒序)
 *   ③ 已被规格书引用过的产品编号 → 行标「已开发」且**点不动**(点它只弹提示,不选中)
 *   ④ 选中可用行 → 确定 → 按配置映射带回封面(跨名映射 产品整体尺寸→整体规格参数、
 *      产品名称→名称 要真的落值;没有来源的 客户名称/应用场景/版本 **保持原值**)
 *   ⑤ 第 4 页「1.关键物料列表 → 从物料清单引用」弹窗有 物料编码/物料代号/物料名称 三列
 *      (物料代号取表头「物料代码」),导入后 数量 = 标准用量
 *
 * ⚠ 全程**不点保存** —— 只读验证,不往正式账套写数据。
 * 用法:node tools/archive/_rd-picker-20261021/_verify-pickers.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9498
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

let pass = 0
let fail = 0
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS ' + name + (extra ? ' :: ' + extra : '')) }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

/** 页面里按「弹窗标题」找到那个 el-dialog(页面上可能有多个弹窗,按标题定位最稳)。
 *  ⚠ 关闭后 el-dialog 节点**仍在 DOM 里**(只是 overlay 隐藏),所以「是否打开」一律看可见性,别看存在性。 */
const dlgFinder = `
function dlgShown(d){
  if (!d) return false;
  var ov = d.closest('.el-overlay') || d.parentElement;
  if (!ov) return false;
  var cs = getComputedStyle(ov);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && ov.getBoundingClientRect().height > 0;
}
function dlgByTitle(t){
  var ds = Array.prototype.slice.call(document.querySelectorAll('.el-dialog'));
  return ds.filter(function(d){ return dlgShown(d) }).find(function(d){ var h=d.querySelector('.el-dialog__title'); return h && h.innerText.trim()===t }) || null;
}
function dlgAnyByTitle(t){
  var ds = Array.prototype.slice.call(document.querySelectorAll('.el-dialog'));
  return ds.find(function(d){ var h=d.querySelector('.el-dialog__title'); return h && h.innerText.trim()===t }) || null;
}`

const pickState = `(function(){${dlgFinder}
  var d = dlgByTitle('引用产品信息表');
  if (!d) return JSON.stringify({ open:false });
  var heads = Array.prototype.map.call(d.querySelectorAll('.el-table__header th'), function(e){ return e.innerText.trim() }).filter(Boolean);
  var rows = Array.prototype.map.call(d.querySelectorAll('.el-table__body .el-table__row'), function(tr){
    return {
      cells: Array.prototype.map.call(tr.querySelectorAll('td'), function(td){ return td.innerText.trim() }),
      used: tr.className.indexOf('pp-row-used')>=0,
      picked: tr.className.indexOf('pp-row-picked')>=0
    };
  });
  var btn = Array.prototype.slice.call(d.querySelectorAll('.el-dialog__footer button')).find(function(b){ return b.innerText.trim()==='确定' });
  return JSON.stringify({
    open:true, heads:heads, rows:rows,
    hint: (d.querySelector('.pp-foot')||{innerText:''}).innerText.trim(),
    confirmDisabled: btn ? (btn.disabled || btn.className.indexOf('is-disabled')>=0) : null
  });
})()`

/** 纸面之外(不渲染)的表头字段:直接从组件 props.head 读,弹窗只看得见封面那几格 */
const headState = `(function(){
  var el = document.querySelector('.rsp-sheet') || document.querySelector('.record-sheet');
  var inst = el && (el.__vueParentComponent || el.__vueParentComponent);
  var h = inst && (inst.props && inst.props.head);
  if (!h) { var s = inst && inst.setupState; h = s && s.head && s.head.value; }
  if (!h) return JSON.stringify(null);
  return JSON.stringify({ 名称:h['名称'], 产品编号:h['产品编号'], 客户料号:h['客户料号'], 整体规格参数:h['整体规格参数'] });
})()`

const coverState = `(function(){
  var lbs = Array.prototype.map.call(document.querySelectorAll('.rsp-cover-lb'), function(e){ return e.innerText.trim() });
  var vals = Array.prototype.map.call(document.querySelectorAll('.rsp-cover-vl'), function(e){
    var i = e.querySelector('input, textarea');
    if (i) return i.value;
    return e.innerText.trim();
  });
  var m = {};
  for (var k=0;k<lbs.length;k++) m[lbs[k]] = vals[k];
  return JSON.stringify({ map:m, docNo:(document.querySelector('.rsp-cover-docno-val')||{innerText:''}).innerText.trim() });
})()`

const matState = `(function(){${dlgFinder}
  var d = dlgByTitle('从物料清单引用');
  if (!d) return JSON.stringify({ open:false });
  var heads = Array.prototype.map.call(d.querySelectorAll('.el-table__header th'), function(e){ return e.innerText.trim() }).filter(Boolean);
  var rows = Array.prototype.map.call(d.querySelectorAll('.el-table__body .el-table__row'), function(tr){
    return Array.prototype.map.call(tr.querySelectorAll('td'), function(td){ return td.innerText.trim() }).filter(function(x){ return x!=='' });
  });
  var imp = Array.prototype.slice.call(d.querySelectorAll('.el-dialog__footer button')).find(function(b){ return b.innerText.indexOf('导入')>=0 });
  return JSON.stringify({ open:true, heads:heads, rows:rows.slice(0,6), importText: imp?imp.innerText.trim():'' });
})()`

const matTableState = `(function(){
  var tables = Array.prototype.slice.call(document.querySelectorAll('.rs-t'));
  // 明细表:带 dataTables 的物料清单区(表头含 物料编码);取第一张命中表的前若干行
  var out = { rows: [] , heads: []};
  for (var i=0;i<tables.length;i++){
    var th = tables[i].querySelector('tr.rs-thead, thead, tr');
    var txt = tables[i].innerText || '';
    if (txt.indexOf('物料编码') >= 0) {
      out.heads = Array.prototype.map.call(tables[i].querySelectorAll('th'), function(e){ return e.innerText.trim() }).filter(Boolean);
      var trs = tables[i].querySelectorAll('tbody tr');
      out.rows = Array.prototype.map.call(trs, function(tr){
        return Array.prototype.map.call(tr.querySelectorAll('td input, td'), function(e){ return (e.value!==undefined && e.tagName==='INPUT') ? e.value : (e.innerText||'').trim() }).filter(function(x){ return x!=='' });
      }).filter(function(r){ return r.length>1 });
      break;
    }
  }
  return JSON.stringify(out);
})()`

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_rdpickverify'), 'about:blank'], { stdio: 'ignore', detached: true })
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

  // ── 打开产品规格书 ──
  await ev('location.hash = "#/panelx/list/RD_SPEC_DOC"'); await sleep(8000)

  console.log('① 封面编号格是不是引用控件')
  const cover0 = JSON.parse(await ev(coverState))
  const pickCtl = await ev(`!!document.querySelector('.rsp-cover-docno-pick')`)
  const plainInput = await ev(`!!document.querySelector('.rsp-cover-docno-in')`)
  check('封面有 .rsp-cover-docno-pick 引用控件', pickCtl === true)
  check('封面不再是 .rsp-cover-docno-in 输入框', plainInput === false)
  console.log('    当前封面值 :: ' + JSON.stringify(cover0.map))
  await shot('_v1-cover-pickctl.png')

  // ── ① 点开弹窗 ──
  await ev(`(function(){ var e=document.querySelector('.rsp-cover-docno-pick'); if(e) e.click(); })()`)
  await sleep(2500)
  const ps = JSON.parse(await ev(pickState))
  console.log('② 弹窗内容')
  check('弹窗已打开(标题「引用产品信息表」)', ps.open === true)
  check('列头 = 产品编号/产品名称/单据日期/状态', ps.open && ps.heads.join('|') === '产品编号|产品名称|单据日期|状态', ps.heads && ps.heads.join('|'))
  check('有候选行', ps.open && ps.rows.length > 0, ps.open ? ps.rows.length + ' 行' : '')
  console.log('    行 :: ' + JSON.stringify(ps.rows))
  console.log('    底注 :: ' + ps.hint)
  // 排序:单据日期倒序,同日按单据编号倒序
  const dates = (ps.rows || []).map((r) => r.cells[2] || '')
  const sortedDates = [...dates].sort((a, b) => String(b).localeCompare(String(a)))
  check('按最新在前(单据日期倒序)', dates.join(',') === sortedDates.join(','), dates.join(','))
  await shot('_v2-prod-pick-dialog.png')

  // ── ② 已开发行:标已开发 + 点不动 ──
  const usedIdx = (ps.rows || []).findIndex((r) => r.used)
  check('存在标为已开发的行', usedIdx >= 0, usedIdx >= 0 ? '第 ' + (usedIdx + 1) + ' 行 ' + JSON.stringify(ps.rows[usedIdx].cells) : '')
  if (usedIdx >= 0) {
    await ev(`(function(){${dlgFinder}
      var d = dlgByTitle('引用产品信息表');
      var tr = d.querySelectorAll('.el-table__body .el-table__row')[${usedIdx}];
      if (tr) tr.click();
    })()`)
    await sleep(1200)
    const ps2 = JSON.parse(await ev(pickState))
    check('点已开发行不会被选中(行无 pp-row-picked)', !(ps2.rows || []).some((r) => r.picked))
    check('点已开发行后「确定」仍为禁用', ps2.confirmDisabled === true)
    const msg = await ev(`(function(){ var m=document.querySelector('.el-message'); return m?m.innerText.trim():'' })()`)
    check('弹出「已引用过…不能再引用」提示', String(msg).indexOf('不能再引用') >= 0, String(msg))
    await shot('_v3-used-row-blocked.png')
  }

  // ── ③ 选可用行 → 确定 → 带回封面 ──
  const availIdx = (ps.rows || []).findIndex((r) => !r.used)
  check('存在可引用的行', availIdx >= 0, availIdx >= 0 ? '第 ' + (availIdx + 1) + ' 行 ' + JSON.stringify(ps.rows[availIdx].cells) : '')
  let pickedCode = ''
  if (availIdx >= 0) {
    pickedCode = ps.rows[availIdx].cells[0]
    await ev(`(function(){${dlgFinder}
      var d = dlgByTitle('引用产品信息表');
      var tr = d.querySelectorAll('.el-table__body .el-table__row')[${availIdx}];
      if (tr) tr.click();
    })()`)
    await sleep(800)
    const ps3 = JSON.parse(await ev(pickState))
    check('选中后「确定」变为可用', ps3.confirmDisabled === false)
    check('选中行有 pp-row-picked 高亮', (ps3.rows || []).some((r) => r.picked))
    await shot('_v4-row-picked.png')
    await ev(`(function(){${dlgFinder}
      var d = dlgByTitle('引用产品信息表');
      var b = Array.prototype.slice.call(d.querySelectorAll('.el-dialog__footer button')).find(function(x){ return x.innerText.trim()==='确定' });
      if (b) b.click();
    })()`)
    await sleep(2000)
    const ps4 = JSON.parse(await ev(pickState))
    check('确定后弹窗关闭', ps4.open === false)
    const hs = JSON.parse(await ev(headState) || 'null')
    console.log('    props.head 片段 :: ' + JSON.stringify(hs))
    if (hs) console.log('    (名称 由 产品名称 跨名映射写入,纸面不渲染该字段,只能从 props.head 读)')
    const cover1 = JSON.parse(await ev(coverState))
    console.log('    带入后封面 :: ' + JSON.stringify(cover1.map))
    check('封面产品编号 = 选中的产品编号(' + pickedCode + ')', cover1.docNo === pickedCode, cover1.docNo)
    // 跨名映射两处 + 同名映射两处(按产品编号 11 的那张产品信息表:P1=11 客户料号=11 客户项目名称=111 产品整体尺寸=1)
    if (pickedCode === '11') {
      check('整体规格参数 ← 产品整体尺寸(跨名映射)', cover1.map['整体规格参数'] === '1', cover1.map['整体规格参数'])
      check('名称 ← 产品名称(跨名映射,读 props.head)', hs && hs['名称'] === '碳棒', hs ? hs['名称'] : 'props.head 取不到')
      check('客户料号 ← 客户料号', cover1.map['客户料号'] === '11', cover1.map['客户料号'])
      check('客户项目名称 ← 客户项目名称', cover1.map['客户项目名称'] === '111', cover1.map['客户项目名称'])
      check('无来源的 客户名称 保持原值(未被清空)', cover1.map['客户名称'] === cover0.map['客户名称'], cover1.map['客户名称'])
      check('无来源的 应用场景 保持原值', cover1.map['应用场景'] === cover0.map['应用场景'], cover1.map['应用场景'])
      check('无来源的 版本 保持原值', cover1.map['版本'] === cover0.map['版本'], cover1.map['版本'])
    }
    await shot('_v5-cover-after-ref.png')
  }

  // ── ④ 第 4 页:从物料清单引用 ──
  console.log('④ 关键物料列表 → 从物料清单引用')
  await ev(`(function(){
    var t = Array.prototype.slice.call(document.querySelectorAll('.rsp-page-tab')).find(function(e){ return e.innerText.trim()==='成品及包装运输' });
    if (t) t.click();
  })()`)
  await sleep(2000)
  const opened = await ev(`(function(){
    var bars = Array.prototype.slice.call(document.querySelectorAll('.rs-sectionbar'));
    var bar = bars.find(function(b){ return b.innerText.indexOf('1.关键物料列表')>=0 });
    if (!bar) return 'no-bar';
    var btn = Array.prototype.slice.call(bar.querySelectorAll('.rs-tool')).find(function(e){ return e.innerText.indexOf('从物料清单引用')>=0 });
    if (!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  })()`)
  check('第 4 页「1.关键物料列表」有「从物料清单引用」按钮并可点', opened === 'clicked', opened)
  await sleep(3000)
  const ms = JSON.parse(await ev(matState))
  check('物料清单弹窗已打开', ms.open === true)
  check('列头含 物料编码/物料代号/物料名称', ms.open
    && ms.heads.indexOf('物料编码') >= 0 && ms.heads.indexOf('物料代号') >= 0 && ms.heads.indexOf('物料名称') >= 0,
    ms.heads && ms.heads.join('|'))
  console.log('    前 6 行 :: ' + JSON.stringify(ms.rows))
  check('物料代号列有值(取表头「物料代码」)', ms.open && ms.rows.some((r) => /^[A-Za-z0-9-]+$/.test(r[1] || '')), ms.open ? JSON.stringify(ms.rows[0]) : '')
  await shot('_v6-mat-pick-dialog.png')

  // 勾前两行 → 导入
  await ev(`(function(){${dlgFinder}
    var d = dlgByTitle('从物料清单引用');
    var trs = d.querySelectorAll('.el-table__body .el-table__row');
    for (var i=0;i<Math.min(2,trs.length);i++){ var cb = trs[i].querySelector('.el-checkbox'); if (cb) cb.click(); }
  })()`)
  await sleep(800)
  const before = JSON.parse(await ev(matTableState))
  await ev(`(function(){${dlgFinder}
    var d = dlgByTitle('从物料清单引用');
    var b = Array.prototype.slice.call(d.querySelectorAll('.el-dialog__footer button')).find(function(x){ return x.innerText.indexOf('导入')>=0 });
    if (b) b.click();
  })()`)
  await sleep(2000)
  const after = JSON.parse(await ev(matTableState))
  console.log('    导入前明细行 :: ' + before.rows.length + ' → ' + JSON.stringify(before.rows.slice(0, 3)))
  console.log('    导入后明细行 :: ' + after.rows.length + ' → ' + JSON.stringify(after.rows.slice(0, 4)))
  check('导入后本表明细行数增加', after.rows.length > before.rows.length, before.rows.length + ' → ' + after.rows.length)
  // 只比对**新增**的行:勾的是弹窗前两行(YJ-YKRS-007 标准用量 0.05 / YJ-XWR-014 标准用量 2)
  const beforeKey = before.rows.map((r) => r.join('|'))
  const added = after.rows.filter((r) => !beforeKey.includes(r.join('|')))
  console.log('    新增行 :: ' + JSON.stringify(added))
  const addedText = added.map((r) => r.join('|')).join(' ;; ')
  check('新增 2 行', added.length === 2, String(added.length))
  check('新增行带 物料编码 YJ-YKRS-007 / 物料名称 英克瑞斯酸洗炭', addedText.indexOf('YJ-YKRS-007') >= 0 && addedText.indexOf('英克瑞斯酸洗炭') >= 0, addedText)
  check('数量 = 标准用量(0.05 与 2)', /(^|\|)0\.05(\||$)/.test(addedText) && /(^|\|)2(\||$)/.test(addedText), addedText)
  await shot('_v7-after-mat-import.png')

  console.log('')
  console.log('RESULT pass=' + pass + ' fail=' + fail)
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
