/**
 * _dump-toolbar.cjs — 抓「工具栏按钮组」实际渲染结果(供应商 vs 管理员),定位「打印」组为什么不显示。
 * 用法:node tools/archive/_dump-toolbar.cjs [baseUrl]
 */
const CDP_PORT = 9396
const { spawn } = require('child_process')
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
  const proc = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, '--headless=new', '--disable-gpu',
    '--window-size=1600,1000', '--user-data-dir=' + path.join(os.tmpdir(), '_dump_tb'), 'about:blank'],
  { stdio: 'ignore', detached: true })
  proc.unref()
  await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list && list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require(path.join(__dirname, '..', 'verify', 'lib', 'mini-ws.cjs'))
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  await send('Page.enable')
  const apiLogin = async (u, p) => (await fetch(BASE + 'api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: p, factory: 'YJ' }),
  })).json()
  for (const [u, p, hash] of [['kbl01', 'kbl@2026', '#/scm/supplierPrint'], ['admin', '123456', '#/panelx/list/PU_ORDER']]) {
    const lj = await apiLogin(u, p)
    await send('Page.navigate', { url: BASE + '#/login' })
    await sleep(2000)
    await evaluate(`localStorage.clear()`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)})`)
    await evaluate(`localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))})`)
    await send('Page.navigate', { url: BASE + '?t=' + Date.now() + hash })
    await sleep(2500)
    await send('Page.reload', {})
    await sleep(10000)
    const dump = await evaluate(`(function(){
      var bar = document.querySelector('.toolbar, [class*="toolbar"]');
      var groups = Array.from(document.querySelectorAll('.tb-group')).map(function(g){
        return { text: (g.innerText||'').replace(/\\s+/g,' ').trim(), html: g.outerHTML.slice(0, 220) };
      });
      var allBtns = Array.from(document.querySelectorAll('button')).map(function(b){ return (b.innerText||'').replace(/\\s+/g,'').trim(); }).filter(Boolean);
      return JSON.stringify({ hash: location.hash, groupCount: groups.length, groups: groups.map(function(g){return g.text;}), allBtns: Array.from(new Set(allBtns)).slice(0, 30) });
    })()`)
    console.log('\n===', u, JSON.parse(dump).hash)
    console.log('  组:', JSON.parse(dump).groups.join(' ‖ '))
    console.log('  按钮:', JSON.parse(dump).allBtns.join(','))
  }
  try { sock.close() } catch (e) {}
  try { process.kill(-proc.pid) } catch (e) {}
  process.exit(0)
}
main().catch((e) => { console.error('[FATAL]', e); process.exit(2) })
