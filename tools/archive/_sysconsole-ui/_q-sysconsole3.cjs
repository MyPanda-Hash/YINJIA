/** _q-sysconsole3.cjs — 侧边「系统功能」三叶 + 窄屏(768/375)入口页无横向滚动 */
const CDP_PORT = 9443
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname, BASE = 'http://127.0.0.1:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json(); const token = j.data.token; const user = JSON.stringify(j.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_sysconsole_cdp3'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').slice(0, 160)) })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error('EVAL: ' + (r.result.exceptionDetails.exception?.description || '').slice(0, 300)); return r.result?.result?.value }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload', {}); await sleep(6500)

  // 展开 系统管理平台 → 系统功能 → 三叶
  await ev(`(function(){
    var all = Array.prototype.slice.call(document.querySelectorAll('.nav-group, .el-sub-menu__title, .nav-group-title'))
    for (var i=0;i<all.length;i++){ if ((all[i].innerText||'').trim()==='系统管理平台'){ all[i].click(); return 'ok' } }
    return 'miss'
  })()`)
  await sleep(1800)
  await ev(`(function(){
    var all = Array.prototype.slice.call(document.querySelectorAll('*'))
    for (var i=0;i<all.length;i++){ var el=all[i]; if (el.children.length===0 && (el.innerText||'').trim()==='系统功能'){ (el.closest('.nav-group')||el.parentElement).click(); return 'ok' } }
    return 'miss'
  })()`)
  await sleep(1800)
  console.log('NAV_TITLES ' + await ev(`(function(){
    var t = (document.querySelector('#app')||document.body).innerText.replace(/\s+/g,' ')
    return JSON.stringify({ 系统功能: t.indexOf('系统功能')>=0, 系统管理: t.indexOf('系统管理')>=0, 组织架构: t.indexOf('组织架构')>=0, 使用权限查看: t.indexOf('使用权限查看')>=0 })
  })()`))
  await shot('_sidebar-sysfunc-1440.png')
  // 点「系统管理」叶子应落到 /sys/console
  await ev(`(function(){
    var all = Array.prototype.slice.call(document.querySelectorAll('*'))
    for (var i=0;i<all.length;i++){ var el=all[i]; if (el.children.length===0 && (el.innerText||'').trim()==='系统管理'){ el.click(); return 'clicked' } }
    return 'miss'
  })()`)
  await sleep(3500)
  console.log('NAV_AFTER_CLICK ' + await ev('location.hash'))

  // 窄屏:页面内不出现横向滚动
  await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(1500)
  for (const [w, h, tag] of [[768, 900, '768'], [375, 780, '375']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
    await sleep(2000)
    const m = await ev('JSON.stringify({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, bodyOverflow: document.body.scrollWidth })')
    console.log('WIDTH_' + tag + ' ' + m)
    await shot('_console-' + tag + '.png')
  }
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })
