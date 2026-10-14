#!/usr/bin/env node
/**
 * CDP 真实点击探针(2026-10-15)
 * 用途:制程检验单「＋新增检验项」点了没反应 —— 用无头 Edge 真点一次并取证:
 *       点击前后行数/单元格数、控制台报错与异常、页面路由与登录态。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-probe.mjs
 * 前提:8090 在跑;本机有 Edge。
 * 要点:应用是 **hash 路由**(整页深链会被服务端 403),故先 / 打开 → 驱动登录表单
 *       → 再用 location.hash 进面板(不整页重载,保住登录态)。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9223
const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:8090'
const PANEL = 'QC_PROC_INSP'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,900',
  'about:blank',
], { stdio: 'ignore' })

async function firstPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (p) return p
    } catch {}
    await sleep(250)
  }
  throw new Error('Edge CDP 未就绪')
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = [] }
  static async open(url) {
    const ws = new WebSocket(url)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')) })
    const c = new CDP(ws)
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && c.pending.has(m.id)) {
        const { res, rej } = c.pending.get(m.id); c.pending.delete(m.id)
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
        return
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        c.logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails
        c.logs.push('[EXCEPTION] ' + (d.exception?.description || d.text))
      } else if (m.method === 'Log.entryAdded') {
        const e = m.params.entry
        if (e.level === 'error') c.logs.push('[log.error] ' + e.text)
      }
    }
    return c
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
}

const LOGIN_FORM = `(async()=>{
  const setV=(el,v)=>{
    const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    d.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const ins=[...document.querySelectorAll('input')];
  const acc=ins.find(i=>i.type==='text'||i.type==='');
  const pwd=ins.find(i=>i.type==='password');
  if(acc) setV(acc,'admin');
  if(pwd) setV(pwd,'123456');
  await new Promise(r=>setTimeout(r,500));
  const btn=[...document.querySelectorAll('button')].find(b=>/进入系统|登\\s*录/.test(b.textContent||''));
  if(btn) btn.click();
  return {inputs:ins.length, acc:!!acc, pwd:!!pwd, btn:!!btn, hash:location.hash};
})()`

const PROBE = `(async()=>{
  const out={};
  out.hash=location.hash;
  out.btnFound=!!document.querySelector('.qr-add-btn');
  out.gridFound=!!document.querySelector('.qr-grid');
  out.addRowBtn=[...document.querySelectorAll('.qr-add-btn')].map(b=>b.textContent.trim()).join(' | ');
  out.grpAddButtons=document.querySelectorAll('.qr-grp-add').length;
  const rowN=()=>document.querySelectorAll('.qr-grid tbody tr').length;
  const cellN=()=>document.querySelectorAll('.qr-grid tbody .qr-cell-text').length;
  const inpN=()=>document.querySelectorAll('.qr-sheet input, .qr-sheet textarea').length;
  const emptyN=()=>document.querySelectorAll('.qr-grid .c-empty').length;
  out.rowsBefore=rowN(); out.cellsBefore=cellN(); out.inputsBefore=inpN(); out.emptyBefore=emptyN();
  const btn=document.querySelector('.qr-add-btn');
  if(btn){
    btn.click();
    await new Promise(r=>setTimeout(r,800));
    out.rowsAfter=rowN(); out.cellsAfter=cellN(); out.inputsAfter=inpN(); out.emptyAfter=emptyN();
  }
  return out;
})()`

try {
  const page = await firstPage()
  const c = await CDP.open(page.webSocketDebuggerUrl)
  await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Page.enable')

  console.log('① 打开应用')
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(4500)

  console.log('② 接口登录 + 写 localStorage')
  const tok = await c.eval(`(async()=>{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});
    const j=await r.json(); const d=j.data||j;
    localStorage.setItem('mes_token', d.token);
    localStorage.setItem('mes_user', JSON.stringify(d.user||{}));
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0,10));
    localStorage.setItem('mes_factory', JSON.stringify(d.factory||{code:'HSDZ_MES',name:'YINJIA-MES'}));
    return {token:!!d.token, keys:Object.keys(localStorage).join(',')};
  })()`)
  console.log('   ', JSON.stringify(tok))
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(7000)
  console.log('   重载后 hash =', await c.eval('location.hash'))

  console.log('③ hash 进面板 ' + PANEL)
  await c.eval(`location.hash = '#/panelx/list/${PANEL}'`)
  await sleep(9000)
  const st = await c.eval(`({hash:location.hash, rows:document.querySelectorAll('.qr-grid tbody tr').length, btn:!!document.querySelector('.qr-add-btn'), body:(document.body.innerText||'').slice(0,200)})`)
  console.log('   页面 =', JSON.stringify(st))

  console.log('④ 真点「＋新增检验项」')
  const r = await c.eval(PROBE)
  for (const [k, v] of Object.entries(r)) console.log(`   ${k} = ${JSON.stringify(v)}`)

  console.log('⑤ 控制台')
  if (c.logs.length) for (const l of c.logs.slice(-25)) console.log('   ' + l)
  else console.log('   (无输出)')

  console.log('\n结论:', (r.inputsAfter > r.inputsBefore || r.emptyAfter < r.emptyBefore) ? '✅ 点得动(新增行已渲染)' : '❌ 点击未产生新行')
} finally {
  try { edge.kill() } catch {}
}
