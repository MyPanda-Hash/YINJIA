/**
 * _q-draft-spec.mjs —— 新建草稿规格书,打开页 2 检验项目看能不能编辑(复现用)
 * 用法:node _q-draft-spec.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'

async function main() {
  const s = await launch({ port: 9521 })
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

  // 点「新增」建草稿
  const added = await s.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button, .as-side-btn, .mp-tab, [class*=btn]')].filter(x=>x.offsetParent!==null)
    const b=btns.find(x=>/^新增$/.test((x.textContent||'').trim()))
    if(!b) return {ok:false, all:btns.map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,25)}
    b.click(); return {ok:true}
  })()`)
  console.log('点新增 = ' + JSON.stringify(added))
  await sleep(9000)

  const st = await s.evaluate(`(() => {
    const body=(document.body.innerText||'').replace(/\\s+/g,' ')
    const m=body.match(/单据编号：\\s*(\\S+)/)
    return {docno:m?m[1]:null, isDraft: body.includes('草稿'), sheet: !!document.querySelector('.record-sheet')}
  })()`)
  console.log('新草稿 = ' + JSON.stringify(st))

  // 切页 2
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||'')); t&&t.click(); return true })()`)
  await sleep(2500)

  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const inputs=[...document.querySelectorAll('.rs-t input, .rs-t textarea')].filter(vis)
    const lib=[...document.querySelectorAll('.rs-lib-btn')].filter(vis)
    const cells=[...document.querySelectorAll('.rs-t td')].filter(vis)
    const trs=[...document.querySelectorAll('.rs-t tr')].filter(vis)
    return {
      inputCount: inputs.length,
      libBtn: lib.map(x=>x.textContent.trim()),
      visibleRows: trs.length,
      cells: cells.slice(0,16).map(td=>({t:(td.textContent||'').trim().slice(0,18), cls:td.className})),
    }
  })()`)
  console.log('页2(草稿) = ' + JSON.stringify(d, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
