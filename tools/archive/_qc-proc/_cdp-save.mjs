#!/usr/bin/env node
/**
 * CDP 落库探针(2026-10-16):验证「格数」真的能存能取(不是只改内存)。
 *
 * 步骤(会**真的保存**当前那张有明细的制程检验单):
 *   ① 进面板 → 翻到有明细的那张(ZC-2026-10-0002);
 *   ② 找一列格数=5 的(尺寸/重量类),点列头「−」→ 应变成 4;
 *   ③ 点工具栏「保存」;
 *   ④ 重新加载页面 → 该列格数应仍为 4(证明是从库里读回来的,不是内存残留)。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-save.mjs [baseUrl]
 * 事后还原: UPDATE qc_proc_insp_detail SET 格数=5 WHERE id=<探针打印的行id>
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9225
const BASE = process.argv[2] || 'http://localhost:5173'
const PANEL = 'QC_PROC_INSP'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'cdp-save-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000',
  'about:blank',
], { stdio: 'ignore' })

async function firstPage() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      // ⚠ 不能用「列表里第一个 page」:全新 profile 会被 Edge 塞一个 edge://sync-confirmation-dialog/
      //   标签页(2026-10-16 实测把整个探针带偏,Page.navigate 打到了同步页上)
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
      if (m.method === 'Runtime.consoleAPICalled') {
        c.logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
      } else if (m.method === 'Runtime.exceptionThrown') {
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
  const ths=[...document.querySelectorAll('.qr-block-table th.c-item-hd')];
  return ths.map((th,i)=>({i, name:(th.querySelector('input')?.value??'').trim(), cells:(th.querySelector('.qr-cells-n')?.textContent||'').trim()}));
})()`

const PLUS_THREE = `(async()=>{
  const ths=[...document.querySelectorAll('.qr-block-table th.c-item-hd')];
  // 先由 SQL 把某行 格数 置 3 ⇒ 界面里只有这一列是 3 格,拿它做往返对象最确定
  const idx=ths.findIndex(th=>(th.querySelector('.qr-cells-n')?.textContent||'').trim()==='3');
  if(idx<0) return {ok:false, why:'没有格数=3 的列(SQL 预置没生效?)', nums:ths.map(th=>(th.querySelector('.qr-cells-n')?.textContent||'').trim()).join(',')};
  const th=ths[idx];
  const plus=[...th.querySelectorAll('.qr-cells-btn')][1];
  plus.click();
  await new Promise(r=>setTimeout(r,700));
  return {ok:true, idx, name:(th.querySelector('input')?.value??'').trim(), cells:(th.querySelector('.qr-cells-n')?.textContent||'').trim()};
})()`

const SAVE = `(async()=>{
  // 工具栏主按钮 = span.tb-main > span.act-name(不是 <button>;此前按 button 找命中的是整个工具栏容器)
  const mains=[...document.querySelectorAll('.tb-main')].filter(e=>e.offsetParent!==null);
  const btn=mains.find(e=>/^保存$/.test(((e.querySelector('.act-name')||e).textContent||'').trim()));
  if(!btn) return {clicked:false, candidates:mains.map(e=>((e.querySelector('.act-name')||e).textContent||'').trim()).slice(0,20)};
  btn.click();
  await new Promise(r=>setTimeout(r,6000));
  const toast=[...document.querySelectorAll('.el-message, .el-notification')].map(e=>(e.textContent||'').trim());
  return {clicked:true, toast};
})()`

const DOCNO = `(()=>{const t=document.body.innerText||'';const m=t.match(/ZC-\\d{4}-\\d{2}-\\d{4}/);return m?m[0]:null})()`

async function pageToDetails(c) {
  for (let i = 0; i < 16; i++) {
    const info = await c.eval(`({g: document.querySelectorAll('.qr-block').length})`)
    if (info.g > 0) return true
    const moved = await c.eval(`(()=>{
      const byTitle=[...document.querySelectorAll('[title]')].find(x=>/下一张|下一页/.test(x.getAttribute('title')||''));
      const byText=[...document.querySelectorAll('.page-btn,button,a,span')].find(x=>/^▶$/.test((x.textContent||'').trim()));
      const el=byTitle||byText; if(!el) return null; el.click(); return true;
    })()`)
    if (!moved) return false
    await sleep(2500)
  }
  return false
}

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
  const ok = await pageToDetails(c)
  console.log('① 翻到有明细的那张 =', ok, '| 单据号 =', await c.eval(DOCNO))

  console.log('② 保存前各列格数 =', JSON.stringify(await c.eval(SNAPSHOT)))
  console.log('③ 点列头「＋」 =', JSON.stringify(await c.eval(PLUS_THREE)))
  console.log('   点完各列格数 =', JSON.stringify(await c.eval(SNAPSHOT)))

  console.log('④ 点保存 =', JSON.stringify(await c.eval(SAVE)))

  console.log('⑤ 重新加载页面,看格数是否从库里读回来')
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(6500)
  await c.eval(`location.hash = '#/panelx/list/${PANEL}'`)
  await sleep(9000)
  await pageToDetails(c)
  console.log('   重载后 =', JSON.stringify(await c.eval(SNAPSHOT)))

  const errs = c.logs.filter((l) => /EXCEPTION|log\.error/.test(l) && !/rdFlow/.test(l))
  if (errs.length) { console.log('⑥ 控制台异常'); for (const e of errs.slice(-8)) console.log('   ' + e) }
} finally {
  try { edge.kill() } catch {}
}
