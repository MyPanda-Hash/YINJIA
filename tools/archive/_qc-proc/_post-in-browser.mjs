#!/usr/bin/env node
/** 判定:保存类请求是**服务端**卡住,还是只有探针进程(node/curl)被挡。用真实浏览器页面内 fetch 打一次。 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9229
const BASE = process.argv[2] || 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'cdp-post-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' })
async function firstPage() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const p = list.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl && !/^edge:\/\//.test(t.url)).find((t) => t.url === 'about:blank')
      if (p) return p
    } catch {}
    await sleep(250)
  }
  throw new Error('no page')
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map() }
  static async open(u) { const ws = new WebSocket(u); await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')) }); const c = new CDP(ws); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && c.p.has(m.id)) { const { res, rej } = c.p.get(m.id); c.p.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }; return c }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.p.set(id, { res, rej })) }
  async eval(x) { const r = await this.send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value }
}
const page = await firstPage()
const c = await CDP.open(page.webSocketDebuggerUrl)
await c.send('Runtime.enable'); await c.send('Page.enable')
await c.send('Page.navigate', { url: BASE + '/' }); await sleep(4500)
const out = await c.eval(`(async()=>{
  const lr=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});
  const TOK=((await lr.json()).data||{}).token;
  const post=async(p,b,ms=8000)=>{
    const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),ms); const t0=Date.now();
    try{ const r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOK},body:JSON.stringify(b),signal:ac.signal});
         const t=await r.text(); return p+' -> '+r.status+' in '+(Date.now()-t0)+'ms '+t.slice(0,100); }
    catch(e){ return p+' -> ERR '+e.name+' after '+(Date.now()-t0)+'ms'; }
    finally{ clearTimeout(tm); }
  };
  return [
    await post('/api/px/callButton',{panelCode:'QC_PROC_INSP',buttonName:'刷新'}),
    await post('/api/px/callButton',{panelCode:'QC_PROC_INSP',buttonName:'保存为草稿',formData:{单据日期:'2026-10-16',检验类别:'制程检验'}}),
  ];
})()`)
console.log('浏览器内请求结果:')
for (const l of out) console.log('  ' + l)
edge.kill()
