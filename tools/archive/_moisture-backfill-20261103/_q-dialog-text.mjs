/**
 * _q-dialog-text.mjs —— 读配方计算弹窗的完整文本/结果区结构(定位水分两行)
 * 用法:node _q-dialog-text.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function main() {
  const s = await launch({ port: 9471 })
  await s.navigate(BASE + '/#/login'); await sleep(4000)
  await s.evaluate(`(() => {
    const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];
    const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];
    const p=ins.find(i=>i.type==='password'); setV(a,'admin');setV(p,'123456');return true })()`)
  await sleep(700)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(6000)
  await s.navigate(`${BASE}/#/panelx/list/RD_MOLD_PROC`); await sleep(10000)
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').includes('成型配方')); t&&t.click(); return true })()`)
  await sleep(3000)
  await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const hit=[...document.querySelectorAll('.rs-tool,button,span[title]')].filter(vis)
      .find(e=>/配方计算/.test((e.textContent||'')+(e.getAttribute('title')||'')))
    hit&&hit.click(); return true })()`)
  await sleep(9000)

  const d = await s.evaluate(`(() => {
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {noDialog:true}
    const full=(dlg.innerText||'')
    const idx=full.indexOf('理论水分')
    return {
      hasTheory: full.includes('理论水分'),
      hasPowderRef: full.includes('物料平均水分'),
      hasActual: full.includes('实际水分'),
      aroundTheory: idx>=0 ? full.slice(Math.max(0,idx-160), idx+260) : null,
      totalLen: full.length,
      firstChunk: full.replace(/\\s+/g,' ').slice(0, 600),
    }
  })()`)
  console.log(JSON.stringify(d, null, 1))
  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
