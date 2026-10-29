/**
 * _sup-dump-after-login.cjs — 探针:登录页点「进入系统」后导出 hash / localStorage / 提示(2026-10-24)
 * 用法:node tools/archive/_sup-dump-after-login.cjs [账号] [密码]
 */
const CDP_PORT = 9390
const { spawn } = require('child_process')
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
    '--window-size=1440,900', '--user-data-dir=' + path.join(os.tmpdir(), '_sup_dump2'), 'about:blank'],
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
  await send('Runtime.enable')
  const logs = []
  send('Runtime.enable')
  sock.on('message', (data) => {
    const m = JSON.parse(data)
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[console] ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
    if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300))
  })
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
  await sleep(3000)
  await evaluate('localStorage.clear()')
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
  await sleep(5000)
  const fill = async (sel, value) => evaluate(`(function(){
    var el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  })()`)
  console.log('user=', await fill('input[placeholder="请输入登录账号"]', U))
  console.log('pwd=', (await fill('input[placeholder="请输入登录密码"]', P)) ? '(filled)' : '(failed)')
  await sleep(500)
  await evaluate(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return (x.innerText||'').indexOf('进入系统')>=0;}); b && b.click();})()`)
  for (const t of [1000, 2500, 4000, 6000, 9000]) {
    await sleep(t === 1000 ? 1000 : 1500)
    const st = await evaluate(`JSON.stringify({hash: location.hash, token: (localStorage.getItem('mes_token')||'').slice(0,12), user: (localStorage.getItem('mes_user')||'').slice(0,80), body: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200)})`)
    console.log(t, st)
  }
  console.log('--- 控制台 ---')
  console.log(logs.slice(-15).join('\n'))
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(0)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
