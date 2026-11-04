/**
 * _q-verify-group-edit.mjs —— 验证「检验项目/检验子项」两列真的能打字(2026-11-04 第二次修复)
 *
 * 判据:在输入框里打字后**不失焦**,等 1.5 秒再看 value ——
 *   · 保住 ⇒ 修好(以前会被 Vue 用旧的单向绑定值回弹成空);
 *   · 回弹 ⇒ 没修好。
 *
 * 用法:node _q-verify-group-edit.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || 'ZZ-PROBE-SPEC'

async function main() {
  const s = await launch({ port: 9541 })
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

  // 直接 goto 带查询参数打开目标单
  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(DOC)}`)
  await sleep(11000)

  let head = await s.evaluate(`(() => {
    const m=(document.body.innerText||'').match(/单据编号：\\s*(\\S+)/)
    return m?m[1]:null })()`)
  if (head !== DOC) {
    // 回退:点列表里那一行
    await s.evaluate(`(() => {
      const trs=[...document.querySelectorAll('tr')].filter(r=>r.offsetParent!==null)
      const hit=trs.find(r=>(r.textContent||'').includes(${JSON.stringify(DOC)}))
      if(hit){ const td=[...hit.querySelectorAll('td')].find(t=>(t.textContent||'').includes(${JSON.stringify(DOC)}))||hit.querySelector('td'); td&&td.click() }
      return true })()`)
    await sleep(6000)
    head = await s.evaluate(`(() => {
      const m=(document.body.innerText||'').match(/单据编号：\\s*(\\S+)/)
      return m?m[1]:null })()`)
  }
  console.log('当前单据 = ' + JSON.stringify(head))

  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  const before = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const filled=tas.filter(t=>t.value.trim())
    return { total: tas.length, filledCount: filled.length, firstFilled: filled.slice(0,4).map(t=>t.value) }
  })()`)
  console.log('修后结构 = ' + JSON.stringify(before, null, 1))

  // 找一个有值的 textarea 打字
  const typed = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    const t=tas.find(x=>x.value.trim()) || tas[0]
    if(!t) return {ok:false}
    const before=t.value
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t, before + 'X')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, before, afterInput:t.value}
  })()`)
  console.log('打字 = ' + JSON.stringify(typed))
  await sleep(1600)

  const after = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    return tas.filter(t=>t.value.trim()).slice(0,4).map(t=>t.value)
  })()`)
  console.log('1.6s 后(有值的格) = ' + JSON.stringify(after))

  const ok = typed.ok && after.some(v => String(typed.afterInput) === String(v))
  console.log('')
  console.log(ok
    ? '=> PASS:打字保住了,「检验项目/检验子项」可编辑'
    : '=> FAIL:打字仍被回弹')

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })