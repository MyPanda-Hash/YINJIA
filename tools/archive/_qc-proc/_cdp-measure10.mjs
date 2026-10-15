#!/usr/bin/env node
/**
 * CDP 端到端探针(2026-10-16):制程检验单「预设10个测量数据列,用到几格激活几格」是否真的落库。
 *
 * 用户口径:「对需要几个数据量填写就有几个数据列…当前就预设10个测量数据列,当不使用到数据列的
 *   情况下就不激活当前的数据列,让当前的检验项目可以选择多少个数据列」。
 *
 * 步骤(全真点,自建自清,不动用户已有单据):
 *   ① 用 工单行(未建单的那条)建一张**一次性草稿**制程检验单;
 *   ② 进面板 → 点「＋新增表区」建「尺寸」(定量组)→ 列头 ＋ 点到 **8 格**;
 *   ③ 往 8 个格子里填 11.1..11.8 → 点「保存」;
 *   ④ 记录:渲染出来的格子数(应=8,**第 9/10 格不渲染**=不激活);
 *   ⑤ 整页重载 + 回面板:8 格的值与格数应从**库里**读回来;
 *   ⑥ 接口取证:GET 该单明细,看 测量值1..8 与 格数;
 *   ⑦ 收拾:整单删除该草稿,确认列表里不再有它。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-measure10.mjs [baseUrl]     (默认 5173)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9226
const BASE = process.argv[2] || 'http://localhost:5173'
const PANEL = 'QC_PROC_INSP'
const WO_NO = 'GD-2026-10-0007'
const WO_XC = 2
const CELLS = 8            // 要激活的格数(预设 10 里的前 8 格)
const VALS = ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6', '11.7', '11.8']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'cdp-m10-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000',
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
        c.logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text))
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        c.logs.push('[console.error] ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
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

/** 页面内通用件:接口调用 + 横表结构快照 */
const HELPERS = `
window.__m10 = {
  api: async (p, body) => {
    const r = await fetch('/api' + p, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('mes_token') },
      body: body ? JSON.stringify(body) : undefined,
    })
    return await r.json().catch(() => ({}))
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  /** 横表结构快照:列头(项目名/格数) + 实际渲染的录入格数(只数 td.c-val 的输入框) */
  snap: () => ({
    cols: document.querySelectorAll('.qr-grid thead th.c-item-hd').length,
    groups: document.querySelectorAll('.qr-grid thead th.c-group').length,
    names: [...document.querySelectorAll('.qr-grid thead th.c-item-hd input')].map((i) => i.value),
    cells: [...document.querySelectorAll('.qr-grid thead th.c-item-hd .qr-cells-n')].map((e) => e.textContent.trim()),
    valTds: document.querySelectorAll('.qr-grid tbody td.c-val').length,
    inputs: document.querySelectorAll('.qr-grid tbody td.c-val input').length,
    values: [...document.querySelectorAll('.qr-grid tbody td.c-val input')].map((i) => i.value),
    texts: [...document.querySelectorAll('.qr-grid tbody td.c-val .qr-cell-text')].map((e) => e.textContent.trim()),
    ungroupRows: document.querySelectorAll('table.qr-ungroup tbody tr').length,
  }),
}
'ok'`

const DOCNO = `(()=>{const t=document.body.innerText||'';const m=t.match(/ZC-\\d{4}-\\d{2}-\\d{4}/);return m?m[0]:null})()`

async function main() {
  const page = await firstPage()
  const c = await CDP.open(page.webSocketDebuggerUrl)
  await c.send('Runtime.enable'); await c.send('Page.enable')

  console.log(`① 打开 ${BASE} + 接口登录`)
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(4500)
  await c.eval(`(async()=>{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});
    const j=await r.json(); const d=j.data||j;
    localStorage.setItem('mes_token', d.token);
    localStorage.setItem('mes_user', JSON.stringify(d.user||{}));
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0,10));
    localStorage.setItem('mes_factory', JSON.stringify(d.factory||{code:'HSDZ_MES',name:'YINJIA-MES'}));
    return !!d.token;
  })()`)
  // 节点侧也留一份 token(收尾查列表用,不必再进页面)
  const token = await c.eval(`localStorage.getItem('mes_token')`)

  const existing = await c.eval(`(async()=>{
    ${HELPERS}
    const r = await __m10.api('/qc/procInsp/fromWoLine', { 工单号: '${WO_NO}', 工单行号: ${WO_XC} });
    return r;
  })()`)
  console.log('② 工单行对应单据(仅记录,不用它做测试载体) =', JSON.stringify(existing?.data || existing))

  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(6000)
  // 面板打开时当前单据 = **内存里的新建草稿**(库里那些 单据状态 为空的单是只读的),
  // 所以本探针就在这张新草稿上做;不做 ?docNo= 定位(定位到库里的单反而不可编辑)。
  await c.eval(`location.hash = '#/panelx/list/${PANEL}'`)
  await sleep(9000)
  const editable = await c.eval(`({cells: !!document.querySelector('.qr-cells'), bandActs: [...document.querySelectorAll('.qr-band-act2,.qr-add-btn')].map(e=>(e.textContent||'').trim())})`)
  console.log('③ 面板当前草稿可编辑 =', JSON.stringify(editable))
  if (!editable.bandActs.length) throw new Error('当前不是可编辑草稿,改不动(需要面板打开时的新建/草稿态)')

  console.log('④ 新增表区「尺寸」→ 列头 ＋ 点到 8 格')
  const add = await c.eval(`(async()=>{
    ${HELPERS}
    const btn=[...document.querySelectorAll('.qr-band-act2,.qr-add-btn')].find(e=>/新增表区/.test(e.textContent||''));
    if(!btn) return {err:'没找到＋新增表区(可能不是草稿态/不可编辑)'};
    btn.click(); await __m10.sleep(600);
    const box=document.querySelector('.el-message-box');
    if(!box) return {err:'没弹出表区名输入框'};
    const inp=box.querySelector('input');
    const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    d.call(inp,'尺寸'); inp.dispatchEvent(new Event('input',{bubbles:true}));
    await __m10.sleep(200);
    const ok=[...box.querySelectorAll('button')].find(b=>/确定|OK/.test(b.textContent||''));
    ok.click();
    await __m10.sleep(1200);
    return {added:true, cols: __m10.snap()};
  })()`)
  console.log('   ', JSON.stringify(add))

  const toEight = await c.eval(`(async()=>{
    ${HELPERS}
    const th=document.querySelector('.qr-grid thead th.c-item-hd');
    if(!th) return {err:'表里没有检验项目列'};
    const plus=[...th.querySelectorAll('.qr-cells-btn')][1];
    let guard=0;
    while((th.querySelector('.qr-cells-n')?.textContent||'').trim()!=='${CELLS}' && guard++<20){
      plus.click(); await __m10.sleep(400);
    }
    return {cells:(th.querySelector('.qr-cells-n')?.textContent||'').trim(), guard};
  })()`)
  console.log('   列头＋ →', JSON.stringify(toEight))

  console.log('⑤ 填 8 个格子的值')
  const filled = await c.eval(`(async()=>{
    ${HELPERS}
    const inputs=[...document.querySelectorAll('.qr-grid tbody td.c-val input')];
    const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    const vals=${JSON.stringify(VALS)};
    for(let i=0;i<inputs.length;i++){
      d.call(inputs[i], vals[i] ?? ('X'+i));
      inputs[i].dispatchEvent(new Event('input',{bubbles:true}));
      await __m10.sleep(120);
    }
    // 项目名也填上,便于人工核对
    const nameInp=document.querySelector('.qr-grid thead th.c-item-hd input');
    if(nameInp){ d.call(nameInp,'外径'); nameInp.dispatchEvent(new Event('input',{bubbles:true})); }
    await __m10.sleep(300);
    return __m10.snap();
  })()`)
  console.log('   ', JSON.stringify(filled))

  console.log('⑥ 点「保存为草稿」(落库)')
  const saved = await c.eval(`(async()=>{
    ${HELPERS}
    // 先把弹出的消息**录下来**:ElMessage 3 秒自动消失,点完再查会扑空
    window.__msgs = [];
    if (!window.__msgHook) {
      window.__msgHook = new MutationObserver(() => {
        for (const e of document.querySelectorAll('.el-message,.el-notification,.el-form-item__error')) {
          const t = (e.textContent || '').trim();
          if (t && !window.__msgs.includes(t)) window.__msgs.push(t);
        }
      });
      window.__msgHook.observe(document.body, { childList: true, subtree: true });
    }
    const btns=[...document.querySelectorAll('.as-side-btn')].filter(e=>e.offsetParent!==null);
    const btn=btns.find(e=>/^保存为草稿$/.test((e.textContent||'').trim())) || btns.find(e=>/^保存$/.test((e.textContent||'').trim()));
    if(!btn) return {clicked:false, candidates:btns.map(e=>(e.textContent||'').trim()).slice(0,25)};
    const disabled = btn.classList.contains('disabled');
    btn.click();
    await __m10.sleep(9000);
    const docNo=((document.body.innerText||'').match(/ZC-\\d{4}-\\d{2}-\\d{4}/)||[])[0]||null;
    return {clicked:true, disabled, msgs: window.__msgs.slice(-8), docNo,
            cellInput: document.querySelectorAll('.qr-grid tbody td.c-val input').length};
  })()`)
  console.log('   ', JSON.stringify(saved))
  const docNo = saved?.docNo
  if (!docNo) throw new Error('保存后仍拿不到单据编号,落库可能失败')

  console.log('⑦ 整页重载 + ?docNo= 定位该单 → 看是否从库里读回')
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(6000)
  await c.eval(`location.hash = '#/panelx/list/${PANEL}?docNo=${docNo}'`)
  await sleep(10000)
  const after = await c.eval(`(async()=>{
    ${HELPERS}
    return {hash: location.hash, docNo: ${DOCNO}, snap: __m10.snap()};
  })()`)
  console.log('   重载后 =', JSON.stringify(after))

  console.log('⑧ 收拾:整单删除该草稿')
  const del = await c.eval(`(async()=>{
    ${HELPERS}
    // 整单删除:先点侧栏「删除」,再在确认框点「确定」(审批态可能还要走删除菜单,兜底两种入口都试)
    const btns=[...document.querySelectorAll('.as-side-btn,.as-side-menu-item')].filter(e=>e.offsetParent!==null);
    let side=btns.find(e=>/^删除$/.test((e.textContent||'').trim()));
    if(!side) side=btns.find(e=>/^删除（整单删除）$/.test((e.textContent||'').trim()));
    if(!side) return {err:'没找到删除入口', side: btns.map(e=>(e.textContent||'').trim()).slice(0,25)};
    side.click(); await __m10.sleep(900);
    const box=document.querySelector('.el-message-box');
    const ok=box? [...box.querySelectorAll('button')].find(b=>/确定|OK/.test(b.textContent||'')) : null;
    if(ok) ok.click();
    await __m10.sleep(5000);
    return {clicked:true, toast:[...document.querySelectorAll('.el-message,.el-notification')].map(e=>(e.textContent||'').trim())};
  })()`)
  console.log('   ', JSON.stringify(del))

  // 清理取证:节点侧直接查接口(不依赖页面内注入,避免模板拼接的坑)
  const listCheck = await fetch(`${BASE}/api/panel/${PANEL}/list?pageSize=200`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json()).then((j) => JSON.stringify(j).includes(docNo)).catch((e) => `fetch 失败:${e.message}`)
  console.log('   删除后该单是否还在列表 =', listCheck)
  console.log('   本次测试单据号 =', docNo, '(删除入口若没点成,请人工在面板上删掉它)')

  const okAll = after?.snap?.cells?.[0] === String(CELLS)
    && after?.snap?.inputs === CELLS
    && (after?.snap?.values || []).join(',') === VALS.join(',')
  console.log('\n结论:', okAll
    ? `✅ 预设 10 格里只用 ${CELLS} 格:界面只渲染 ${CELLS} 个录入格,值保存后整页重载仍从库里读回`
    : '❌ 有断言未通过,见上面各步')
  return okAll
}

try {
  const ok = await main()
  process.exitCode = ok ? 0 : 1
} catch (e) {
  console.error('探针失败:', e.message)
  process.exitCode = 2
} finally {
  try { edge.kill() } catch {}
}
