/*
 * _shot-step-plan-fixed.mjs — 工序进度「各工序独立折算」修好后的界面取证(2026-10-15)
 * 打开 生产工单 → MO-2026-10-0004 行3 的工单详情 → 截「工序进度」段。
 * 只读;截图存 tools/archive/。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from '../../tools/node_modules/ws/index.js'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const WO = 'MO-2026-10-0004'
const XC = 3
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-step-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1100',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1200); return } } }
  await send('Page.enable'); await send('Runtime.enable')

  await navigate(`${BASE}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale', 'zh-CN'); localStorage.setItem('mes_init_done', '1'); 'ok'`)
  await navigate('about:blank')
  await navigate(`${BASE}/#/prod/plan/workOrderList`)
  await sleep(6000)
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click();return 'skip'} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click();return 'x'} return 'none' })()`)
  await sleep(1000)
  await evaluate(`(() => {
    const inp=[...document.querySelectorAll('input')].find(i=>i.placeholder&&i.placeholder.includes('输入查询条件'))
    if(!inp) return 'no'
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    setter.call(inp, ${JSON.stringify(WO)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'
  })()`)
  await sleep(700)
  await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='查找'); if(b)b.click(); return 'ok' })()`)
  await sleep(4000)

  // 点该行(行号=XC)的工单号 → 打开工单详情·追溯
  const opened = await evaluate(`(() => {
    const clean=(s)=>(s||'').replace(/[\\n\\r\\t]/g,'').replace(/[⇅▲▼]/g,'').trim()
    const trs=[...document.querySelectorAll('.el-table__body tr')]
    for (const tr of trs) {
      const t=[...tr.querySelectorAll('td')].map(td=>clean(td.innerText))
      if (t.includes(${JSON.stringify(WO)}) && t.includes(${JSON.stringify(String(XC))})) {
        const cell=[...tr.querySelectorAll('td')].find(td=>clean(td.innerText)===${JSON.stringify(WO)})
        const a=cell&&cell.querySelector('a,span.link,.el-link,button')
        if(a){a.click();return 'clicked'}
        cell && cell.click(); return 'cell'
      }
    }
    return 'not-found'
  })()`)
  await sleep(5000)
  console.log(`  打开工单详情 = ${opened}`)
  const dlg = await evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    return d ? d.innerText.replace(/\\n+/g,' | ').slice(0,600) : '(无弹窗)'
  })()`)
  console.log(`  详情文本片段 = ${dlg}`)
  const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  if (s.result?.data) { const p = 'tools/archive/_shot-step-plan-fixed.png'; fs.writeFileSync(p, Buffer.from(s.result.data, 'base64')); console.log(`  截图 ${p}`) }
  ws.close()
} finally {
  edge.kill()
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
}
