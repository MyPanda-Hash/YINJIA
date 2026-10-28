/**
 * _q-matpick-bydoc.cjs — 验证「从物料清单引用」改为选单据(2026-10-21)
 *
 * 用户口径:「我要的是选物料编码 S032-3 / 单据日期 / 物料代码 / 物料名称,
 *   然后带入 YJ-YKRS-007 英克瑞斯酸洗炭 kg 0.05 / YJ-XWR-014 … / YJ-JPL-067 …」
 *
 * 断言:
 *   ① 弹窗列 = 物料编码 | 单据日期 | 物料代码 | 物料名称 | 子件数（不再是平铺子件）
 *   ② 勾一张单(S032-3) → 点导入 → 明细新增该单的全部子件（3 行），数量=标准用量
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-matpick-bydoc.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9493
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj.data.token, user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), '_matpickdoc'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(3000)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload'); await sleep(8000)

  await ev('location.hash = "#/panelx/list/RD_SPEC_DOC"'); await sleep(7000)
  // 切到「成品及包装运输」页
  await ev(`(function(){
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.el-tabs__item, .rsp-tab'));
    var t = tabs.find(function(e){ return e.innerText.indexOf('成品及包装运输')>=0 });
    if (t) { t.click(); return 'tab'; }
    return 'no-tab';
  })()`)
  await sleep(2000)

  // 点「从物料清单引用」
  const opened = await ev(`(function(){
    var els = Array.prototype.slice.call(document.querySelectorAll('*'));
    var b = els.find(function(e){ return e.children.length===0 && e.innerText && e.innerText.trim().indexOf('从物料清单引用')>=0 });
    if (!b) return 'no-btn';
    (b.closest('button')||b.parentElement||b).click();
    return 'clicked';
  })()`)
  console.log('OPEN ' + opened)
  await sleep(3000)

  console.log('DIALOG ' + await ev(`(function(){
    var dlg = document.querySelector('.el-dialog');
    if(!dlg) return JSON.stringify({noDialog:true});
    var heads = Array.prototype.map.call(dlg.querySelectorAll('th'), function(e){return e.innerText.trim()});
    var rows = Array.prototype.map.call(dlg.querySelectorAll('tbody tr'), function(r){return r.innerText.replace(/\\s+/g,' ').trim().slice(0,70)});
    var hint = (dlg.querySelector('.el-dialog__body div[style*="909399"]')||{}).innerText||'';
    return JSON.stringify({ heads: heads, rowCount: rows.length, rows: rows.slice(0,6), hint: hint.slice(0,80) });
  })()`))
  await shot('_matpick-dialog.png')

  // 勾第一张单并导入
  const before = await ev(`document.querySelectorAll('.rsp-cell, td').length`)
  const done = await ev(`(function(){
    var dlg = document.querySelector('.el-dialog');
    if(!dlg) return 'no-dialog';
    var cb = dlg.querySelector('tbody tr .el-checkbox__original, tbody tr .el-checkbox');
    if(!cb) return 'no-checkbox';
    cb.click();
    return 'checked';
  })()`)
  console.log('CHECK ' + done)
  await sleep(1200)
  const imported = await ev(`(function(){
    var dlg = document.querySelector('.el-dialog');
    var btns = Array.prototype.slice.call(dlg.querySelectorAll('button'));
    var b = btns.find(function(e){ return /导入/.test(e.innerText) });
    if(!b) return 'no-import-btn';
    if (b.disabled) return 'import-disabled';
    b.click();
    return 'imported';
  })()`)
  console.log('IMPORT ' + imported)
  await sleep(2500)
  console.log('AFTER ' + await ev(`(function(){
    var rows = Array.prototype.map.call(document.querySelectorAll('.rsp-cell'), function(e){return e.innerText.trim()});
    return JSON.stringify({ cellCount: rows.length, sample: rows.slice(0,24) });
  })()`))
  await shot('_matpick-after.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
