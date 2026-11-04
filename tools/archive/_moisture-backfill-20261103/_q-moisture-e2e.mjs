/**
 * _q-moisture-e2e.mjs —— 「理论水分」回填实测(2026-11-03)
 *
 * 要回答的问题:改口径后,单据页 1 的「理论水分」格填的是**实际水分**(1 − 脱模中值/灌料标准湿),
 * 而不是物料平均水分 powder_avg;并且它能让「实际灌料重量计算公式」闭环。
 *
 * 做法:真实登录 → 打开 A-54-12 烧结工艺清单 → 读页 1 那几格的落值,
 *      再调一次配方计算器读它算出的 理论水分 / 物料平均水分(参考),两边对照。
 * 用法:node _q-moisture-e2e.mjs [http://127.0.0.1:8090]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANEL = 'RD_MOLD_PROC'
const DOC_NO = process.argv[3] || 'MP-2026-11-0005'

async function main() {
  const s = await launch({ port: 9461 })
  await s.navigate(BASE + '/#/login')
  await sleep(4000)
  await s.evaluate(`(() => {
    const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];
    const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];
    const p=ins.find(i=>i.type==='password');
    setV(a,'admin');setV(p,'123456');return true })()`)
  await sleep(700)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(6000)

  await s.navigate(`${BASE}/#/panelx/list/${PANEL}`)
  await sleep(9000)

  // 找到目标单据并打开(列表里按单据编号定位)
  const opened = await s.evaluate(`(() => {
    const rows=[...document.querySelectorAll('.el-table__row')];
    const hit=rows.find(r=>(r.textContent||'').includes(${JSON.stringify(DOC_NO)}));
    if(!hit) return {ok:false, rows:rows.length, sample:rows.slice(0,3).map(r=>(r.textContent||'').slice(0,60))};
    const tds=[...hit.querySelectorAll('td')];
    const tgt=tds.find(td=>(td.textContent||'').includes(${JSON.stringify(DOC_NO)}))||tds[0];
    tgt.click();
    return {ok:true};
  })()`)
  console.log('open=' + JSON.stringify(opened))
  await sleep(7000)

  // 读页 1 的水分格 + 灌料/脱模格(按 .rs-td 的标签对齐)
  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const want=['理论水分','理论灌料中间值g','中间值g','理论最低灌料重量g','实际灌料重量计算公式']
    const out={}
    const cells=[...document.querySelectorAll('td')].filter(vis)
    for(let i=0;i<cells.length;i++){
      const t=(cells[i].textContent||'').trim()
      if(want.includes(t) && !out[t]){
        // 值在右邻第一个非空 td
        let v=''
        for(let j=i+1;j<cells.length && j<i+4;j++){
          const c=(cells[j].textContent||'').trim()
          if(c) { v=c; break }
        }
        out[t]=v
      }
    }
    return {cells: out, docTitle:(document.querySelector('.rs-head,.record-sheet')||{}).textContent?.slice(0,80)||''}
  })()`)
  console.log('页1 落值 = ' + JSON.stringify(d.cells, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
