/**
 * _q-dom-probe.mjs —— 摸清 RD_MOLD_PROC 页面/SDK 的真实结构(为水分格定位)
 * 用法:node _q-dom-probe.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function main() {
  const s = await launch({ port: 9463 })
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

  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const cls={}
    for(const el of document.querySelectorAll('[class]')){
      for(const c of el.classList){ if(/^(rsp|rs|record|panelx|el-table|recipe)/.test(c)) cls[c]=(cls[c]||0)+1 }
    }
    return {
      hash: location.hash,
      bodyStart: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,300),
      classes: Object.entries(cls).sort((a,b)=>b[1]-a[1]).slice(0,30),
      tables: document.querySelectorAll('table').length,
      elRows: document.querySelectorAll('.el-table__row').length,
      rsTd: document.querySelectorAll('td.rs-td').length,
      rspTabs: [...document.querySelectorAll('.rsp-page-tab')].map(x=>(x.textContent||'').trim()),
      buttons: [...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(Boolean).slice(0,25),
    }
  })()`)
  console.log(JSON.stringify(d, null, 1))
  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
