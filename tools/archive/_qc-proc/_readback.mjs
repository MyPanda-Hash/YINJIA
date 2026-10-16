#!/usr/bin/env node
/**
 * 回读探针(2026-10-16):打开一张已保存的制程检验单,看横表**只渲染「格数」个格**且值从库里读回。
 * 用法: node tools/archive/_qc-proc/_readback.mjs <单据编号> [baseUrl]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9230
const NO = process.argv[2]
const BASE = process.argv[3] || 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
if (!NO) { console.error('用法: node _readback.mjs <单据编号> [baseUrl]'); process.exit(2) }
const profile = mkdtempSync(join(tmpdir(), 'cdp-read-'))
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
await c.eval(`location.hash = '#/panelx/list/QC_PROC_INSP?docNo=${NO}'`); await sleep(11000)
const info = await c.eval(`(()=>({
  单据: ((document.body.innerText||'').match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[])[0]||null,
  列数: document.querySelectorAll('.qr-grid thead th.c-item-hd').length,
  项目名: [...document.querySelectorAll('.qr-grid thead th.c-item-hd input')].map(i=>i.value),
  格数: [...document.querySelectorAll('.qr-grid thead th.c-item-hd .qr-cells-n')].map(e=>e.textContent.trim()),
  渲染格数: document.querySelectorAll('.qr-grid tbody td.c-val').length,
  输入框: document.querySelectorAll('.qr-grid tbody td.c-val input').length,
  输入值: [...document.querySelectorAll('.qr-grid tbody td.c-val input')].map(i=>i.value),
  只读文本: [...document.querySelectorAll('.qr-grid tbody td.c-val .qr-cell-text')].map(e=>e.textContent.trim()),
  可编辑: !!document.querySelector('.qr-cells'),
}))()`)
console.log(JSON.stringify(info, null, 2))
const vals = info.输入值.length ? info.输入值 : info.只读文本
console.log('结论:', info.格数?.[0] === '8' && info.渲染格数 === 8
  ? `✅ 库里 格数=8 ⇒ 界面只渲染 8 格(预设 10 格中第 9/10 格未激活);值=${JSON.stringify(vals)}`
  : '❌ 渲染格数与库里的格数不一致,见上面快照')
const okVals = vals.join(',') === '11.1,11.2,11.3,11.4,11.5,11.6,11.7,11.8'
console.log('值回读:', okVals ? '✅ 与落库的 11.1..11.8 一致' : '⚠ 与预期不同:' + JSON.stringify(vals))
edge.kill()
