#!/usr/bin/env node
/**
 * CDP 真实点击探针 —— 「检验项目/检验方案」弹窗的**彻底删除**(2026-10-15)
 *
 * 用户口径:「当前检验单据的检验项目需要能实现删除,不能只可增加不可删除」。
 * 本探针不读源码、只真点:
 *   ① 单行删除(点行高亮 → 删除 → 确认)⇒ 该行从表里消失、接口不再返回;
 *   ② 方案删除(连带其下检验项目)⇒ 确认框报出条数,确认后方案与项目都没了;
 *   ③ 多选删除(勾选框 → 删除)⇒ 勾的几条一次删掉。
 * 全程用**一次性造数**(QP-PROBE-DEL / PRB-DEL-*),跑完自己收拾干净,不动真实标准库。
 *
 * 用法: node tools/archive/_qc-proc/_cdp-plan-del.mjs            # 默认打 5173
 *       PROBE_BASE=http://127.0.0.1:8090 node .../_cdp-plan-del.mjs
 * 前提:目标地址在跑;本机有 Edge。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9224
const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:5173'
const PANEL = process.env.PROBE_PANEL || 'QC_ASM_INSP'
const PLAN = 'QP-PROBE-DEL'
const ITEM_A = '探针删除项A'
const ITEM_B = '探针删除项B'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'cdp-del-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000',
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

/** 页面内通用小工具:造数/查数/点按钮(全部走真实接口与真实 DOM) */
const HELPERS = `
window.__pd = {
  tok: () => localStorage.getItem('mes_token'),
  api: async (p, body) => {
    const r = await fetch('/api' + p, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('mes_token') },
      body: body ? JSON.stringify(body) : undefined,
    })
    const j = await r.json().catch(() => ({}))
    return { status: r.status, body: j }
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  btn: (barIdx, text) => {
    const bars = document.querySelectorAll('.qcplan-bar')
    const bar = bars[barIdx]
    if (!bar) return null
    return [...bar.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === text) || null
  },
  planRow: (code) => [...document.querySelectorAll('.qcplan-sec')][0]
    ?.querySelectorAll('tbody tr')[[...document.querySelectorAll('.qcplan-sec')][0]
      .querySelectorAll('tbody tr')].findIndex((tr) => (tr.textContent || '').includes(code)) || null,
  rowByText: (secIdx, text) => {
    const sec = document.querySelectorAll('.qcplan-sec')[secIdx]
    if (!sec) return null
    return [...sec.querySelectorAll('tbody tr')].find((tr) => (tr.textContent || '').includes(text)) || null
  },
  confirmBox: () => document.querySelector('.el-message-box'),
  okBtn: () => {
    const box = document.querySelector('.el-message-box')
    if (!box) return null
    return [...box.querySelectorAll('button')].find((b) => /确定|OK/.test(b.textContent || '')) || null
  },
}
'ok'`

async function main() {
  const page = await firstPage()
  const c = await CDP.open(page.webSocketDebuggerUrl)
  await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Page.enable')

  console.log(`① 打开 ${BASE}`)
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(4500)

  console.log('② 接口登录取 token 写 localStorage')
  const tok = await c.eval(`(async()=>{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});
    const j=await r.json(); const d=j.data||j;
    localStorage.setItem('mes_token', d.token);
    localStorage.setItem('mes_user', JSON.stringify(d.user||{}));
    localStorage.setItem('mes_login_date', new Date().toISOString().slice(0,10));
    localStorage.setItem('mes_factory', JSON.stringify(d.factory||{code:'HSDZ_MES',name:'YINJIA-MES'}));
    return !!d.token;
  })()`)
  if (!tok) throw new Error('登录失败(admin/123456)')
  await c.send('Page.navigate', { url: BASE + '/' })
  await sleep(7000)

  console.log('③ 造一次性数据(QP-PROBE-DEL + 2 个项目)')
  const made = await c.eval(`(async()=>{
    ${HELPERS}
    const out={};
    // 先清掉上次残留(幂等重跑)
    const old=await __pd.api('/qc/inspPlan/items?all=1');
    const ids=(old.body.data||[]).filter(x=>String(x['项目编码']||'').startsWith('PRB-DEL-')).map(x=>x.id);
    if(ids.length) await __pd.api('/qc/inspPlan/itemDestroy',{ids});
    const plans=await __pd.api('/qc/inspPlan/plans?all=1');
    const p=(plans.body.data||[]).find(x=>x['方案编码']==='${PLAN}');
    if(p) await __pd.api('/qc/inspPlan/planDestroy',{id:p.id});
    const a=await __pd.api('/qc/inspPlan/planSave',{方案编码:'${PLAN}',方案名称:'探针删除方案',检验方式:'抽检'});
    out.plan=JSON.stringify(a.body).slice(0,120);
    const b=await __pd.api('/qc/inspPlan/itemSave',{方案编码:'${PLAN}',序号:10,项目编码:'PRB-DEL-A',项目名称:'${ITEM_A}',检验内容:'探针',检验标准:'>0',判定规则:'下限判定',标准下限:'1'});
    const d=await __pd.api('/qc/inspPlan/itemSave',{方案编码:'${PLAN}',序号:20,项目编码:'PRB-DEL-B',项目名称:'${ITEM_B}',检验内容:'探针',检验标准:'>0',判定规则:'下限判定',标准下限:'1'});
    out.itemA=b.status; out.itemB=d.status;
    return out;
  })()`)
  console.log('   ', JSON.stringify(made))

  console.log(`④ hash 进面板 ${PANEL}`)
  await c.eval(`location.hash = '#/panelx/list/${PANEL}'`)
  await sleep(9000)

  console.log('⑤ 打开「检验项目/检验方案」弹窗')
  const opened = await c.eval(`(async()=>{
    ${HELPERS}
    const want='检验项目/检验方案';
    const find=()=>[...document.querySelectorAll('.ctx-item,.as-side-menu-item')].find(e=>(e.textContent||'').trim()===want);
    let hit=find();
    if(!hit){
      for(const caret of [...document.querySelectorAll('.tb-caret')]){
        caret.click(); await __pd.sleep(300);
        hit=find(); if(hit) break;
      }
    }
    if(!hit){
      const cand=[...document.querySelectorAll('.as-side-btn,.tb-main')].find(e=>(e.textContent||'').trim()===want);
      hit=cand||null;
    }
    if(hit) hit.click();
    await __pd.sleep(1500);
    return {clicked: !!hit, dialog: !!document.querySelector('.qcplan-sec'),
            bars: document.querySelectorAll('.qcplan-bar').length,
            itemBtns: [...(document.querySelectorAll('.qcplan-bar')[1]?.querySelectorAll('button')||[])].map(b=>b.textContent.trim())};
  })()`)
  console.log('   ', JSON.stringify(opened))
  if (!opened?.dialog) throw new Error('弹窗没打开')

  console.log('⑥ 选中探针方案 → 单行删除 A')
  const r1 = await c.eval(`(async()=>{
    ${HELPERS}
    const row=__pd.rowByText(0,'${PLAN}');
    if(!row) return {err:'方案行没找到'};
    row.click(); await __pd.sleep(1200);
    const irow=__pd.rowByText(1,'${ITEM_A}');
    if(!irow) return {err:'项目行没找到', rows:[...document.querySelectorAll('.qcplan-sec')[1].querySelectorAll('tbody tr')].map(t=>t.textContent.trim().slice(0,30))};
    irow.click(); await __pd.sleep(400);
    const del=__pd.btn(1,'删除');
    const out={delDisabled: del? del.disabled : 'no-btn', before: [...document.querySelectorAll('.qcplan-sec')[1].querySelectorAll('tbody tr')].length};
    del.click(); await __pd.sleep(800);
    const box=__pd.confirmBox();
    out.confirmText= box? (box.querySelector('.el-message-box__message')?.textContent||'').trim() : null;
    const ok=__pd.okBtn(); out.ok=!!ok; if(ok) ok.click();
    await __pd.sleep(2000);
    out.after= [...document.querySelectorAll('.qcplan-sec')[1].querySelectorAll('tbody tr')].length;
    out.stillHasA= !!__pd.rowByText(1,'${ITEM_A}');
    const api=await __pd.api('/qc/inspPlan/items?planCode=${PLAN}&all=1');
    out.apiNames=(api.body.data||[]).map(x=>x['项目名称']);
    return out;
  })()`)
  console.log('   ', JSON.stringify(r1))

  console.log('⑦ 删方案(连带 B)—— 确认框应报条数')
  const r2 = await c.eval(`(async()=>{
    ${HELPERS}
    const out={};
    const del=__pd.btn(0,'删除');
    out.delDisabled= del? del.disabled : 'no-btn';
    del.click(); await __pd.sleep(800);
    const box=__pd.confirmBox();
    out.confirmText= box? (box.querySelector('.el-message-box__message')?.textContent||'').trim() : null;
    const ok=__pd.okBtn(); if(ok) ok.click();
    await __pd.sleep(2500);
    out.planRows= [...document.querySelectorAll('.qcplan-sec')[0].querySelectorAll('tbody tr')].map(t=>t.textContent.trim().slice(0,20));
    const plans=await __pd.api('/qc/inspPlan/plans?all=1');
    const items=await __pd.api('/qc/inspPlan/items?planCode=${PLAN}&all=1');
    out.apiPlanGone= !(plans.body.data||[]).some(x=>x['方案编码']==='${PLAN}');
    out.apiItemBCount= (items.body.data||[]).length;
    return out;
  })()`)
  console.log('   ', JSON.stringify(r2))

  console.log('⑧ 多选删除(勾选框 → 删除)')
  const r3 = await c.eval(`(async()=>{
    ${HELPERS}
    const out={};
    // 重新造一套:方案 + 2 项目
    await __pd.api('/qc/inspPlan/planSave',{方案编码:'${PLAN}',方案名称:'探针删除方案',检验方式:'抽检'});
    await __pd.api('/qc/inspPlan/itemSave',{方案编码:'${PLAN}',序号:10,项目编码:'PRB-DEL-A',项目名称:'${ITEM_A}',检验内容:'探针',检验标准:'>0',判定规则:'下限判定',标准下限:'1'});
    await __pd.api('/qc/inspPlan/itemSave',{方案编码:'${PLAN}',序号:20,项目编码:'PRB-DEL-B',项目名称:'${ITEM_B}',检验内容:'探针',检验标准:'>0',判定规则:'下限判定',标准下限:'1'});
    // 关掉再开弹窗,让它重载
    document.querySelector('.el-dialog__headerbtn')?.click();
    await __pd.sleep(600);
    const want='检验项目/检验方案';
    const find=()=>[...document.querySelectorAll('.ctx-item,.as-side-menu-item')].find(e=>(e.textContent||'').trim()===want);
    let hit=find();
    if(!hit){ for(const caret of [...document.querySelectorAll('.tb-caret')]){ caret.click(); await __pd.sleep(250); hit=find(); if(hit) break; } }
    if(!hit) hit=[...document.querySelectorAll('.as-side-btn,.tb-main')].find(e=>(e.textContent||'').trim()===want);
    hit?.click(); await __pd.sleep(1500);
    const prow=__pd.rowByText(0,'${PLAN}'); prow?.click(); await __pd.sleep(1200);
    // 勾选两行
    const sec=document.querySelectorAll('.qcplan-sec')[1];
    const boxes=[...sec.querySelectorAll('tbody tr .el-checkbox')];
    out.boxes=boxes.length;
    boxes.forEach(b=>b.click());
    await __pd.sleep(400);
    out.footer=(document.querySelector('.qcplan-count')?.textContent||'').trim();
    const del=__pd.btn(1,'删除');
    out.delDisabled= del? del.disabled : 'no-btn';
    del.click(); await __pd.sleep(800);
    const box=__pd.confirmBox();
    out.confirmText= box? (box.querySelector('.el-message-box__message')?.textContent||'').trim() : null;
    const ok=__pd.okBtn(); if(ok) ok.click();
    await __pd.sleep(2200);
    out.rowsAfter= [...document.querySelectorAll('.qcplan-sec')[1].querySelectorAll('tbody tr')].length;
    const items=await __pd.api('/qc/inspPlan/items?planCode=${PLAN}&all=1');
    out.apiCount=(items.body.data||[]).length;
    out.footerAfter=(document.querySelector('.qcplan-count')?.textContent||'').trim();
    // 收拾:删掉方案
    const plans=await __pd.api('/qc/inspPlan/plans?all=1');
    const p=(plans.body.data||[]).find(x=>x['方案编码']==='${PLAN}');
    if(p) await __pd.api('/qc/inspPlan/planDestroy',{id:p.id});
    const left=await __pd.api('/qc/inspPlan/plans?all=1');
    out.cleanupGone= !(left.body.data||[]).some(x=>x['方案编码']==='${PLAN}');
    return out;
  })()`)
  console.log('   ', JSON.stringify(r3))

  console.log('⑨ 控制台(最后 15 条)')
  if (c.logs.length) for (const l of c.logs.slice(-15)) console.log('   ' + l)
  else console.log('   (无输出)')

  const pass = r1?.stillHasA === false && r1?.apiNames?.length === 1
    && r2?.apiPlanGone === true && r2?.apiItemBCount === 0 && /1/.test(r2?.confirmText || '')
    && r3?.apiCount === 0 && r3?.cleanupGone === true
  console.log('\n结论:', pass ? '✅ 单行/方案连带/多选三种删除都生效,且接口侧确已删除' : '❌ 有断言未通过,见上面各步')
  return pass
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
