/**
 * _q-save-verify.mjs —— 正确定位单据后验证「改检验项目 → 保存 → 落库」(2026-11-04)
 *
 * 关键:面板的 docNo 定位走侧栏「查询单据」框,URL 的 ?docNo= 不生效(前几个探针栽在这)。
 *
 * 用法:node _q-save-verify.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || 'ZZ-PROBE-SPEC'
const MARK = 'SV_'

async function main() {
  const s = await launch({ port: 9553 })
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

  // 用「模糊搜索」框定位并回车
  const q = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const ins=[...document.querySelectorAll('input')].filter(vis)
    const box=ins.find(i=>(i.placeholder||'').includes('模糊搜索'))
    if(!box) return {ok:false, phs:ins.map(i=>i.placeholder||'').filter(Boolean).slice(0,10)}
    const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
    d.call(box, ${JSON.stringify(DOC)})
    box.dispatchEvent(new Event('input',{bubbles:true}))
    box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}))
    box.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',keyCode:13,which:13,bubbles:true}))
    return {ok:true}
  })()`)
  console.log('搜索 = ' + JSON.stringify(q))
  await sleep(5000)

  // 点结果行
  const click = await s.evaluate(`(() => {
    const trs=[...document.querySelectorAll('tr')].filter(r=>r.offsetParent!==null)
    const hit=trs.find(r=>(r.textContent||'').includes(${JSON.stringify(DOC)}))
    if(!hit) return {ok:false, rows:trs.map(r=>(r.textContent||'').trim().slice(0,40)).slice(0,8)}
    const td=[...hit.querySelectorAll('td')].find(t=>(t.textContent||'').includes(${JSON.stringify(DOC)}))||hit.querySelector('td')
    td&&td.click(); return {ok:true}
  })()`)
  console.log('点行 = ' + JSON.stringify(click))
  await sleep(7000)

  const st = await s.evaluate(`(() => {
    const b=(document.body.innerText||'').replace(/\\s+/g,' ')
    return { docno:(b.match(/单据编号：\\s*(\\S+)/)||[])[1]||null, 草稿:b.includes('草稿') }
  })()`)
  console.log('当前单据 = ' + JSON.stringify(st))

  // 页 2
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  if (st.docno !== DOC) {
    console.log('!! 未定位到目标单,后续保存验证不可信,停止')
    await s.close?.()
    return
  }

  // 挂 XHR 钩子
  await s.evaluate(`(() => {
    window.__cap = []
    if (!window.__xhrPatched) {
      window.__xhrPatched = true
      const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.open = function(m,u){ this.__u=u; return open.apply(this,arguments) }
      XMLHttpRequest.prototype.send = function(b){
        try { if (/callButton/.test(this.__u||'') && b) window.__cap.push({u:this.__u, body:String(b)}) } catch(e){}
        return send.apply(this,arguments)
      }
    }
    return true
  })()`)

  const typed = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const t=tas[0]
    if(!t) return {ok:false}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t, ${JSON.stringify(MARK)} + '组名')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('改组名 = ' + JSON.stringify(typed))
  await sleep(1200)

  const saved = await s.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button,[role=button],.as-side-btn,.tb-main')].filter(x=>x.offsetParent!==null)
    const b=btns.find(x=>/^保存$/.test((x.textContent||'').trim()))
    if(!b) return {ok:false}
    b.click(); return {ok:true}
  })()`)
  console.log('点保存 = ' + JSON.stringify(saved))
  await sleep(8000)

  const msg = await s.evaluate(`(() => {
    const ms=[...document.querySelectorAll('.el-message')].map(x=>(x.textContent||'').trim())
    return ms })()`)
  console.log('提示 = ' + JSON.stringify(msg))

  const cap = await s.evaluate(`(() => {
    const out = window.__cap.map(c => {
      let j=null; try { j=JSON.parse(c.body) } catch(e){ return {parseErr:true} }
      const items = (j.formData||{}).detail?.items || []
      return {
        buttonName: j.buttonName,
        count: items.length,
        行: items.filter(r=>r['表区']==='检验要求').map(r=>({项目:r['检验项目'],子项:r['检验子项']})),
      }
    })
    return { n: window.__cap.length, calls: out }
  })()`)
  console.log('请求 = ' + JSON.stringify(cap, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })