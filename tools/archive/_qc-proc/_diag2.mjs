#!/usr/bin/env node
/** 诊断2:点「保存为草稿」到底发了什么请求(挂 fetch 记录)。用法: node _diag2.mjs [baseUrl] */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9228
const BASE = process.argv[2] || 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'cdp-diag2-'))
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
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); this.logs = [] }
  static async open(u) {
    const ws = new WebSocket(u); await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')) })
    const c = new CDP(ws)
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && c.p.has(m.id)) { const { res, rej } = c.p.get(m.id); c.p.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return }
      if (m.method === 'Runtime.exceptionThrown') c.logs.push('[EXC] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text))
      if (m.method === 'Runtime.consoleAPICalled') c.logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
    return c
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.p.set(id, { res, rej })) }
  async eval(x) { const r = await this.send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value }
}

const page = await firstPage()
const c = await CDP.open(page.webSocketDebuggerUrl)
await c.send('Runtime.enable'); await c.send('Page.enable')
await c.send('Page.navigate', { url: BASE + '/' }); await sleep(4500)
await c.eval(`(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});const j=await r.json();const d=j.data||j;localStorage.setItem('mes_token',d.token);localStorage.setItem('mes_user',JSON.stringify(d.user||{}));localStorage.setItem('mes_login_date',new Date().toISOString().slice(0,10));localStorage.setItem('mes_factory',JSON.stringify(d.factory||{code:'HSDZ_MES',name:'YINJIA-MES'}));return !!d.token})()`)
await c.send('Page.navigate', { url: BASE + '/' }); await sleep(6500)

// 挂 fetch 记录(**在**面板加载前挂,覆盖后续所有请求)
await c.eval(`(()=>{
  window.__calls=[];
  const of=window.fetch;
  window.fetch=async function(u,opt){
    const url=typeof u==='string'?u:(u&&u.url)||'';
    const method=(opt&&opt.method)||'GET';
    let body=null; try{ body=opt&&opt.body?String(opt.body).slice(0,400):null }catch{}
    const r=await of.apply(this,arguments);
    let txt=''; try{ txt=(await r.clone().text()).slice(0,300) }catch{}
    window.__calls.push({url,method,status:r.status,body,txt});
    return r;
  };
  return 'hooked';
})()`)

await c.eval(`location.hash = '#/panelx/list/QC_PROC_INSP'`); await sleep(10000)
console.log('面板 =', JSON.stringify(await c.eval(`(()=>({status:[...document.querySelectorAll('.doc-status')].map(e=>e.textContent.trim()),no:((document.body.innerText||'').match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[])[0]||null,hasAct:!!document.querySelector('.qr-band-act2')}))()`)))

// 加表区 + 填两个值
console.log('加表区 =', JSON.stringify(await c.eval(`(async()=>{
  const btn=[...document.querySelectorAll('.qr-band-act2,.qr-add-btn')].find(e=>/新增表区/.test(e.textContent||''));
  if(!btn) return {err:'no add btn'};
  btn.click(); await new Promise(r=>setTimeout(r,700));
  const box=document.querySelector('.el-message-box'); if(!box) return {err:'no prompt'};
  const inp=box.querySelector('input'); const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  d.call(inp,'尺寸'); inp.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,200));
  [...box.querySelectorAll('button')].find(b=>/确定|OK/.test(b.textContent||'')).click();
  await new Promise(r=>setTimeout(r,1200));
  return {cols:document.querySelectorAll('.qr-grid thead th.c-item-hd').length, inputs:document.querySelectorAll('.qr-grid tbody td.c-val input').length};
})()`)))

console.log('填值 =', JSON.stringify(await c.eval(`(async()=>{
  const ins=[...document.querySelectorAll('.qr-grid tbody td.c-val input')];
  const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  for(let i=0;i<ins.length;i++){ d.call(ins[i], String(20+i)); ins[i].dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,100)); }
  const n=document.querySelector('.qr-grid thead th.c-item-hd input'); if(n){ d.call(n,'外径'); n.dispatchEvent(new Event('input',{bubbles:true})); }
  await new Promise(r=>setTimeout(r,300));
  return {values:ins.map(i=>i.value), name:n?n.value:null};
})()`)))

console.log('侧栏按钮 =', JSON.stringify(await c.eval(`[...document.querySelectorAll('.as-side-btn')].filter(e=>e.offsetParent!==null).map(e=>(e.textContent||'').trim()+'|'+(e.className))`)))

console.log('点保存为草稿 =', JSON.stringify(await c.eval(`(async()=>{
  window.__calls=[];
  const btn=[...document.querySelectorAll('.as-side-btn')].find(e=>/^保存为草稿$/.test((e.textContent||'').trim()));
  if(!btn) return {err:'no btn'};
  btn.click();
  await new Promise(r=>setTimeout(r,6000));
  return {calls: window.__calls.map(c=>c.method+' '+c.url+' -> '+c.status).slice(-8),
          no:((document.body.innerText||'').match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[])[0]||null};
})()`)))

console.log('点主「保存」 =', JSON.stringify(await c.eval(`(async()=>{
  window.__calls=[];
  const btns=[...document.querySelectorAll('.as-side-btn')].filter(e=>e.offsetParent!==null);
  const btn=btns.find(e=>/^保存$/.test((e.textContent||'').trim()));
  if(!btn) return {err:'no btn'};
  const cls=btn.className;
  btn.click();
  await new Promise(r=>setTimeout(r,8000));
  return {cls, calls: window.__calls.map(c=>c.method+' '+c.url+' -> '+c.status).slice(-8),
          bodies: window.__calls.map(c=>c.body).filter(Boolean).slice(-2),
          texts: window.__calls.map(c=>c.txt).filter(Boolean).slice(-2),
          no:((document.body.innerText||'').match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[])[0]||null};
})()`)))

console.log('全部请求(含填值前后) =', JSON.stringify(await c.eval(`window.__calls.map(c=>c.method+' '+c.url+' -> '+c.status).slice(-25)`)))
console.log('控制台 =', JSON.stringify(c.logs.filter(l=>/EXC|error/.test(l)).slice(-6)))
edge.kill()
