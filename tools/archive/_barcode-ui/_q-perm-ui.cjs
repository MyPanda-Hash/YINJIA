/** _q-perm-ui.cjs — 组织架构·角色与面板权限:分组与授权实测 + 截图 */
const CDP_PORT = 9423
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const lj = await lr.json(); const token = lj.data.token; const user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--window-size=1600,1000', '--user-data-dir=' + path.join(require('os').tmpdir(), '_perm_cdp2'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').slice(0, 160)) })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || '')); return r.result?.result?.value }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: 'http://127.0.0.1:8090/#/login' }); await sleep(3500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload', {}); await sleep(7000)
  await ev('location.hash = "#/sys/org"'); await sleep(8000)

  // 选中一个角色(普通用户)让矩阵渲染
  const picked = await ev(`(function(){
    var rows = document.querySelectorAll('.el-table__body-wrapper tbody tr')
    for (var i=0;i<rows.length;i++){
      var t = rows[i].innerText || ''
      if (t.indexOf('普通用户') >= 0) {
        var td = rows[i].querySelector('td') || rows[i]
        ;['mousedown','mouseup','click'].forEach(function(e){ td.dispatchEvent(new MouseEvent(e,{bubbles:true,cancelable:true,view:window})) })
        return t.replace(/\\s+/g,' ').trim().slice(0,30)
      }
    }
    return 'not-found'
  })()`)
  await sleep(4000)
  const groups = await ev(`(function(){
    var items = Array.prototype.map.call(document.querySelectorAll('.el-collapse-item__header'), function(h){ return (h.innerText||'').replace(/\\s+/g,' ').trim() })
    return JSON.stringify(items)
  })()`)
  console.log('PICKED', picked)
  console.log('GROUPS', groups)
  // 展开全部分组 + 把矩阵滚到视口内(否则截图停在部门/用户区)
  await ev(`(function(){
    var hs = document.querySelectorAll('.el-collapse-item__header')
    var closed = Array.prototype.filter.call(hs, function(h){ return h.className.indexOf('is-active') < 0 })
    closed.forEach(function(h){ h.click() })
    return closed.length
  })()`)
  await sleep(2500)
  await ev(`(function(){
    var hs = document.querySelectorAll('.el-collapse-item__header')
    if (!hs.length) return 'none'
    hs[2] ? hs[2].scrollIntoView({ block: 'start' }) : hs[0].scrollIntoView({ block: 'start' })
    return 'scrolled'
  })()`)
  await sleep(1500)
  const cdpShot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, '_perm-matrix.png'), Buffer.from(cdpShot.result.data, 'base64'))
  console.log('ERRS', JSON.stringify(errs.slice(0, 3)))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
