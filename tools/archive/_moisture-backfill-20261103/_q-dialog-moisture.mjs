/**
 * _q-dialog-moisture.mjs —— 切到「成型配方」页 → 点「配方计算」→ 读弹窗结果区水分两行
 *
 * 验证点(2026-11-03 改口径后):
 *   · 「理论水分」行应等于 actual_moisture(1 − 脱模中值/灌料标准湿)
 *   · 另有「物料平均水分（参考）」行 = powder_avg,证明两者都在、且不再混用
 *   · 若含水率已从档案带出,理论水分数值应 ≠ 0.00%
 *
 * 用法:node _q-dialog-moisture.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function main() {
  const s = await launch({ port: 9469 })
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

  // 切到第 2 页「成型配方」(recipeCalc 在那个 dt 上)
  const tab = await s.evaluate(`(() => {
    const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').includes('成型配方'));
    if(!t) return {ok:false, tabs:[...document.querySelectorAll('.rsp-page-tab')].map(x=>(x.textContent||'').trim())};
    t.click(); return {ok:true};
  })()`)
  console.log('tab=' + JSON.stringify(tab))
  await sleep(3000)

  // 找「配方计算」工具按钮
  const btn = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const els=[...document.querySelectorAll('.rs-tool,button,span[title]')].filter(vis)
    const hit=els.find(e=>/配方计算/.test((e.textContent||'')+(e.getAttribute('title')||'')))
    if(!hit) return {ok:false, tools:els.filter(e=>(e.classList||[]).toString().includes('rs-tool')).map(e=>(e.textContent||'').trim()).slice(0,20)};
    hit.click(); return {ok:true, label:(hit.textContent||'').trim() || hit.getAttribute('title')};
  })()`)
  console.log('btn=' + JSON.stringify(btn))
  await sleep(8000)

  const dlg = await s.evaluate(`(() => {
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {noDialog:true, tips:'弹窗没开'}
    const txt=(dlg.innerText||'').replace(/\\s+/g,' ')
    // 结果区是「标签 数值」成对出现的行;按行扫更稳
    const rows=[]
    for(const tr of dlg.querySelectorAll('tr')){
      const t=[...tr.querySelectorAll('td')].map(td=>(td.textContent||'').trim()).filter(Boolean)
      if(t.length>=2) rows.push(t.join(' | '))
    }
    const pick=(kw)=>rows.filter(r=>r.includes(kw))
    return {
      theoryRows: pick('理论水分'),
      powderRefRows: pick('物料平均水分'),
      actualRows: pick('实际水分'),
      pourRows: pick('理论灌料中间值g'),
      demoldRows: pick('中间值g'),
      warnCount: (txt.match(/水分未采集/g)||[]).length,
      title: (dlg.querySelector('.el-dialog__title')||{}).textContent||'',
    }
  })()`)
  console.log('dialog=' + JSON.stringify(dlg, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
