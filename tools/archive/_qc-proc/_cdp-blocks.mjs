#!/usr/bin/env node
/**
 * CDP 取证探针(2026-10-16 · 甲-2「每个表区 = 独立区块」版):
 *   ① 检验结果区是否渲成若干**独立区块**(每块一张自己的表:组名 / 按照检验项目填充 / 项目列 / 格子);
 *   ② 块内每列格数 = 该行「格数」(尺寸/重量类 5、外观类 1),列头有 −/＋ 调格器;
 *   ③ 点某块的「＋」→ 只有**那一块**多出一列(别的块列数不变);
 *   ④ 点格数>1 的列头「−」→ 该列格数 −1;
 *   ⑤ 下方「检验项目明细」表应已删除(不存在 table.qr-ungroup)。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-blocks.mjs [baseUrl] [outJson]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9227
const BASE = process.argv[2] || 'http://localhost:5173'
const OUT = process.argv[3] || 'tools/archive/_qc-proc/blocks-probe.json'
const PANEL = 'QC_PROC_INSP'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { base: BASE, steps: [] }
const log = (k, v) => { report.steps.push({ step: k, ...(typeof v === 'object' && v !== null ? v : { value: v }) }); console.log(k, JSON.stringify(v)) }

const profile = mkdtempSync(join(tmpdir(), 'cdp-blk-'))
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
  out.leftTable = !!document.querySelector('.qr-info');
  out.leftHeads = [...document.querySelectorAll('.qr-info thead th')].map(th=>(th.textContent||'').trim());
  out.verdict = !!document.querySelector('.qr-verdict');
  out.oldDetailTable = !!document.querySelector('table.qr-ungroup');
  out.addSection = !!document.querySelector('.qr-block-add');
  out.blocks = [...document.querySelectorAll('.qr-block')].map(b=>({
    title:(b.querySelector('.qr-block-title')?.textContent||'').replace(/\\s+/g,' ').trim(),
    label:(b.querySelector('.qr-block-label')?.textContent||'').trim(),
    cols:[...b.querySelectorAll('th.c-item-hd')].map(th=>({
      name:(th.querySelector('input')?.value ?? th.textContent ?? '').replace(/\\s+/g,' ').trim(),
      cells:(th.querySelector('.qr-cells-n')?.textContent||'').trim(),
      step: th.querySelectorAll('.qr-cells-btn').length
    })),
    bodyRows: b.querySelectorAll('tbody tr').length,
    cellsInFirstRow: b.querySelector('tbody tr') ? b.querySelectorAll('tbody tr')[0].querySelectorAll('td.c-val').length : 0
  }));
  return out;
})()`

/** 列头右上角「⋯」:点开项目参数浮层,应出现 检验要求/检验方法/单项判定 三个输入 */
const OPEN_MORE = `(async()=>{
  const more=document.querySelector('.qr-item-more');
  if(!more) return {ok:false, why:'列头没有 ⋯'};
  more.click();
  await new Promise(r=>setTimeout(r,900));
  const pops=[...document.querySelectorAll('.qr-param')];
  const labels=pops.length ? [...pops[0].querySelectorAll('label')].map(e=>e.textContent.trim()) : [];
  const inputs=pops.length ? pops[0].querySelectorAll('input,textarea').length : 0;
  // 关掉浮层,别影响后面的取证
  document.body.click();
  await new Promise(r=>setTimeout(r,400));
  return {ok:pops.length>0, labels, inputs, count:document.querySelectorAll('.qr-item-more').length};
})()`

const CLICK_ADD_IN_FIRST_BLOCK = `(async()=>{
  const b=document.querySelector('.qr-block');
  if(!b) return {clicked:false};
  const btn=b.querySelector('.qr-grp-add');
  if(!btn) return {clicked:false, why:'块里没有 ＋'};
  const colsOf=()=>[...document.querySelectorAll('.qr-block')].map(x=>x.querySelectorAll('th.c-item-hd').length).join(',');
  const before=colsOf();
  btn.click();
  await new Promise(r=>setTimeout(r,900));
  return {clicked:true, before, after:colsOf()};
})()`

const CLICK_MINUS = `(async()=>{
  const nums=()=>[...document.querySelectorAll('.qr-cells-n')].map(e=>e.textContent.trim()).join(',');
  const before=nums();
  const th=[...document.querySelectorAll('th.c-item-hd')].find(x=>Number((x.querySelector('.qr-cells-n')?.textContent||'0').trim())>1);
  if(!th) return {clicked:false, before, why:'没有格数>1 的列'};
  const name=(th.querySelector('input')?.value ?? '').trim();
  [...th.querySelectorAll('.qr-cells-btn')][0].click();
  await new Promise(r=>setTimeout(r,700));
  return {clicked:true, name, before, after:nums()};
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
    const info = await c.eval(`({b: document.querySelectorAll('.qr-block').length})`)
    if (info.b > 0) break
    const moved = await c.eval(`(()=>{
      const byTitle=[...document.querySelectorAll('[title]')].find(x=>/下一张|下一页/.test(x.getAttribute('title')||''));
      const byText=[...document.querySelectorAll('.page-btn,button,a,span')].find(x=>/^▶$/.test((x.textContent||'').trim()));
      const el=byTitle||byText; if(!el) return null; el.click(); return true;
    })()`)
    if (!moved) break
    await sleep(2500)
  }

  log('① 结构', await c.eval(SNAPSHOT))
  log('② 项目参数浮层(⋯)', await c.eval(OPEN_MORE))
  log('③ 块内加列', await c.eval(CLICK_ADD_IN_FIRST_BLOCK))
  log('④ 减格', await c.eval(CLICK_MINUS))
  log('⑤ 加列后结构', await c.eval(SNAPSHOT))
  report.exceptions = c.logs.filter((l) => !/rdFlow|before initialization/.test(l)).slice(-8)
  writeFileSync(OUT, JSON.stringify(report, null, 2))
} finally {
  try { edge.kill() } catch {}
}
