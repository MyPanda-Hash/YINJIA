/**
 * _q-group-edit.mjs —— 规格书「检验项目/检验子项」两列能不能真的改(2026-11-04)
 *
 * 用户口径:「检验项目那一列的那个什么炭棒尺寸、重量这一列行头的表格内容不能编辑,
 *   其他的表格内容是可以编辑的」⇒ 要求**能编辑**的是 `检验项目`(组名) 与 `检验子项` 两列。
 *
 * 本探针在**真实的已归档单据**上试打字(只打、不失焦保存),看输入框里的值是否真的变了:
 *   · 变 ⇒ 能编辑,问题在别处;
 *   · 不变/回弹 ⇒ 确认坏,根因在 :model-value + @change 这条链。
 *
 * 用法:node _q-group-edit.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || ''

async function main() {
  const s = await launch({ port: 9531 })
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

  // 打开指定单据(按单据编号);没给就用列表第一张
  if (DOC) {
    await s.evaluate(`(() => {
      const trs=[...document.querySelectorAll('tr')].filter(r=>r.offsetParent!==null)
      const hit=trs.find(r=>(r.textContent||'').includes(${JSON.stringify(DOC)}))
      if(hit){ const td=[...hit.querySelectorAll('td')].find(t=>(t.textContent||'').includes(${JSON.stringify(DOC)}))||hit.querySelector('td'); td&&td.click() }
      return true })()`)
    await sleep(6000)
  }

  const head = await s.evaluate(`(() => {
    const b=(document.body.innerText||'').replace(/\\s+/g,' ')
    const m=b.match(/单据编号：\\s*(\\S+)/)
    return {docno:m?m[1]:null, draft:b.includes('草稿'), archived:b.includes('已归档')||b.includes('已审核')}
  })()`)
  console.log('单据 = ' + JSON.stringify(head))

  // 切页 2
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  // 结构:列出组名/子项两列的 textarea 与只读 span
  const before = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    return {
      textareaCount: tas.length,
      values: tas.map(t=>t.value),
      readonlyCells: [...document.querySelectorAll('.rs-t td .rsp-cell')].filter(vis).length,
    }
  })()`)
  console.log('修前结构 = ' + JSON.stringify(before, null, 1))

  // 试打字:挑第一个 textarea(应是组名),输入后**不失焦**,看 value 会不会被 Vue 回弹
  const typed = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    if(!tas.length) return {ok:false, reason:'no textarea'}
    const t=tas[0]
    const before=t.value
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set
    d.call(t, 'PROBE_文字')
    t.dispatchEvent(new Event('input',{bubbles:true}))
    return {ok:true, before, afterInput:t.value}
  })()`)
  console.log('打字(未失焦) = ' + JSON.stringify(typed))
  await sleep(1200)

  const after = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const tas=[...document.querySelectorAll('.rs-t textarea')].filter(vis)
    return { values: tas.map(t=>t.value) }
  })()`)
  console.log('1.2s 后 = ' + JSON.stringify(after.values))

  console.log('')
  const changed = JSON.stringify(after.values) !== JSON.stringify(before.values)
  console.log(changed
    ? '=> 打字保住了:输入框能接收编辑(问题可能在保存/回写)'
    : '=> 打字被回弹:输入框收不住改动(根因在 :model-value + @change)')

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })