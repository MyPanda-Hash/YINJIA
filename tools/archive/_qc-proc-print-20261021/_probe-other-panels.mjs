import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = 'http://localhost:5173'
const PORT = 9508
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-so-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map(); const reportCalls = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params?.request?.url || ''
    if (u.includes('/api/report/export')) reportCalls.push(u)
  }
}
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
  localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
  localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

for (const code of ['SO_ORDER', 'SL_RECV']) {
  console.log(`\n=== ${code} ===`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${code}` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(3000)
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说');if(b)b.click();
    const x=document.querySelector('.el-dialog__headerbtn');if(x)x.click();return 'ok'})()`)
  await sleep(800)
  const btns = await ev(`[...document.querySelectorAll('button, .as-side-btn, [class*=as-side] span, .tools .tb-main')].map(e=>(e.innerText||'').trim()).filter(Boolean)`)
  const hasBtn = (btns || []).includes('导出报表')
  console.log('  有导出报表按钮:', hasBtn)
  if (!hasBtn) { console.log('  跳过'); continue }
  await ev(`(()=>{const el=[...document.querySelectorAll('button, .as-side-btn, [class*=as-side] span, .tools .tb-main')].find(e=>(e.innerText||'').trim()==='导出报表');if(!el)return 'no';el.click();return 'ok'})()`)
  await sleep(1400)
  const dlg = String(await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent&&(x.innerText||'').includes('导出报表'));return d?(d.innerText||'').replace(/\\s+/g,' ').slice(0,200):'no-dialog'})()`))
  console.log('  弹窗:', dlg.slice(0, 120))
  ok(`${code} 弹窗文案仍是「服务端正式报表」`, /服务端正式报表/.test(dlg), dlg.slice(0, 120))
  // 没注册报表模板的面板(SL_RECV 实测「该面板暂无报表模板」)本来就点不出报表 —— 跳过
  if (/暂无报表模板/.test(dlg)) { console.log('  该面板无报表模板,跳过打印预览回归'); continue }
  reportCalls.length = 0
  await ev(`(()=>{window.__o=null; const orig=window.open; window.open=function(u){ if(u) window.__o=String(u); return { location:{ set href(v){ window.__o=String(v) } }, close(){}, document:{write(){},close(){}} } }; window.__orig=orig; return 'ok'})()`)
  await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent&&(x.innerText||'').includes('导出报表'));
    if(!d) return 'no'; const it=[...d.querySelectorAll('.efmt-item')].find(x=>(x.innerText||'').includes('打印预览')); if(!it) return 'no-item'; it.click(); return 'ok'})()`)
  await sleep(4000)
  ok(`${code} 打印预览仍走服务端报表`, reportCalls.length > 0, `命中 ${reportCalls.length}`)
  await ev(`window.open=window.__orig; 'ok'`)
}
ws.close(); edge.kill()
console.log(`\n== 其它面板回归:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
