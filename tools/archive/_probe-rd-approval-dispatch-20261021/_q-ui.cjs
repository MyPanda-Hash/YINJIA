/**
 * _q-ui.cjs —— 「定级分发」按钮/弹窗活体取证(2026-10-21 报障修复后)
 * 用法:node _q-ui.cjs <base> <docNo> [YJ|YJ_TEST]
 * 断言:已定级未分发的单 ⇒ 侧栏「定级分发」不置灰;点开弹窗等级只读 + 有对接人下拉 + 有说明。
 */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || 'LXA-2026-10-0018'
const FACTORY = process.argv[4] || 'YJ_TEST'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9412
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fail = 0
const ok = (m) => console.log('  [PASS] ' + m)
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('login failed')
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-gd-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 100; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')); console.log('[shot]', n) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await nav(`${BASE}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank')
  await nav(`${BASE}/#/panelx/list/RD_APPROVAL`)
  await sleep(3000)
  // 点开目标单据(左侧列表/主表里的行)
  const clicked = await ev(`(function(){
    var rows=[].slice.call(document.querySelectorAll('tr'));
    for(var i=0;i<rows.length;i++){
      if(rows[i].textContent.indexOf(${JSON.stringify(DOC)})>=0){ var c=rows[i].querySelector('td'); if(c){ c.click(); return 'clicked:'+rows[i].rowIndex } }
    }
    return 'not-found' })()`)
  console.log('[打开单据]', clicked)
  await sleep(3500)
  const btnInfo = await ev(`(function(){
    var out=null
    ;[].slice.call(document.querySelectorAll('.as-side-btn')).forEach(function(b){
      var t=b.textContent.replace(/\\s+/g,' ').trim()
      if(t.indexOf('定级分发')>=0){ out={ text:t, disabled:b.classList.contains('disabled'), title:b.getAttribute('title')||'' } }
    })
    return out })()`)
  console.log('[侧栏按钮]', JSON.stringify(btnInfo))
  if (btnInfo && !btnInfo.disabled) ok(`「${btnInfo.text}」未置灰(title=${btnInfo.title})`)
  else bad(`「定级分发」不可用:${JSON.stringify(btnInfo)}`)
  await shot('rd-approval-side.png')
  // 点开弹窗
  await ev(`(function(){ var b=null
    ;[].slice.call(document.querySelectorAll('.as-side-btn')).forEach(function(x){
      var t=x.textContent.replace(/\\s+/g,' ').trim()
      if(t.indexOf('定级分发')>=0) b=x })
    if(b){ b.click(); return 1 } return 0 })()`)
  await sleep(1500)
  const dlg = await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.textContent.indexOf('定级分发')>=0})[0]
    if(!d) return 'no-dialog'
    var radios=[].slice.call(d.querySelectorAll('.el-radio-button')).map(function(r){
      return { 文本:r.textContent.trim(), 选中:r.classList.contains('is-active'), 禁用:r.classList.contains('is-disabled') } })
    var sel=d.querySelector('.el-select')
    return JSON.stringify({ 说明:d.innerText.replace(/\\s+/g,' ').slice(0,160), 等级按钮:radios, 有对接人下拉: !!sel }) })()`)
  console.log('[弹窗]', dlg)
  const parsed = (() => { try { return JSON.parse(dlg) } catch { return null } })()
  if (parsed && parsed['有对接人下拉']) ok('弹窗里有「对接人」下拉')
  else bad('弹窗里没有对接人下拉')
  if (parsed && parsed['等级按钮'].every((r) => r['禁用'])) ok('等级按钮全部只读(审批已定级)')
  else bad('等级按钮应为只读:' + JSON.stringify(parsed && parsed['等级按钮']))
  if (parsed && /已由审批定级/.test(parsed['说明'])) ok('弹窗有明显说明:等级已由审批定级')
  else bad('缺少说明文案:' + (parsed && parsed['说明']))
  await shot('rd-approval-grade-dialog.png')
  ws.close(); edge.kill()
  console.log(fail === 0 ? '\n[RESULT] ALL PASS' : `\n[RESULT] ${fail} FAIL`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
