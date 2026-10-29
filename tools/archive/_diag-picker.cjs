/**
 * _diag-picker.cjs — 勾选弹窗内部状态探针(2026-10-25)
 * 打开供应商勾选弹窗 → 点第一行 → 读:选中圆点数、底部「已选」文案、确定按钮是否可点。
 * 用法:node tools/archive/_diag-picker.cjs [baseUrl]
 */
const CDP_PORT = 9411
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
async function main() {
  const api = async (p, opts = {}) => {
    const r = await fetch(BASE + p.replace(/^\//, ''), {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    return JSON.parse(await r.text())
  }
  const lj = await api('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1680,1100', '--user-data-dir=' + path.join(os.tmpdir(), '_diag_picker'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0; const pending = new Map()
  const sock = await connect(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  const logs = []
  sock.on('message', (data) => {
    const m = JSON.parse(data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + JSON.stringify(m.params.exceptionDetails).slice(0, 240))
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '#/login' })
  await sleep(2500)
  await ev(`localStorage.clear()`)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
  await ev(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/scm/supplierAccount' })
  await sleep(3000)
  await send('Page.reload', {})
  await sleep(9000)
  await ev(`(function(){ var b = Array.from(document.querySelectorAll('button')).find(function(x){ return (x.innerText||'').replace(/\\s+/g,'') === '新增供应商账号'; }); if (b) b.click(); })()`)
  await sleep(1500)
  await ev(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; });
    var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; });
    var b = it && Array.from(it.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '选择'; });
    if (b) b.click();
  })()`)
  await sleep(2500)
  console.log('① 弹窗打开:', await ev(`JSON.stringify({
    pickerOpen: !!Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; }),
    rows: document.querySelectorAll('.spd-radio').length,
    selectedText: (document.querySelector('.spd-selected')||{}).innerText || '',
    okDisabled: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; }); var b = d && Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '确定'; }); return b ? b.disabled : null; })()
  })`))
  // 点第一行
  console.log('② 点第一行:', await ev(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    var tr = d.querySelector('.el-table__body tr');
    var before = (d.querySelector('.spd-selected')||{}).innerText || '';
    tr.click();
    return JSON.stringify({ rowText: (tr.innerText||'').replace(/\\s+/g,' ').slice(0,50), before: before });
  })()`))
  await sleep(800)
  console.log('③ 点击后状态:', await ev(`JSON.stringify({
    onCount: document.querySelectorAll('.spd-radio.on').length,
    selectedText: (document.querySelector('.spd-selected')||{}).innerText || '',
    okDisabled: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; }); var b = d && Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '确定'; }); return b ? b.disabled : null; })()
  })`))
  // 点确定
  await ev(`(function(){
    var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; });
    var b = d && Array.from(d.querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim() === '确定'; });
    if (b) b.click();
  })()`)
  await sleep(1500)
  console.log('④ 确定后主弹窗:', await ev(`JSON.stringify({
    supplier: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); if (!d) return '(no-main-dialog)'; var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '供应商'; }); return it ? it.querySelector('input').value : '(no-field)'; })(),
    userName: (function(){ var d = Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('账号') >= 0; }); if (!d) return '(no-main-dialog)'; var it = Array.from(d.querySelectorAll('.el-form-item')).find(function(i){ return ((i.querySelector('.el-form-item__label')||{}).innerText||'').trim() === '账号'; }); return it ? it.querySelector('input').value : '(no-field)'; })(),
    pickerStillOpen: !!Array.from(document.querySelectorAll('.el-dialog')).find(function(x){ return x.offsetParent !== null && (x.innerText||'').indexOf('选择供应商') >= 0; }),
    toasts: Array.from(document.querySelectorAll('.el-message')).map(function(m){ return (m.innerText||'').trim(); })
  })`))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_diag-picker.png'), Buffer.from(shot.result.data, 'base64'))
  console.log('控制台:', logs.join(' | ') || '(无)')
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(0)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
