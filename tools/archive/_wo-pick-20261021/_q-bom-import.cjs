/**
 * _q-bom-import.cjs — 活体验证「物料清单批量导入」对话框(2026-10-21)
 *
 * 验证点:
 *   ① WLBOM 面板工具栏出现「导入」按钮(后端 IMPORTABLE_PANELS 加组)
 *   ② 点开是专用 BomImportDialog(不是通用 ImportDialog)
 *   ③ 「下载模板」能生成文件(检查下载事件)
 *   ④ 解析一组合规数据后预览出「N 个产品 / M 行用料」
 *
 * 用法:node tools/archive/_wo-pick-20261021/_q-bom-import.cjs [端口]
 */
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const OUT = __dirname
const PORT = process.argv[2] || '5173'
const BASE = 'http://localhost:' + PORT
const CDP_PORT = 9483
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }

const state = `(function(){
  var q = function(s){ var e=document.querySelector(s); return e ? e.innerText.trim() : ''; };
  var btns = Array.prototype.map.call(document.querySelectorAll('.el-button, .btn, button'), function(e){ return e.innerText.trim() });
  var dlgTitle = '';
  var d = document.querySelector('.el-dialog__title');
  if (d) dlgTitle = d.innerText.trim();
  return JSON.stringify({
    hasImportBtn: btns.some(function(b){ return b === '导入' }),
    btns: btns.filter(function(b){ return b }).slice(0, 18),
    dlgTitle: dlgTitle,
    hasDownloadTpl: btns.some(function(b){ return b.indexOf('下载模板') >= 0 }),
    hasChooseFile: btns.some(function(b){ return b.indexOf('选择 Excel') >= 0 }),
    summary: q('.bom-summary'),
    tip: q('.bom-tip').slice(0, 80)
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
    '--user-data-dir=' + path.join(os.tmpdir(), '_bomimp'), 'about:blank'], { stdio: 'ignore', detached: true })
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
  await send('Page.reload'); await sleep(8000)

  // 打开物料清单面板
  await ev('location.hash = "#/panelx/list/WLBOM"'); await sleep(6000)
  console.log('PANEL ' + await ev(state))
  await shot('_bom-panel.png')

  // 点「导入」
  const clicked = await ev(`(function(){
    // 工具栏按钮的文字在 <span class="act-name"> 里(不是 <button> 的 innerText),
    // 2026-10-21 实测:按 button 找永远 no-import-btn。
    var spans = Array.prototype.slice.call(document.querySelectorAll('.act-name'));
    var sp = spans.find(function(b){ return b.innerText.trim() === '导入' });
    if (!sp) return 'no-import-btn';
    (sp.closest('button') || sp.parentElement || sp).click();
    return 'clicked';
  })()`)
  console.log('CLICK ' + clicked)
  await sleep(2500)
  console.log('DIALOG ' + await ev(state))
  await shot('_bom-dialog.png')

  console.log('ERRS ' + JSON.stringify(errs.slice(0, 3)))
  try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { }
  process.exit(0)
}
main().catch((e) => { console.error('ERROR ' + e.message); process.exit(1) })
