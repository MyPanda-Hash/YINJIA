#!/usr/bin/env node
/**
 * CDP 取证探针(2026-10-16):制程检验单横表「一个检验项目 = 一列,列内格数可加减」。
 *
 * 用途(只读,不保存):
 *   ① 横表是否按「一项一列」渲染:每组列数 = 该表区检验项数;
 *   ② 每列的格数是否 = 该行「格数」(尺寸/重量类 5 格、外观类 1 格),且列头有 −/＋ 调格器;
 *   ③ 组内「＋」是否能加出一列(内存态,不点保存);
 *   ④ 列头「−」是否把格数减到 4(内存态,不点保存);
 *   ⑤ 控制台有无报错/异常。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-grid.mjs [baseUrl]
 *       baseUrl 默认 http://localhost:5173(vite 源码即时生效);传 http://127.0.0.1:8090 查打包版。
 * 前提:目标服务在跑;本机有 Edge。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9224
const BASE = process.argv[2] || 'http://localhost:5173'
const PANEL = process.env.PROBE_PANEL || 'QC_PROC_INSP'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'cdp-grid-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000',
  'about:blank',
], { stdio: 'ignore' })

async function firstPage() {
  for (let i = 0; i < 80; i++) {
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

const INSPECT = `(()=>{
  const out = {};
  const grid = document.querySelector('.qr-grid');
  out.grid = !!grid;
  if (!grid) return out;
  // 组名(横跨本组各列)+ 组内列数
  const grpThs = [...grid.querySelectorAll('thead tr:first-child th.c-group')];
  out.groups = grpThs.map((th) => ({ title: (th.textContent || '').trim().replace(/\\s+/g, ' '), cols: Number(th.getAttribute('colspan') || 1) }));
  const itemThs = [...grid.querySelectorAll('thead tr:nth-child(2) th.c-sub')];
  // 每个 Item 列头:项目名 + 格数 + 是否有 −/＋
  const items = itemThs.map((th) => {
    const name = (th.querySelector('input')?.value ?? th.textContent ?? '').trim().replace(/\\s+/g, ' ');
    const n = (th.querySelector('.qr-cells-n')?.textContent || '').trim();
    return { name: name.slice(0, 24), cells: n, hasStep: !!th.querySelector('.qr-cells-btn') };
  });
  out.items = items;
  // 每列在 tbody 里真切出来的格数(表头下第一行数据,按列顺序)
  const body = grid.querySelector('tbody tr');
  out.firstRowCells = body ? [...body.querySelectorAll('td.c-val')].map((td) => ({ span: Number(td.getAttribute('rowspan') || 1), text: (td.querySelector('input')?.value ?? td.textContent ?? '').trim() })) : [];
  out.bodyRows = grid.querySelectorAll('tbody tr').length;
  out.fixedCols = [...grid.querySelectorAll('thead tr:first-child th.c-fixed')].map((th) => (th.textContent || '').trim());
  out.plainAddBtn = [...document.querySelectorAll('.qr-add-btn')].map((b) => (b.textContent || '').trim());
  out.grpAddButtons = grid.querySelectorAll('.qr-grp-add').length;
  out.bandHint = (document.querySelector('.qr-add-hint')?.textContent || '').trim();
  out.detailListRows = document.querySelectorAll('table.qr-ungroup tbody tr').length;
  return out;
})()`

const CLICK_GRP_ADD = `(async()=>{
  const grid = document.querySelector('.qr-grid');
  const th = grid.querySelector('thead tr:first-child th.c-group');
  const btn = th?.querySelector('.qr-grp-add');
  const before = grid.querySelectorAll('thead tr:nth-child(2) th.c-sub').length;
  if (!btn) return { clicked:false, before };
  btn.click();
  await new Promise(r=>setTimeout(r,900));
  const after = document.querySelectorAll('.qr-grid thead tr:nth-child(2) th.c-sub').length;
  return { clicked:true, before, after, dirty: !!document.querySelector('.doc-status.draft, .dirty-flag, .inline-dirty') };
})()`

const CLICK_MINUS = `(async()=>{
  const ths=[...document.querySelectorAll('.qr-grid thead tr:nth-child(2) th.c-sub')];
  const nums = () => ths.map((th)=>(th.querySelector('.qr-cells-n')?.textContent||'').trim()).join(',');
  const before = nums();
  // 挑一列格数 > 1 的(第一列往往是 1 格,按到下限不变化 ⇒ 测不出东西)
  const th = ths.find((x)=>Number((x.querySelector('.qr-cells-n')?.textContent||'0').trim())>1);
  if (!th) return { clicked:false, before, why:'没有格数>1 的列' };
  const idx = ths.indexOf(th);
  const minus=[...th.querySelectorAll('.qr-cells-btn')][0];
  minus.click();
  await new Promise(r=>setTimeout(r,700));
  return { clicked:true, idx, name:(th.querySelector('input')?.value??'').trim(), before, after: nums() };
})()`

try {
  const page = await firstPage()
  const c = await CDP.open(page.webSocketDebuggerUrl)
  await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Page.enable')

  console.log('① 打开应用 ' + BASE)
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(4500)

  const tok = await c.eval(`(async()=>{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});
    const j=await r.json(); const d=j.data||j;
    localStorage.setItem('mes_token', d.token);
    localStorage.setItem('mes_user', JSON.stringify(d.user||{}));
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0,10));
    localStorage.setItem('mes_factory', JSON.stringify(d.factory||{code:'HSDZ_MES',name:'YINJIA-MES'}));
    return {token: !!d.token};
  })()`)
  console.log('   登录 =', JSON.stringify(tok))
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(6000)

  console.log('② hash 进面板 ' + PANEL)
  await c.eval(`location.hash = '#/panelx/list/${PANEL}'`)
  await sleep(9000)
  let st = await c.eval(`({hash:location.hash, grid:!!document.querySelector('.qr-grid'), text:(document.body.innerText||'').slice(0,160)})`)
  console.log('   ', JSON.stringify(st))

  // 列表页默认停在最新那张(可能是空草稿):翻页直到明细出现(实测有明细的是 ZC-2026-10-0002)
  for (let i = 0; i < 16; i++) {
    const info = await c.eval(`({groups: document.querySelectorAll('.qr-grid thead th.c-group').length, rows: document.querySelectorAll('table.qr-ungroup tbody tr').length})`)
    if (info.groups > 0 || info.rows > 0) break
    const moved = await c.eval(`(()=>{
      const byTitle=[...document.querySelectorAll('[title]')].find(x=>/下一张|下一页/.test(x.getAttribute('title')||''));
      const byText=[...document.querySelectorAll('.page-btn,button,a,span')].find(x=>/^▶$/.test((x.textContent||'').trim()));
      const el=byTitle||byText; if(!el) return null; el.click(); return (el.getAttribute('title')||el.textContent||'').trim();
    })()`)
    if (!moved) { console.log('   (翻页按钮没找到)'); break }
    await sleep(2500)
  }

  console.log('③ 结构取证')
  const r = await c.eval(INSPECT)
  console.log(JSON.stringify(r, null, 2))

  console.log('④ 真点组内「＋」(应加出一列)')
  console.log('   ', JSON.stringify(await c.eval(CLICK_GRP_ADD)))
  console.log('   加列后结构 =', JSON.stringify(await c.eval(INSPECT)).slice(0, 600))

  console.log('⑤ 真点列头「−」(应把该列格数减 1)')
  console.log('   ', JSON.stringify(await c.eval(CLICK_MINUS)))

  console.log('⑥ 控制台')
  if (c.logs.length) for (const l of c.logs.slice(-20)) console.log('   ' + l)
  else console.log('   (无输出)')
} finally {
  try { edge.kill() } catch {}
}
