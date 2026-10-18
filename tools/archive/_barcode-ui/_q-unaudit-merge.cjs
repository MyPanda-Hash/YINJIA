/**
 * _q-unaudit-merge.cjs — 验证「弃审」在归档态会先引导申请修改(2026-10-18 融合口径)
 * 用法: node tools/archive/_barcode-ui/_q-unaudit-merge.cjs <PANEL> <DOCI号>
 */
const CDP_PORT = 9421
const { spawn } = require('child_process')
const fs = require('fs'); const path = require('path'); const http = require('http')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = process.argv[2] || 'RD_SPEC_DOC'
const DOCNO = process.argv[3] || ''
const OUT = __dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function httpJson(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: CDP_PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
async function main() {
  const lr = await fetch('http://127.0.0.1:8090/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) })
  const lj = await lr.json()
  const token = lj.data.token; const user = JSON.stringify(lj.data.user || {})
  const proc = spawn(EDGE, ['--remote-debugging-port=' + CDP_PORT, '--headless=new', '--disable-gpu', '--window-size=1600,1000', '--user-data-dir=' + path.join(require('os').tmpdir(), '_unaudit_cdp'), 'about:blank'], { stdio: 'ignore', detached: true })
  proc.unref(); await sleep(4000)
  let list
  for (let i = 0; i < 20; i++) { try { list = await httpJson('/json/list'); if (list.length) break } catch (e) {} await sleep(500) }
  const target = list.find((t) => t.type === 'page')
  const { connect } = require('../../verify/lib/mini-ws.cjs')
  let id = 0; const pending = new Map()
  const sock = await connect(target.webSocketDebuggerUrl)
  sock.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method: m, params: p })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error('EVAL ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: 'http://localhost:5173/#/login' }); await sleep(3500)
  await ev('localStorage.setItem("mes_token", ' + JSON.stringify(token) + ')')
  await ev('localStorage.setItem("mes_user", ' + JSON.stringify(user) + ')')
  await send('Page.reload', {}); await sleep(7000)
  const url = DOCNO ? ('#/panelx/list/' + PANEL + '?focus=' + DOCNO) : ('#/panelx/list/' + PANEL)
  await ev('location.hash = ' + JSON.stringify(url)); await sleep(9000)
  const st = await ev('(function(){var t=document.body.innerText||"";var m=t.match(/单据状态[:：]?\s*(\S+)/);return JSON.stringify({status:m?m[1]:null,qs:document.querySelectorAll(".as-side-btn").length})})()')
  console.log('PANEL_STATE', st)
  const clicked = await ev(`(function(){
    var btns = Array.prototype.slice.call(document.querySelectorAll('.as-side-btn'))
    for (var i=0;i<btns.length;i++){ if((btns[i].innerText||'').trim()==='弃审'){ btns[i].click(); return 'clicked' } }
    return 'not-found:' + btns.map(function(b){return (b.innerText||'').trim()}).join(',')
  })()`)
  await sleep(2000)
  const box = await ev(`(function(){
    var b = document.querySelector('.el-message-box__wrapper, .el-message-box')
    var txt = b ? (b.innerText||'').replace(/\\s+/g,' ').trim() : ''
    var btns = b ? Array.prototype.map.call(b.querySelectorAll('button'), function(x){ return (x.innerText||'').trim() }) : []
    return JSON.stringify({ open: !!b, text: txt.slice(0,220), buttons: btns })
  })()`)
  console.log('CLICKED', clicked)
  console.log('DIALOG', box)
  await shot('_unaudit-' + PANEL + '.png')
  // 取消掉,避免副作用
  await ev(`(function(){ var b=document.querySelector('.el-message-box__wrapper'); if(!b) return; var c=Array.prototype.slice.call(b.querySelectorAll('button')).find(function(x){return (x.innerText||'').trim()==='取消'}); if(c) c.click() })()`)
  process.exit(0)
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
