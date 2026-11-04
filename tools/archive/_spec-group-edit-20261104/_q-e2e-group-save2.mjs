/**
 * _q-e2e-group-save2.mjs —— 通过「查询单据」弹窗定位到指定单,再做 改→保存→查库(2026-11-04)
 *
 * 前几版栽在"定位单据"上:面板默认停第一张,侧栏模糊搜索框在当前版本不吃 Enter。
 * 这里走侧栏「① 查找 / 查询单据」按钮 → 弹窗里搜单号 → 选中 → 打开。
 *
 * 用法:node _q-e2e-group-save2.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = 'ZZ-PROBE-SPEC'
const MARK = 'E2E2_'

async function main() {
  const s = await launch({ port: 9563 })
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

  // 点侧栏「查询单据」（它是个按钮/可点文本）
  const clickFind = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const cands=[...document.querySelectorAll('button,[role=button],.as-side-btn,span,div')].filter(vis)
    const b=cands.find(x=>/查询单据/.test((x.textContent||'').trim()) && (x.textContent||'').trim().length <= 12)
    if(!b) return {ok:false}
    b.click(); return {ok:true, tag:b.tagName, txt:(b.textContent||'').trim()}
  })()`)
  console.log('点查询单据 = ' + JSON.stringify(clickFind))
  await sleep(3500)

  // 弹窗里输入单号
  const fill = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {ok:false, noDialog:true}
    const ins=[...dlg.querySelectorAll('input')].filter(vis)
    if(!ins.length) return {ok:false, n:0}
    const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
    d.call(ins[0], ${JSON.stringify(DOC)})
    ins[0].dispatchEvent(new Event('input',{bubbles:true}))
    // 点弹窗里的「查询/搜索」
    const btns=[...dlg.querySelectorAll('button')].filter(vis)
    const q=btns.find(x=>/查询|搜索/.test((x.textContent||'').trim()))
    if(q) q.click()
    return {ok:true, inputCount:ins.length, clicked:!!q}
  })()`)
  console.log('弹窗填单号 = ' + JSON.stringify(fill))
  await sleep(4000)

  // 弹窗结果里点该单
  const pick = await s.evaluate(`(() => {
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {ok:false}
    const trs=[...dlg.querySelectorAll('tr')].filter(r=>r.offsetParent!==null)
    const hit=trs.find(r=>(r.textContent||'').includes(${JSON.stringify(DOC)}))
    if(!hit) return {ok:false, rows:trs.map(r=>(r.textContent||'').trim().slice(0,30)).slice(0,6)}
    const td=[...hit.querySelectorAll('td')].find(t=>(t.textContent||'').includes(${JSON.stringify(DOC)}))||hit.querySelector('td')
    td&&td.click(); return {ok:true}
  })()`)
  console.log('选中 = ' + JSON.stringify(pick))
  await sleep(2000)

  // 确认/确定
  const ok = await s.evaluate(`(() => {
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {ok:false}
    const btns=[...dlg.querySelectorAll('button')].filter(x=>x.offsetParent!==null)
    const b=btns.find(x=>/确定|确认|打开/.test((x.textContent||'').trim()))
    if(!b) return {ok:false, all:btns.map(x=>(x.textContent||'').trim())}
    b.click(); return {ok:true, label:(b.textContent||'').trim()}
  })()`)
  console.log('确认 = ' + JSON.stringify(ok))
  await sleep(7000)

  const st = await s.evaluate(`(() => {
    const b=(document.body.innerText||'').replace(/\\s+/g,' ')
    return { docno:(b.match(/单据编号：\\s*(\\S+)/)||[])[1]||null }
  })()`)
  console.log('当前单据 = ' + JSON.stringify(st))

  if (st.docno !== DOC) { console.log('!! 仍未定位,放弃'); await s.close?.(); return }

  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  const before = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    return [...document.querySelectorAll('.rs-t textarea')].filter(vis).map(t=>t.value).slice(0,6)
  })()`)
  console.log('保存前 = ' + JSON.stringify(before))

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

  const t2 = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const t=tas.find(x=>/出货重量/.test(x.value))
    if(!t) return {ok:false}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t, ${JSON.stringify(MARK)} + '子项')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('改子项 = ' + JSON.stringify(t2))
  await sleep(900)

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