import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const BASE = 'http://localhost:5173'
const PORT = 9498
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ } }
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});localStorage.setItem('mes_locale','zh-CN');localStorage.setItem('mes_init_done','1');'ok'`)
await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_PROC_INSP` })
for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.doc-select-rail')`)) break }
await sleep(3000)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说');if(b)b.click();const x=document.querySelector('.el-dialog__headerbtn');if(x)x.click();return 'ok'})()`)
await sleep(600)

const dump = await ev(`(() => {
  // 找到 PanelxList 的组件实例(从 panelx-list 元素向上找,setupState 里带 markInlineDirty 的那个)
  let el = document.querySelector('.panelx-list')
  let inst = el && el.__vueParentComponent
  const chain = []
  while (inst) {
    const ss = inst.setupState || {}
    chain.push(Object.keys(ss).slice(0, 8).join(','))
    if ('inlineDirtyFlag' in ss) {
      const flag = ss.inlineDirtyFlag
      const snap = String(ss.savedSnapshot ?? '')
      let now = ''
      try { now = JSON.stringify(ss.guardFormData ? ss.guardFormData() : {}) } catch (e) { now = 'ERR ' + e.message }
      let diff = []
      try {
        const a = JSON.parse(snap || '{}'); const b = JSON.parse(now || '{}')
        const keys = new Set([...Object.keys(a), ...Object.keys(b)])
        for (const k of keys) {
          const va = JSON.stringify(a[k]); const vb = JSON.stringify(b[k])
          if (va !== vb) diff.push(k + ': ' + String(va).slice(0, 60) + ' -> ' + String(vb).slice(0, 60))
        }
      } catch (e) { diff = ['diff-err ' + e.message] }
      return { found: true, flag, snapLen: snap.length, nowLen: now.length, diff: diff.slice(0, 12) }
    }
    inst = inst.parent
  }
  return { found: false, chain }
})()`)
console.log(JSON.stringify(dump, null, 2))
ws.close(); edge.kill(); process.exit(0)
