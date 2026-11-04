/**
 * _q-spec-edit.mjs —— 服务器上规格书「检验项目不能编辑」实地取证(2026-11-04)
 *
 * 要弄清:页 2 检验项目表体的输入框为什么不出来。逐项打印判定链:
 *   props.editable → draftEditable → 单据状态 → devFileGate / specAssignBlocked
 *
 * 用法:node _q-spec-edit.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'

async function main() {
  const s = await launch({ port: 9501 })
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

  // 页签
  const tabs = await s.evaluate(`(() => [...document.querySelectorAll('.rsp-page-tab')].map(x=>(x.textContent||'').trim()))()`)
  console.log('页签 = ' + JSON.stringify(tabs))

  // 有没有单据被选中
  const cur = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const docno = document.querySelector('td.rs-docno')
    const body = (document.body.innerText||'')
    return {
      docnoText: docno ? docno.textContent.trim() : null,
      hasSheet: !!document.querySelector('.record-sheet'),
      bodyStart: body.replace(/\\s+/g,' ').slice(0,220),
    }
  })()`)
  console.log('当前单据 = ' + JSON.stringify(cur, null, 1))

  // 切到检验项目页
  const sw = await s.evaluate(`(() => {
    const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>/检验项目/.test(x.textContent||''));
    if(!t) return {ok:false};
    t.click(); return {ok:true};
  })()`)
  console.log('切页 = ' + JSON.stringify(sw))
  await sleep(2500)

  // 数页 2 的输入框 / 只读文本
  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const inputs=[...document.querySelectorAll('.rs-t input, .rs-t textarea')].filter(vis)
    const ro=[...document.querySelectorAll('.rs-t .rsp-cell')].filter(vis)
    const libBtn=[...document.querySelectorAll('.rs-lib-btn')].filter(vis)
    const locked=[...document.querySelectorAll('.rs-t .rsp-locked')].filter(vis)
    // 找「检验项目」列的表头与首行
    const cells=[...document.querySelectorAll('.rs-t td')].filter(vis)
    const sample=cells.slice(0,14).map(td=>(td.textContent||'').trim().slice(0,14))
    return {
      inputCount: inputs.length,
      readonlyCellCount: ro.length,
      libBtnCount: libBtn.length,
      libBtnVisible: libBtn.map(x=>x.textContent.trim()),
      lockedCount: locked.length,
      sampleCells: sample,
    }
  })()`)
  console.log('页2 可编辑性 = ' + JSON.stringify(d, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })