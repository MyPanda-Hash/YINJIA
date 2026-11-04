/**
 * _q-e2e-group-save.mjs —— 端到端验证:改检验项目/子项 → 保存 → 落库(2026-11-04)
 *
 * 前序结论:
 *   · 打字不被回弹已证(v-model 修好);
 *   · 保存链路已证(接口直调能把 检验项目 改进库)。
 * 本探针把两段接起来跑真实 UI 路径,并对**探针单 ZZ-PROBE-SPEC** 操作(仅本地)。
 *
 * 定位单据:面板默认停第一张,靠「查询单据/模糊搜索」框定位;失败则直接放弃(不误判)。
 *
 * 用法:node _q-e2e-group-save.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = 'ZZ-PROBE-SPEC'
const MARK = 'E2E_'

async function main() {
  const s = await launch({ port: 9561 })
  await s.navigate(BASE + '/#/login'); await sleep(4500)
  await s.evaluate(`(() => {
    const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];
    const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];
    const p=ins.find(i=>i.type==='password'); setV(a,'admin');setV(p,'123456');return true })()`)
  await sleep(800)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(7000)

  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(11000)

  // 侧栏「查询单据」→ 输入单号 → 回车
  const search = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const ins=[...document.querySelectorAll('input')].filter(vis)
    // 优先 placeholder 含 模糊搜索;退而求其次取侧栏第一个非 readonly 文本框
    let box=ins.find(i=>/模糊搜索|单据编号/.test(i.placeholder||''))
    if(!box) box=ins.find(i=>!i.readOnly && !/密码|账号/.test(i.placeholder||''))
    if(!box) return {ok:false, phs:ins.map(i=>i.placeholder||'').filter(Boolean).slice(0,12)}
    const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
    d.call(box, ${JSON.stringify(DOC)})
    box.dispatchEvent(new Event('input',{bubbles:true}))
    box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}))
    return {ok:true, ph:box.placeholder||'', readOnly:box.readOnly}
  })()`)
  console.log('搜索框 = ' + JSON.stringify(search))
  await sleep(6000)

  // 点含单号的那一行
  await s.evaluate(`(() => {
    const trs=[...document.querySelectorAll('tr')].filter(r=>r.offsetParent!==null)
    const hit=trs.find(r=>(r.textContent||'').includes(${JSON.stringify(DOC)}))
    if(hit){ const td=[...hit.querySelectorAll('td')].find(t=>(t.textContent||'').includes(${JSON.stringify(DOC)}))||hit.querySelector('td'); td&&td.click() }
    return true })()`)
  await sleep(7000)

  const st = await s.evaluate(`(() => {
    const b=(document.body.innerText||'').replace(/\\s+/g,' ')
    return { docno:(b.match(/单据编号：\\s*(\\S+)/)||[])[1]||null }
  })()`)
  console.log('当前单据 = ' + JSON.stringify(st))

  if (st.docno !== DOC) {
    console.log('!! 未定位到 ' + DOC + ',放弃(不拿别的单当证据)')
    await s.close?.()
    return
  }

  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  const before = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    return tas.map(t=>t.value).slice(0,6)
  })()`)
  console.log('保存前 = ' + JSON.stringify(before))

  // 改组名(第一个 textarea)
  const t1 = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    if(!tas.length) return {ok:false}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(tas[0], ${JSON.stringify(MARK)} + '组名')
    tas[0].dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:tas[0].value}
  })()`)
  console.log('改组名 = ' + JSON.stringify(t1))
  await sleep(900)

  // 改子项(值是 出货重量 的那个)
  const t2 = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const t=tas.find(x=>x.value.trim()==='出货重量')
    if(!t) return {ok:false, vals:tas.map(x=>x.value).slice(0,8)}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t, ${JSON.stringify(MARK)} + '子项')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('改子项 = ' + JSON.stringify(t2))
  await sleep(900)

  const afterType = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    return [...document.querySelectorAll('.rs-t textarea')].filter(vis).map(t=>t.value).slice(0,6)
  })()`)
  console.log('打字后 = ' + JSON.stringify(afterType))

  // 保存
  const saved = await s.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button,[role=button],.as-side-btn,.tb-main')].filter(x=>x.offsetParent!==null)
    const b=btns.find(x=>/^保存$/.test((x.textContent||'').trim()))
    if(!b) return {ok:false}
    b.click(); return {ok:true}
  })()`)
  console.log('点保存 = ' + JSON.stringify(saved))
  await sleep(8000)

  const msg = await s.evaluate(`(() => [...document.querySelectorAll('.el-message')].map(x=>(x.textContent||'').trim()))()`)
  console.log('提示 = ' + JSON.stringify(msg))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })