/**
 * _sup-dump-login.cjs — 供应商门户 e2e 的探针:导出登录页 DOM 结构(2026-10-24)
 * 用法:node tools/archive/_sup-dump-login.cjs
 */
const CDP_PORT = 9389
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
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
    '--window-size=1440,900', '--user-data-dir=' + path.join(os.tmpdir(), '_sup_dump'), 'about:blank'],
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
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result?.result?.value
  }
  await send('Page.enable')
  await evaluate(`localStorage.clear()`)
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' })
  await sleep(6000)
  console.log('hash =', await evaluate('location.hash'))
  console.log('inputs =', await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('input')).map(function(i){return {type:i.type, ph:i.placeholder, cls:i.className, id:i.id};}))`))
  console.log('buttons =', await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('button')).map(function(b){return (b.innerText||'').replace(/\\s+/g,' ').trim()}))`))
  console.log('body text =', await evaluate(`(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,600)`))
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(0)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
