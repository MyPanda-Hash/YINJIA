/* 一次性探针:打开组装成品检验单页,列出可见输入框与明细表头,供 UI 探针定位。 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9461
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const token = login.data.token, user = JSON.stringify(login.data.user)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-asminsp-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1080',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ASM_INSP` }); await sleep(6000)

  console.log('--- 可见输入框(input/textarea) ---')
  console.log(await ev(`[...document.querySelectorAll('input,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>{const lab=(e.closest('td,.cell,.el-form-item')||{}).innerText||'';return (e.tagName+'['+e.type+'] ph='+(e.placeholder||'')+' val='+(e.value||'')+' near='+lab.replace(/\\s+/g,' ').slice(0,26))}).slice(0,40).join('\\n')`))
  console.log('\n--- 表格表头 ---')
  console.log(await ev(`[...document.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').trim()).filter(Boolean).join(' | ')`))
  console.log('\n--- 明细行数 ---', await ev(`document.querySelectorAll('.el-table__body-wrapper tbody tr').length`))
  console.log('\n--- 表头字段区(header fields)候选 ---')
  console.log(await ev(`[...document.querySelectorAll('.doc-head,.head-fields,.header-fields,.doc-header,.voucher-head')].map(x=>x.className+' :: '+(x.innerText||'').replace(/\\s+/g,' ').slice(0,300)).join('\\n')`))
  console.log('\n--- 页面里含「产品编码」字样的元素 ---')
  console.log(await ev(`[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/^产品编码$/.test((e.innerText||'').trim())).map(e=>{const td=e.closest('td')||e.parentElement;return 'tag='+e.tagName+' cls='+e.className+' parentTag='+td.tagName+' parentHTML='+td.innerHTML.replace(/\\s+/g,' ').slice(0,260)}).join('\\n')`))
} finally {
  try { edge.kill() } catch {}
}
