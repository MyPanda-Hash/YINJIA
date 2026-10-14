/*
 * _dbg-pick.mjs — 调试:「选检验项目」点击后为什么没有弹窗(2026-10-09,一次性)
 * 做法:点完之后立刻抓 (a) 页面上所有 .el-message 文本 (b) 当前 .el-dialog 数量与标题 (c) 当前单据的关键字段。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const PORT = 9456
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const token = login.data.token, user = JSON.stringify(login.data.user)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1050',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
    if (r?.result?.exceptionDetails) return 'EXC:' + JSON.stringify(r.result.exceptionDetails).slice(0, 300)
    return r?.result?.result?.value
  }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ASM_INSP` }); await sleep(5200)

  const openMore = () => ev(`(()=>{const grp=[...document.querySelectorAll('.tb-group')].find(g=>/更多/.test((g.querySelector('.tb-main')||{}).textContent||''));if(!grp)return 'NO_MORE';const c=grp.querySelector('.tb-caret');if(!c)return 'NO_CARET';c.click();return 'CLICKED'})()`)
  for (let i = 0; i < 3 && (await openMore()) !== 'CLICKED'; i++) await sleep(500)
  await sleep(600)
  const click = await ev(`(()=>{const it=[...document.querySelectorAll('.tb-menu .ctx-item')].filter(x=>x.getBoundingClientRect().height>0).find(x=>/选检验项目/.test(x.textContent||''));if(!it)return 'NO_ITEM';it.click();return 'CLICKED'})()`)
  console.log('click =', click)
  await sleep(800)
  console.log('toast =', JSON.stringify(await ev(`[...document.querySelectorAll('.el-message')].map(x=>(x.innerText||'').trim())`)))
  console.log('dialogs =', JSON.stringify(await ev(`[...document.querySelectorAll('.el-dialog')].map(x=>((x.querySelector('.el-dialog__title')||{}).innerText||'').trim())`)))
  console.log('overlay =', await ev(`document.querySelectorAll('.el-overlay').length`))
  console.log('单据字段 =', JSON.stringify(await ev(`(()=>{const i=[...document.querySelectorAll('input')].map(x=>x.value).filter(Boolean);return i.slice(0,12)})()`)))
} finally { try { edge.kill() } catch { /* ignore */ } }
