/**
 * _q-server-moisture.mjs —— 服务器上「理论水分」现状取证(2026-11-03)
 *
 * 用途:在**换 jar 之前**确认「数据补了、但旧前端仍显示 0.00」——
 *   这是 jar 必须换的直接证据;换 jar 之后再跑一次,应变成非 0。
 *
 * 判定:
 *   · 旧口径(服务器现役 jar):「理论水分」取 powder_avg ⇒ 数据补上后应**变成非 0**
 *     (因为 powder_avg 就是靠 bs_inv.水分含量算的)
 *   · 新口径(本次 jar):「理论水分」取 actual_moisture,弹窗里另列「物料平均水分(参考)」
 *   所以真正的判据是:弹窗里有没有「物料平均水分（参考）」这一行 —— 只有新 jar 有。
 *
 * 用法:node _q-server-moisture.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'

async function main() {
  const s = await launch({ port: 9481 })
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

  // ① 先确认服务端含水率能查到(数据层已生效)
  const inv = await s.evaluate(`(async () => {
    const t = localStorage.getItem('mes_token')
    const r = await fetch('/api/px/invOptions?panelCode=RD_MOLD_PROC&keyword=YJ-XH-002', { headers: { Authorization: 'Bearer ' + t } })
    const j = await r.json()
    const row = j?.data?.list?.[0]?.detail?.inv?.[0]
    return { code: row?.['存货编码'] ?? null, moisture: row?.['水分含量'] ?? null }
  })()`)
  console.log('① 接口含水率 = ' + JSON.stringify(inv))

  // ② 打开面板 → 切「成型配方」→ 开配方计算器 → 看有没有「物料平均水分（参考）」行
  await s.navigate(`${BASE}/#/panelx/list/RD_MOLD_PROC`); await sleep(11000)
  const tab = await s.evaluate(`(() => {
    const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').includes('成型配方'));
    if(!t) return {ok:false, tabs:[...document.querySelectorAll('.rsp-page-tab')].map(x=>(x.textContent||'').trim())};
    t.click(); return {ok:true};
  })()`)
  console.log('② 切页 = ' + JSON.stringify(tab))
  await sleep(3500)

  const btn = await s.evaluate(`(() => {
    const vis=(el)=>el&&el.offsetParent!==null
    const hit=[...document.querySelectorAll('.rs-tool,button,span[title]')].filter(vis)
      .find(e=>/配方计算/.test((e.textContent||'')+(e.getAttribute('title')||'')))
    if(!hit) return {ok:false}
    hit.click(); return {ok:true}
  })()`)
  console.log('③ 打开弹窗 = ' + JSON.stringify(btn))
  await sleep(9000)

  const dlg = await s.evaluate(`(() => {
    const dlg=document.querySelector('.el-dialog')
    if(!dlg) return {noDialog:true}
    const full=(dlg.innerText||'')
    return {
      hasPowderRefRow: full.includes('物料平均水分（参考）'),   // 只有新 jar 有
      hasTheory: full.includes('理论水分'),
      hasActualRow: /实际水分\\s*[:：]?\\s*[-0-9]/.test(full),    // 旧 jar 有此行
      snapshot: full.replace(/\\s+/g,' ').slice(0, 200),
    }
  })()`)
  console.log('④ 弹窗 = ' + JSON.stringify(dlg, null, 1))

  console.log('')
  console.log(dlg.hasPowderRefRow
    ? '=> 判定:已是**新 jar**(有「物料平均水分（参考）」行)'
    : '=> 判定:仍是**旧 jar**(无参考行,理论水分走 powder_avg)')

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
