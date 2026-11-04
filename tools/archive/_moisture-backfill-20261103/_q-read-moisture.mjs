/**
 * _q-read-moisture.mjs —— 读 RD_MOLD_PROC 页 1 的「理论水分」落值 + 打开配方计算器对照
 *
 * 判定口径(2026-11-03 改后):
 *   单据「理论水分」格 = actual_moisture = 1 − 脱模中值/灌料标准湿
 *   弹窗结果区「理论水分」同口径;另列「物料平均水分（参考）」= powder_avg(不进单据)
 *
 * 用法:node _q-read-moisture.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC_NO = process.argv[3] || 'MP-2026-11-0005'

async function main() {
  const s = await launch({ port: 9465 })
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

  // 页 1 = 第一个 rsp-page-tab（成型工艺清单）
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').includes('成型工艺清单')); t&&t.click(); return true })()`)
  await sleep(2500)

  /* 页 1 是「标签行 + 值行」两行式:理论水分的标签在某个 td,值是它**右边第一格**;
     而灌料三值是「标签行 / 值行」上下分行的,值在同列的下一个 tr。
     这里按其 rowspan/colspan 结构,先打印理论水分所在行的整行单元格,再定位值。 */
  const d = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const out={rows:[],picked:{}}
    const trs=[...document.querySelectorAll('tr')].filter(vis)
    trs.forEach((tr,ri)=>{
      const tds=[...tr.querySelectorAll('td')]
      const txt=tds.map(td=>(td.textContent||'').trim())
      if(txt.some(t=>t==='理论水分'||t.includes('理论水分'))){
        out.rows.push({rowIndex:ri, cells:txt})
      }
    })
    // 理论水分 = 标签右邻第一个非空、非另一标签的格
    const cells=[...document.querySelectorAll('td')].filter(vis)
    const idx=cells.findIndex(td=>(td.textContent||'').trim()==='理论水分')
    if(idx>=0){
      const label=cells[idx]
      const tr=label.closest('tr')
      const inRow=[...tr.querySelectorAll('td')].filter(vis)
      const pos=inRow.indexOf(label)
      out.picked.labelPos=pos
      out.picked.rowCells=inRow.map(td=>({t:(td.textContent||'').trim().slice(0,20), cs:td.colSpan, rs:td.rowSpan}))
      // 右邻
      const right=inRow[pos+1]
      out.picked.rightText=right?(right.textContent||'').trim():null
      // 同行里下一个 input 的值
      const inp=tr.querySelector('input')
      out.picked.rowInput=inp?inp.value:null
    }
    return out
  })()`)
  console.log(JSON.stringify(d, null, 1))

  // 再打开配方计算器,读结果区那一行
  const opened = await s.evaluate(`(() => {
    const btns=[...document.querySelectorAll('button')];
    const b=btns.find(x=>/配方计算|🧮|配方/.test(x.textContent||''));
    if(!b) return {ok:false, all:btns.map(x=>(x.textContent||'').trim()).slice(0,30)};
    b.click(); return {ok:true, label:(b.textContent||'').trim()};
  })()`)
  console.log('recipeBtn=' + JSON.stringify(opened))
  await sleep(6000)

  const dlg = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {noDialog:true}
    const txt=(dlg.innerText||'').replace(/\\s+/g,' ')
    const grab=(label)=>{
      const m=txt.match(new RegExp(label.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&')+'\\\\s*[:：]?\\\\s*([-0-9.]+%?)'))
      return m?m[1]:null
    }
    return {
      hasTheory: txt.includes('理论水分'),
      hasActual: txt.includes('实际水分'),
      hasPowderRef: txt.includes('物料平均水分'),
      theory: grab('理论水分'),
      powderRef: grab('物料平均水分'),
      slice: txt.slice(0, 400),
    }
  })()`)
  console.log('dialog=' + JSON.stringify(dlg, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
