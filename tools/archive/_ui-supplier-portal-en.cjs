/**
 * _ui-supplier-portal-en.cjs — 供应商门户英文界面截图(2026-10-24)
 * 用途:目视确认切到 en 后,新增页面上的标题/列头/按钮/提示都是英文(多语言强制规范)。
 * 用法:node tools/archive/_ui-supplier-portal-en.cjs [账号] [密码]
 */
const CDP_PORT = 9391
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const U = process.argv[2] || 'kbl01'
const P = process.argv[3] || 'kbl@2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}
async function main() {
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1440,900', '--user-data-dir=' + path.join(os.tmpdir(), '_sup_en'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0
  const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
  await sleep(3000)
  await evaluate(`localStorage.clear(); localStorage.setItem('mes_locale','en')`)
  await send('Page.navigate', { url: 'http://localhost:5173/?t=' + Date.now() + '#/login' })
  await sleep(5000)
  const fill = async (sel, value) => evaluate(`(function(){
    var el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)
  await fill('input[placeholder="Enter your account"]', U)
  await fill('input[placeholder="Enter your password"]', P)
  await sleep(400)
  await evaluate(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){var t=(x.innerText||'').trim(); return /进入系统|Enter the workspace|Sign in|进入/i.test(t);}); if (b) b.click(); return !!b;})()`)
  await sleep(9000)
  const info = await evaluate(`JSON.stringify({ hash: location.hash, text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0, 420) })`)
  console.log(info)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_sup-ui-en.png'), Buffer.from(shot.result.data, 'base64'))
  // 中文字符残留检查(数据事实如供应商名/物料名是中文,先剔除)
  const resid = await evaluate(`(function(){
    var heads = Array.from(document.querySelectorAll('.sp-filter, .sp-head, .portal-supplier-bar, .el-table__header')).map(function(e){return e.innerText||'';}).join(' ');
    var m = heads.match(/[\\u4e00-\\u9fa5]+/g) || [];
    return JSON.stringify(Array.from(new Set(m)));
  })()`)
  console.log('界面骨架里的中文残留:', resid)
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(0)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
