#!/usr/bin/env node
/** 诊断:面板 QC_PROC_INSP 当前单据/状态/可编辑性/侧栏按钮/横表结构 一次看清。用法: node _diag.mjs [baseUrl] [docNo] */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9227
const BASE = process.argv[2] || 'http://localhost:5173'
const DOC = process.argv[3] || ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'cdp-diag-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

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
await c.eval(`(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});const j=await r.json();const d=j.data||j;localStorage.setItem('mes_token',d.token);localStorage.setItem('mes_user',JSON.stringify(d.user||{}));localStorage.setItem('mes_login_date',new Date().toISOString().slice(0,10));localStorage.setItem('mes_factory',JSON.stringify(d.factory||{code:'HSDZ_MES',name:'YINJIA-MES'}));return !!d.token})()`)
await c.send('Page.navigate', { url: BASE + '/' }); await sleep(6500)
const hash = `#/panelx/list/QC_PROC_INSP${DOC ? '?docNo=' + DOC : ''}`
await c.eval(`location.hash = '${hash}'`); await sleep(10000)
const info = await c.eval(`(()=>{
  const txt=(document.body.innerText||'');
  const docNo=(txt.match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[])[0]||null;
  const status=[...document.querySelectorAll('.doc-status')].map(e=>(e.textContent||'').trim());
  const rows=[...document.querySelectorAll('.el-table__body tbody tr, .main-grid tbody tr')].slice(0,6).map(tr=>(tr.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60));
  return {
    hash: location.hash,
    docNo, status,
    qrSheet: !!document.querySelector('.qr-sheet'),
    qrCells: !!document.querySelector('.qr-cells'),
    qrGrid: !!document.querySelector('.qr-grid'),
    qrAddBtn: [...document.querySelectorAll('.qr-add-btn')].map(e=>(e.textContent||'').trim()),
    grpAdd: document.querySelectorAll('.qr-grp-add').length,
    ungroup: document.querySelectorAll('table.qr-ungroup tbody tr').length,
    gridCols: document.querySelectorAll('.qr-grid thead th.c-item-hd').length,
    valInputs: document.querySelectorAll('.qr-grid tbody td.c-val input').length,
    pageNo: (document.querySelector('.page-no')?.textContent||'').trim(),
    sideBtns: [...document.querySelectorAll('.as-side-btn')].filter(e=>e.offsetParent!==null).map(e=>(e.textContent||'').trim()),
    tableRows: rows,
    head: txt.slice(0,200).replace(/\\s+/g,' '),
  };
})()`)
console.log(JSON.stringify(info, null, 2))
edge.kill()
