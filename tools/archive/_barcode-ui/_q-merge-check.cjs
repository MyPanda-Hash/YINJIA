/** _q-merge-check.cjs — 合并后活体核查:一级菜单结构 + 字段管理面板可开 + 条码面板仍在 */
const CDP_PORT = 9421
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const lj = await lr.json(); const token = lj.data.token; const user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--window-size=1600,1000', '--user-data-dir=' + path.join(require('os').tmpdir(), '_merge_cdp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 200)) })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: 'http://127.0.0.1:8090/#/login' }); await sleep(3500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload', {}); await sleep(8000)

  const menus = await ev(`(function(){
    var nodes = Array.prototype.map.call(document.querySelectorAll('.nav-title, .menu-title, .el-menu-item, .el-sub-menu__title'), function(n){ return (n.innerText||'').replace(/\\s+/g,' ').trim() }).filter(Boolean)
    return JSON.stringify(nodes.slice(0, 40))
  })()`)
  console.log('MENU', menus)

  for (const p of ['FIELDMGR', 'BARCODE_MAT']) {
    await ev('location.hash = "#/panelx/list/' + p + '"'); await sleep(6000)
    const st = await ev(`(function(){
      var rows = document.querySelectorAll('.el-table__body-wrapper tbody tr')
      return JSON.stringify({ hash: location.hash, rows: rows.length, title: (document.querySelector('.panel-name,.report-heading strong,.doc-title')||{}).innerText || (document.body.innerText||'').slice(0,60) })
    })()`)
    console.log('PANEL', p, st)

    await send('Page.captureScreenshot', { format: 'png' }).then((r) => fs.writeFileSync(path.join(OUT, '_merge-' + p + '.png'), Buffer.from(r.result.data, 'base64')))
  }
  console.log('ERRS', JSON.stringify(errs.slice(0, 4)))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
