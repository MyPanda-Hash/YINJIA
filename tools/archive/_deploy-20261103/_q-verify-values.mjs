/**
 * _q-verify-values.mjs —— 读服务器弹窗里「理论水分」与「物料平均水分（参考）」的实际数值
 *
 * 验收判据(2026-11-03 口径变更后):
 *   · 理论水分 = actual_moisture(1 − 脱模中值/灌料标准湿),不再是 0.00
 *   · 物料平均水分（参考）= powder_avg,两者**不同源**(数值可接近但不应相等)
 *   · 若单上没有配方行/产品编号,结果区为空 —— 那就退回用接口含水率 + 本地引擎复算佐证
 *
 * 用法:node _q-verify-values.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'

async function main() {
  const s = await launch({ port: 9483 })
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

  await s.navigate(`${BASE}/#/panelx/list/RD_MOLD_PROC`); await sleep(11000)
  await s.evaluate(`(() => { const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').includes('成型配方')); t&&t.click(); return true })()`)
  await sleep(3500)
  await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const hit=[...document.querySelectorAll('.rs-tool,button,span[title]')].filter(vis)
      .find(e=>/配方计算/.test((e.textContent||'')+(e.getAttribute('title')||'')))
    hit&&hit.click(); return true })()`)
  await sleep(9000)

  const d = await s.evaluate(`(() => {
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {noDialog:true}
    const full=(dlg.innerText||'').replace(/\\s+/g,' ')
    const grab=(label)=>{
      const i=full.indexOf(label)
      if(i<0) return null
      // 取标签后 40 字符,提出其中的数字/百分数
      const tail=full.slice(i+label.length, i+label.length+40)
      const m=tail.match(/(-?[0-9]+\\.[0-9]+%?|-?[0-9]+%?)/)
      return m?m[1]:tail.slice(0,20)
    }
    return {
      theory:'理论水分',
      理论水分: grab('理论水分'),
      物料平均水分: grab('物料平均水分（参考）'),
      理论灌料中间值: grab('理论灌料中间值g'),
      中间值g: grab('中间值g'),
      水分未采集告警数: (full.match(/水分未采集/g)||[]).length,
      tail: full.slice(-500),
    }
  })()`)
  console.log(JSON.stringify(d, null, 1))

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
