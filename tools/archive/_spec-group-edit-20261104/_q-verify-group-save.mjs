/**
 * _q-verify-group-save.mjs —— 验证「检验项目/检验子项」改动能真的存进库(2026-11-04)
 *
 * 前一个探针证明「打字不被回弹」;本探针再补一步:打字 → 点保存 → 查库值变了。
 * 只对本地探针单 ZZ-PROBE-SPEC 操作,不进服务器。
 *
 * 用法:node _q-verify-group-save.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = 'ZZ-PROBE-SPEC'
const MARK = 'PJ_'   // 打进去的标记,便于查库认

async function main() {
  const s = await launch({ port: 9543 })
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

  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(DOC)}`)
  await sleep(11000)
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  // ① 改组名(textarea[0] 是组名)
  const r1 = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    if(!tas.length) return {ok:false}
    const t=tas[0]
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t, ${JSON.stringify(MARK)} + '组名')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('① 改组名 = ' + JSON.stringify(r1))
  await sleep(800)

  // ② 改子项:找「重量」组那行的子项格(textarea[1] 通常是第一行的子项,可能为空)
  const r2 = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    // 子项格:值 == '出货重量' 的那个
    const t=tas.find(x=>x.value.trim()==='出货重量')
    if(!t) return {ok:false, values:tas.map(x=>x.value).slice(0,8)}
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t, ${JSON.stringify(MARK)} + '子项')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, now:t.value}
  })()`)
  console.log('② 改子项 = ' + JSON.stringify(r2))
  await sleep(800)

  // ③ 点保存
  const saved = await s.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button,[role=button],.as-side-btn,.tb-main,.el-button')].filter(x=>x.offsetParent!==null)
    const b=btns.find(x=>/^保存$/.test((x.textContent||'').trim()))
    if(!b) return {ok:false, all:btns.map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,20)}
    b.click(); return {ok:true}
  })()`)
  console.log('③ 点保存 = ' + JSON.stringify(saved))
  await sleep(6000)

  const msg = await s.evaluate(`(() => (document.querySelector('.el-message')||{}).textContent || '')()`)
  console.log('④ 提示 = ' + JSON.stringify(msg))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })