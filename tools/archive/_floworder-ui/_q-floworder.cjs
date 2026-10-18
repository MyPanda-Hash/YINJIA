/** _q-floworder.cjs — 流程管控页生产链顺序:排产 → 领料 → 报工 → 检验 → 入库(2026-10-18) */
const CDP_PORT = 9445
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http'); const os = require('os')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = __dirname, BASE = 'http://127.0.0.1:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json(); const token = j.data.token; const user = JSON.stringify(j.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--user-data-dir=' + path.join(os.tmpdir(), '_floworder_cdp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map(); const errs = []
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return } if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').slice(0, 160)) })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => { const res = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (res.result?.exceptionDetails) throw new Error('EVAL: ' + (res.result.exceptionDetails.exception?.description || '').slice(0, 300)); return res.result?.result?.value }
  const shot = async (n) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(s.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload', {}); await sleep(7000)
  console.log('AUTH ' + await ev('JSON.stringify({ hash: location.hash, token: !!localStorage.getItem("mes_token") })'))
  if ((await ev('location.hash')) !== '#/dashboard') { await ev('location.hash = "#/dashboard"'); await sleep(6000) }
  console.log('AT_DASH ' + await ev('JSON.stringify({ hash: location.hash, tabs: Array.prototype.map.call(document.querySelectorAll(".mod-tabs button"), function (b) { return (b.innerText||"").trim() }).slice(0, 10) })'))
  // 切到「流程管控」页签
  console.log('TAB ' + await ev(`(function(){
    var bs = Array.prototype.slice.call(document.querySelectorAll('.mod-tabs button, .mod-tabs *'))
    for (var i=0;i<bs.length;i++){ if ((bs[i].innerText||'').trim()==='流程管控'){ (bs[i].closest('button')||bs[i]).click(); return 'clicked' } }
    return 'miss'
  })()`))
  await sleep(3000)
  const readChain = `(function(){
    var chain = document.querySelectorAll('.flow-board .fb-chain')[0]
    if (!chain) return JSON.stringify({ miss: true, text: (document.querySelector('#app')||document.body).innerText.replace(/\s+/g,' ').slice(0,200) })
    var q = function (s) { return Array.prototype.map.call(chain.querySelectorAll(s), function (e) { return (e.innerText||'').trim() }) }
    return JSON.stringify({
      name: q('.fb-title')[0] || '',
      intro: q('.fb-intro')[0] || '',
      lanes: q('.fb-lane-name'),
      hints: q('.fb-lane-hint'),
      downs: q('.fb-down-tag'),
      codes: q('.fb-node-code'),
      nodes: q('.fb-node-name'),
    })
  })()`
  console.log('PROD_CHAIN ' + await ev(readChain))
  await shot('_flowboard-1440.png')
  for (const [w, h, tag] of [[768, 900, '768'], [375, 780, '375']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
    await sleep(2000)
    console.log('WIDTH_' + tag + ' ' + await ev('JSON.stringify({ docW: document.documentElement.scrollWidth, winW: window.innerWidth })'))
    await shot('_flowboard-' + tag + '.png')
  }
  // 英文词条核验:切 en 后看生产链文案是否英文(不回落中文)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await ev('localStorage.setItem("mes_locale", "en")')
  await send('Page.reload', {}); await sleep(7000)
  console.log('EN_TABS ' + await ev(`(function(){
    var bs = Array.prototype.slice.call(document.querySelectorAll('.mod-tabs button'))
    if (bs.length > 1) { bs[1].click(); return JSON.stringify(Array.prototype.map.call(bs, function (b) { return (b.innerText||'').trim() })) }
    return 'miss:' + bs.length
  })()`))
  await sleep(3000)
  console.log('EN_CHAIN ' + await ev(`(function(){
    var chain = document.querySelectorAll('.flow-board .fb-chain')[0]
    if (!chain) return JSON.stringify({ miss: true })
    var q = function (s) { return Array.prototype.map.call(chain.querySelectorAll(s), function (e) { return (e.innerText||'').trim() }) }
    return JSON.stringify({ name: q('.fb-title')[0], intro: q('.fb-intro')[0], lanes: q('.fb-lane-name'), downs: q('.fb-down-tag') })
  })()`))
  await shot('_flowboard-en-1440.png')
  await ev('localStorage.setItem("mes_locale", "zh-CN")')
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 5)))
  process.exit(0)
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })
