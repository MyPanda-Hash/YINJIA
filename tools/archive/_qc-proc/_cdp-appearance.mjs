#!/usr/bin/env node
/**
 * CDP 取证探针(2026-10-16):「外观」表区按检验项出列 —— 有多少个外观检验项就有多少列。
 *
 * 路径(全程**不保存**):
 *   ① 进制程检验单,翻到有明细的那张;
 *   ② 记下横表各表区的列数与列名;
 *   ③ 点分区带右上「带入检验项目」→ 弹窗里选 QP-CARBON-ROD 方案 → 勾选"检验内容=外观"的项;
 *   ④ 点「带入明细」;
 *   ⑤ 再看横表:外观组的列数应 = 原列数 + 勾选的外观项数,且新增列名 = 勾选项的项目名称。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-appearance.mjs [baseUrl] [outJson]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9226
const BASE = process.argv[2] || 'http://localhost:5173'
const OUT = process.argv[3] || 'tools/archive/_qc-proc/appearance-probe.json'
const PANEL = 'QC_PROC_INSP'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { base: BASE, steps: [] }
const log = (k, v) => { report.steps.push({ step: k, ...(typeof v === 'object' && v !== null ? v : { value: v }) }); console.log(k, JSON.stringify(v)) }

const profile = mkdtempSync(join(tmpdir(), 'cdp-app-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1700,1000',
  'about:blank',
], { stdio: 'ignore' })

async function firstPage() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const pages = list.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl && !/^edge:\/\//.test(t.url))
      const p = pages.find((t) => t.url === 'about:blank') || pages[0]
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
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails
        c.logs.push('[EXCEPTION] ' + (d.exception?.description || d.text))
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

const SNAPSHOT = `(()=>{
  const out={};
  out.docNo=((document.body.innerText||'').match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[null])[0];
  out.groups=[...document.querySelectorAll('.qr-grid thead tr:first-child th.c-group')].map(th=>({
    title:(th.textContent||'').replace(/\\s+/g,' ').trim(), cols:Number(th.getAttribute('colspan')||1)
  }));
  const itemThs=[...document.querySelectorAll('.qr-grid thead tr:nth-child(2) th.c-sub')];
  out.items=itemThs.map(th=>({
    name:(th.querySelector('input')?.value??th.textContent??'').replace(/\\s+/g,' ').trim(),
    cells:(th.querySelector('.qr-cells-n')?.textContent||'').trim()
  }));
  return out;
})()`

const OPEN_PICK = `(()=>{const el=document.querySelector('.qr-band-act');if(!el)return false;el.click();return true})()`

const PICK_PLAN = `(async()=>{
  const dlg=[...document.querySelectorAll('.el-dialog')].find(d=>d.offsetParent!==null && /检验项目/.test(d.textContent||''));
  if(!dlg) return {ok:false, why:'弹窗没开'};
  const tables=[...dlg.querySelectorAll('.el-table')];
  // 上表 = 方案;找到方案编码或名称里带 CARBON 的那行并点它
  const planRows=[...tables[0].querySelectorAll('tbody tr.el-table__row')];
  const names=planRows.map(r=>(r.innerText||'').replace(/\\s+/g,' ').trim().slice(0,40));
  const hit=planRows.find(r=>/CARBON|炭棒/i.test(r.innerText||''));
  if(!hit) return {ok:false, why:'没找到炭棒方案', names};
  hit.click();
  await new Promise(r=>setTimeout(r,2500));
  return {ok:true, plans:names, picked:hit.innerText.replace(/\\s+/g,' ').trim().slice(0,40)};
})()`

const TICK_APPEARANCE = `(async()=>{
  const dlg=[...document.querySelectorAll('.el-dialog')].find(d=>d.offsetParent!==null && /检验项目/.test(d.textContent||''));
  if(!dlg) return {ok:false, why:'弹窗没开'};
  const tables=[...dlg.querySelectorAll('.el-table')];
  const rows=[...tables[1].querySelectorAll('tbody tr.el-table__row')];
  const listed=rows.map(r=>(r.innerText||'').replace(/\\s+/g,' ').trim().slice(0,50));
  let ticked=0;
  for(const r of rows){
    const txt=(r.innerText||'').replace(/\\s+/g,' ');
    // 检验内容列 = 外观(避开「外观-端盖两头」这类项目名里的字样:按单元格精确判)
    const tds=[...r.querySelectorAll('td')];
    const cell=tds.map(td=>(td.innerText||'').trim());
    const isAppearance=cell.some(c=>c==='外观');
    if(!isAppearance) continue;
    const cb=r.querySelector('.el-checkbox');
    if(cb){ cb.click(); ticked++; }
  }
  await new Promise(r=>setTimeout(r,600));
  return {ok:true, listed, ticked, count:(dlg.querySelector('.qcplan-count')?.textContent||'').replace(/\\s+/g,' ').trim()};
})()`

const CONFIRM_PICK = `(async()=>{
  const dlg=[...document.querySelectorAll('.el-dialog')].find(d=>d.offsetParent!==null && /检验项目/.test(d.textContent||''));
  if(!dlg) return {ok:false, why:'弹窗没开'};
  const btn=[...dlg.querySelectorAll('button')].find(b=>/带入明细/.test(b.textContent||''));
  if(!btn) return {ok:false, why:'没有「带入明细」按钮'};
  if(btn.disabled) return {ok:false, why:'按钮 disabled(没勾上)'};
  btn.click();
  await new Promise(r=>setTimeout(r,2500));
  return {ok:true};
})()`

try {
  const page = await firstPage()
  const c = await CDP.open(page.webSocketDebuggerUrl)
  await c.send('Runtime.enable'); await c.send('Page.enable')

  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(4500)
  await c.eval(`(async()=>{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});
    const j=await r.json(); const d=j.data||j;
    localStorage.setItem('mes_token', d.token);
    localStorage.setItem('mes_user', JSON.stringify(d.user||{}));
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0,10));
    localStorage.setItem('mes_factory', JSON.stringify(d.factory||{code:'HSDZ_MES',name:'YINJIA-MES'}));
    return true;
  })()`)
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(6500)
  await c.eval(`location.hash = '#/panelx/list/${PANEL}'`)
  await sleep(9000)

  for (let i = 0; i < 16; i++) {
    const info = await c.eval(`({g: document.querySelectorAll('.qr-grid thead th.c-group').length})`)
    if (info.g > 0) break
    const moved = await c.eval(`(()=>{
      const byTitle=[...document.querySelectorAll('[title]')].find(x=>/下一张|下一页/.test(x.getAttribute('title')||''));
      const byText=[...document.querySelectorAll('.page-btn,button,a,span')].find(x=>/^▶$/.test((x.textContent||'').trim()));
      const el=byTitle||byText; if(!el) return null; el.click(); return true;
    })()`)
    if (!moved) break
    await sleep(2500)
  }

  const before = await c.eval(SNAPSHOT)
  log('before', before)

  log('openPick', await c.eval(OPEN_PICK))
  await sleep(2500)
  log('pickPlan', await c.eval(PICK_PLAN))
  log('tickAppearance', await c.eval(TICK_APPEARANCE))
  log('confirmPick', await c.eval(CONFIRM_PICK))
  await sleep(1500)

  const after = await c.eval(SNAPSHOT)
  log('after', after)

  const gBefore = (before.groups.find((g) => /外观/.test(g.title)) || {}).cols || 0
  const gAfter = (after.groups.find((g) => /外观/.test(g.title)) || {}).cols || 0
  report.conclusion = {
    外观列数_前: gBefore, 外观列数_后: gAfter, 新增列: gAfter - gBefore,
    外观列名_后: after.items.map((i) => i.name),
    结论: gAfter > gBefore ? '✅ 勾了几个外观项就多出几列' : '❌ 外观列数没变(需排查)',
  }
  console.log('结论', JSON.stringify(report.conclusion))
  const errs = c.logs.filter((l) => !/rdFlow/.test(l))
  report.exceptions = errs.slice(-10)
  writeFileSync(OUT, JSON.stringify(report, null, 2))
} finally {
  try { edge.kill() } catch {}
}
