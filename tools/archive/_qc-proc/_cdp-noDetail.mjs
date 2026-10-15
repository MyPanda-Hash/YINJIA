#!/usr/bin/env node
/**
 * CDP 取证探针(2026-10-16):「检验项目明细」整块已删除 + 分区带右上两个动作在手。
 *
 * 期望:
 *   detailTableGone = true   (不存在 table.qr-ungroup / 检验项目明细 band)
 *   bandActs        = ['＋ 新增表区', '⧉ 带入检验项目']
 *   gridCols        = 各组列数(与删表前一致)
 *   addTableWorks   = 点「＋ 新增表区」能弹出输入框(取消即可,不落任何数据)
 *
 * 用法: node tools/archive/_qc-proc/_cdp-noDetail.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9228
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = 'QC_PROC_INSP'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'cdp-nd-'))
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

const CHECK = `(()=>{
  const txt=(document.body.innerText||'');
  return {
    detailTableGone: !document.querySelector('table.qr-ungroup'),
    detailBandGone: !/检验项目明细/.test(txt),
    oldAddRowGone: !document.querySelector('.qr-add-row') && !document.querySelector('.qr-add-btn'),
    bandActs: [...document.querySelectorAll('.qr-band-act2')].map(e=>(e.textContent||'').trim()),
    groups: [...document.querySelectorAll('.qr-grid thead th.c-group')].map(th=>({t:(th.textContent||'').replace(/\\s+/g,' ').trim(), cols:Number(th.getAttribute('colspan')||1)})),
    itemCols: document.querySelectorAll('.qr-grid thead th.c-sub').length,
    cellsNums: [...document.querySelectorAll('.qr-cells-n')].map(e=>e.textContent.trim()).join(','),
    bodyRows: document.querySelectorAll('.qr-grid tbody tr').length,
    footOk: !!document.querySelector('.qr-foot-table')
  };
})()`

const CLICK_ADD_TABLE = `(async()=>{
  const el=[...document.querySelectorAll('.qr-band-act2')].find(e=>/新增表区/.test(e.textContent||''));
  if(!el) return {ok:false, why:'分区带里没有「＋新增表区」'};
  el.click();
  await new Promise(r=>setTimeout(r,1200));
  const box=document.querySelector('.el-message-box');
  const title=box? (box.querySelector('.el-message-box__title')?.textContent||'').trim() : '';
  const hasInput=!!(box && box.querySelector('input'));
  const cancel=box ? [...box.querySelectorAll('button')].find(b=>/取消/.test(b.textContent||'')) : null;
  if(cancel) cancel.click();
  await new Promise(r=>setTimeout(r,600));
  return {ok:true, dialogTitle:title, hasInput, canceled:!!cancel, stillOpen:!!document.querySelector('.el-message-box')};
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
    const info = await c.eval(`({g: document.querySelectorAll('.qr-grid thead th.c-group').length, t: document.querySelectorAll('table').length})`)
    if (info.g > 0) break
    const moved = await c.eval(`(()=>{
      const byTitle=[...document.querySelectorAll('[title]')].find(x=>/下一张|下一页/.test(x.getAttribute('title')||''));
      const byText=[...document.querySelectorAll('.page-btn,button,a,span')].find(x=>/^▶$/.test((x.textContent||'').trim()));
      const el=byTitle||byText; if(!el) return null; el.click(); return true;
    })()`)
    if (!moved) break
    await sleep(2500)
  }

  console.log('① 结构 =', JSON.stringify(await c.eval(CHECK)))
  console.log('② 点「＋新增表区」 =', JSON.stringify(await c.eval(CLICK_ADD_TABLE)))
  console.log('③ 再查结构 =', JSON.stringify(await c.eval(CHECK)))
  const errs = c.logs.filter((l) => !/before initialization/.test(l))
  console.log('④ 异常 =', errs.length ? errs.slice(-5).join(' | ') : '(无)')
} finally {
  try { edge.kill() } catch {}
}
