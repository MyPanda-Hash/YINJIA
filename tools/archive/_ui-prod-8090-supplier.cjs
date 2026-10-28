/**
 * _ui-prod-8090-supplier.cjs — 8090(打包进 jar 的前端 + 新后端)供应商门户快速回归(2026-10-24)
 * 目的:确认「部署版」而不是「5173 源码版」也具备同样能力(历史踩坑:8090 前端是上次打包的产物)。
 * 用法:node tools/archive/_ui-prod-8090-supplier.cjs [账号] [密码]
 */
const CDP_PORT = 9392
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/'
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
    '--window-size=1440,900', '--user-data-dir=' + path.join(os.tmpdir(), '_sup_8090'), 'about:blank'],
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
  await send('Page.navigate', { url: BASE + '#/login' })
  await sleep(3000)
  await evaluate(`localStorage.clear()`)
  await send('Page.navigate', { url: BASE + '?t=' + Date.now() + '#/login' })
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
  const okU = await fill('input[placeholder="请输入登录账号"]', U)
  const okP = await fill('input[placeholder="请输入登录密码"]', P)
  await evaluate(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return (x.innerText||'').indexOf('进入系统')>=0;}); b && b.click(); return !!b;})()`)
  await sleep(9000)
  const out = await evaluate(`(function(){
    var rows = document.querySelectorAll('.sp-table .el-table__body tr').length;
    var t = (document.body.innerText||'').replace(/\\s+/g,' ');
    return JSON.stringify({ hash: location.hash, bar: !!document.querySelector('.portal-supplier-bar'),
      rows: rows, hasNav: !!document.querySelector('.el-menu'), count: (t.match(/共 \\d+ 张/)||[''])[0] });
  })()`)
  console.log('form=', okU && okP, out)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, '_sup-ui-8090.png'), Buffer.from(shot.result.data, 'base64'))
  const r = JSON.parse(out)
  const pass = r.hash.includes('/scm/supplierPrint') && r.bar && r.rows > 0 && !r.hasNav
  console.log(pass ? '[PASS] 8090 部署版:供应商登录 → 供应商采购打印,有数据、无侧栏' : '[FAIL] 8090 部署版未达预期')
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(pass ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
