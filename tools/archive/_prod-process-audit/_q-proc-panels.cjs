/** _q-proc-panels.cjs — 「生产过程」10 张单据逐页取证(2026-10-18)
 *  每张面板记录:列表行数 / 空态文案 / 列头 / 工具条按钮 / 新增表单字段数与必填数,并截图。
 *  用法(仓库根):node tools/archive/_prod-process-audit/_q-proc-panels.cjs [账号] [口令] [工厂] [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const ACC = process.argv[2] || 'admin'
const PWD = process.argv[3] || '123456'
const FACTORY = process.argv[4] || 'YJ'
const PORT = process.argv[5] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9458
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PANELS = [
  ['WO_REPORT', '工序报工单'], ['WO_REPORT_LIST', '报工记录'], ['WO_COMPLETION_LIST', '完工明细'],
  ['PROD_ABN', '生产异常处理单'], ['DAY_REPORT', '生产日报表'], ['FEED_CONFIRM', '投料确认单'],
  ['MIX_RECORD', '物料混合记录'], ['GRAN_RECORD', '造粒记录'], ['WH_RECORD', '无黑处理登记'],
  ['PACK_CONFIRM', '封箱确认'],
]
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: ACC, password: PWD, factory: FACTORY }),
  })
  const lj = await lr.json()
  if (!lj.data || !lj.data.token) { console.log('FAIL LOGIN ' + JSON.stringify(lj).slice(0, 200)); process.exit(1) }
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_procq_' + ACC), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) { } await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params: params || {} })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  const summary = []
  for (const [code, title] of PANELS) {
    await ev('location.hash = "#/panelx/list/' + code + '"')
    await sleep(4000)
    const info = await ev(`(function(){
      var root = document.body;
      var tables = document.querySelectorAll('.el-table');
      var rows = document.querySelectorAll('.el-table__body-wrapper tbody tr');
      var empty = document.querySelector('.el-table__empty-text');
      var heads = Array.prototype.map.call(document.querySelectorAll('.el-table__header-wrapper th'), function(t){ return (t.innerText||'').trim() }).filter(Boolean);
      var btns = Array.prototype.map.call(document.querySelectorAll('button'), function(b){ return (b.innerText||'').trim() }).filter(Boolean);
      var tabs = Array.prototype.map.call(document.querySelectorAll('.el-tabs__item'), function(t){ return (t.innerText||'').trim() }).filter(Boolean);
      var h = (document.querySelector('h1,h2,.page-title,.panel-title')||{}).innerText || '';
      // 单据卡片信息(新增流程表单页有「第 x / y 张」)
      var card = '';
      var all = document.querySelectorAll('span,div,b');
      for (var i=0;i<all.length;i++){ var t=(all[i].innerText||'').trim(); if (/^第\\s*\\d+\\s*\\/\\s*\\d+\\s*张/.test(t)) { card = t; break } }
      // 表单字段(新增流程页:字段在页面上而不是弹窗里)
      var items = document.querySelectorAll('.el-form-item');
      var labels = Array.prototype.map.call(items, function(it){
        var l = it.querySelector('.el-form-item__label'); return l ? (l.innerText||'').trim() : ''; }).filter(Boolean);
      return JSON.stringify({ title: h.trim(), tables: tables.length, rows: rows.length, card: card,
        empty: empty ? (empty.innerText||'').trim().slice(0,60) : null, heads: heads.slice(0,20),
        btns: btns.slice(0,14), tabs: tabs, pageFields: labels.length, pageLabels: labels.slice(0,30) });
    })()`)
    const o = JSON.parse(info || '{}')
    // 点「新增流程」看表单
    const openForm = await ev(`(function(){
      var bs = document.querySelectorAll('button');
      for (var i=0;i<bs.length;i++){ var t=(bs[i].innerText||'').trim(); if (t.indexOf('新增')>=0){ bs[i].click(); return t } }
      return null })()`)
    await sleep(3500)
    const form = await ev(`(function(){
      var d = null; var ds = document.querySelectorAll('.el-dialog, .el-drawer, .panelx-form, form');
      for (var i=0;i<ds.length;i++){ if (ds[i].offsetParent !== null) { d = ds[i]; break } }
      var scope = d || document.body;
      var items = scope.querySelectorAll('.el-form-item');
      var labels = Array.prototype.map.call(items, function(it){
        var l = it.querySelector('.el-form-item__label'); return l ? (l.innerText||'').trim() : '';
      }).filter(Boolean);
      var req = Array.prototype.map.call(items, function(it){
        var l = it.querySelector('.el-form-item__label'); if (!l) return '';
        return (l.className||'').indexOf('is-required')>=0 ? (l.innerText||'').trim() : '';
      }).filter(Boolean);
      var inputs = scope.querySelectorAll('input, textarea');
      return JSON.stringify({ hash: location.hash, dialog: !!d, items: items.length, labels: labels, required: req, inputs: inputs.length });
    })()`)
    const f = JSON.parse(form || '{}')
    console.log('PANEL ' + code + ' ' + JSON.stringify({ ...o, formOpened: openForm, form: { dialog: f.dialog, items: f.items, required: (f.required || []).length, inputs: f.inputs } }))
    await shot('_page-' + code + '.png')
    summary.push({ code, title, rows: o.rows, tables: o.tables, heads: (o.heads || []).length, formItems: f.items, formDialog: f.dialog, tabs: o.tabs, btns: o.btns })
    await ev(`(function(){ var ds=document.querySelectorAll('.el-dialog,.el-drawer'); for (var i=0;i<ds.length;i++){ if (ds[i].offsetParent===null) continue; var b=ds[i].querySelector('.el-dialog__headerbtn,.el-drawer__close-btn'); if(b){ b.click(); return 'closed' } } return 'none' })()`)
    await sleep(800)
  }
  console.log('\n=== SUMMARY ===')
  console.table(summary.map((s) => ({ code: s.code, 列表行数: s.rows, 表格数: s.tables, 列数: s.heads, 表单弹窗: s.formDialog, 表单字段: s.formItems })))
  fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(summary, null, 2))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
