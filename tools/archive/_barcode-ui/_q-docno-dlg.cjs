/**
 * _q-docno-dlg.cjs — 条码面板「点单据编号 → 复制/查看」活体验证(2026-10-18)
 * 用法: node tools/archive/_barcode-ui/_q-docno-dlg.cjs [BARCODE_MAT|BARCODE_FIN|BARCODE_WIP]
 */
const CDP_PORT = 9418
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname
const PANEL = process.argv[2] || 'BARCODE_MAT'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const U = process.env.PROBE_USER || 'admin'
  const P = process.env.PROBE_PASS || '123456'
  console.log('LOGIN_AS', U)
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: U, password: P, factory: 'YJ' }) })
  const lj = await lr.json()
  const token = lj.data.token
  const user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--window-size=1600,1000', '--user-data-dir=' + path.join(require('os').tmpdir(), '_docno_cdp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (data) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' }); await sleep(3500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  const deny = process.env.DENY_PANEL || ''
  const userObj = JSON.parse(user)
  if (deny) {
    // 模拟"没有目标面板查看权"的账号:只在**前端可见性**上抹掉该面板(令牌仍是 admin,
    // 用来验证 UI 闸门;服务端仍会按真实权限校验接口)
    const vp = Array.isArray(userObj.visiblePanels) ? userObj.visiblePanels.filter((c) => c !== deny) : []
    userObj.visiblePanels = vp
    userObj.isAdmin = false
    console.log('DENY_MODE 去掉', deny, '当前可见面板数', vp.length)
  }
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(JSON.stringify(userObj)) + ')')
  await send('Page.reload', {}); await sleep(7000)
  await ev('location.hash = "#/panelx/list/' + PANEL + '"'); await sleep(9000)

  const link = await ev(`(function(){
    var a = document.querySelector('.doc-no-link')
    if (!a) return 'null'
    return JSON.stringify({ text: a.innerText.trim(), cls: a.className })
  })()`)
  console.log('LINK', link)
  await ev('document.querySelector(".doc-no-link") && document.querySelector(".doc-no-link").click()')
  await sleep(1500)
  const dlg = await ev(`(function(){
    var ds = Array.prototype.slice.call(document.querySelectorAll('.el-dialog'))
    for (var i=0;i<ds.length;i++){ if (ds[i].innerText.indexOf('复制编号') >= 0) {
      var btns = Array.prototype.slice.call(ds[i].querySelectorAll('button')).map(function(b){ return { t: (b.innerText||'').trim(), disabled: !!b.disabled } })
      return JSON.stringify({ visible: true, text: ds[i].innerText.replace(/\\s+/g,' ').trim().slice(0,160), buttons: btns })
    } }
    return JSON.stringify({ visible: false })
  })()`)
  console.log('DIALOG', dlg)
  await shot('_docno-' + PANEL + '.png')

  // 点「查看单据」→ 应跳该单据面板并带 focus
  const before = await ev('location.hash')
  await ev(`(function(){
    var ds = Array.prototype.slice.call(document.querySelectorAll('.el-dialog'))
    for (var i=0;i<ds.length;i++){ var b = Array.prototype.slice.call(ds[i].querySelectorAll('button')).find(function(x){ return (x.innerText||'').trim()==='查看单据' }); if (b) { b.click(); return 'clicked' } }
    return 'not-found'
  })()`)
  await sleep(4000)
  console.log('NAV', before, '->', await ev('location.hash'))
  await shot('_docno-after-' + PANEL + '.png')
  process.exit(0)
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
