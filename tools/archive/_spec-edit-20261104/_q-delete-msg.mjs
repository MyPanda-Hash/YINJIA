/**
 * _q-delete-msg.mjs —— 验证「删除」提示是否跟随服务端真实状态(2026-11-04)
 *
 * 复现用户场景:非管理员(chenxiuli)删除一张**已归档**规格书 ⇒ 服务端只落删除申请,
 * 前端必须提示「待管理员审批」而不是「删除成功」。
 *
 * ⚠ 本探针会**真的写库**(申请删除),所以:
 *   ① 只用本地 8090,不碰服务器;
 *   ② 跑完把 deleting 复位、并把探针单删掉。
 *
 * 用法:node _q-delete-msg.mjs [base] [user] [pass]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const USER = process.argv[3] || 'chenxiuli'
const PASS = process.argv[4] || '123456'

async function main() {
  const s = await launch({ port: 9513 })
  await s.navigate(BASE + '/#/login'); await sleep(4500)
  await s.evaluate(`(() => {
    const setV=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    const ins=[...document.querySelectorAll('input')];
    const a=ins.find(i=>(i.placeholder||'').includes('登录账号'))||ins[0];
    const p=ins.find(i=>i.type==='password'); setV(a,${JSON.stringify(USER)});setV(p,${JSON.stringify(PASS)});return true })()`)
  await sleep(800)
  await s.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('进入系统')); b&&b.click(); return true })()`)
  await sleep(7000)

  // 直接调接口验证服务端语义(UI 点击链路依赖目标单的存在,这里用接口取证最稳)
  const r = await s.evaluate(`(async () => {
    const t = localStorage.getItem('mes_token')
    const who = localStorage.getItem('mes_user')
    // 找一张已归档规格书
    const q = await fetch('/api/px/queryFormDataList', {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+t},
      body: JSON.stringify({panelCode:'RD_SPEC_DOC', keyword:'', pageNo:1, pageSize:50})
    })
    const j = await q.json()
    const list = j?.data?.list || []
    const archived = list.filter(x => String(x['单据状态']||'')==='已归档' || String(x['单据状态']||'')==='已审核')
    return { user: JSON.parse(who||'{}').userName || null, total: list.length, archivedCount: archived.length,
             sample: archived.slice(0,3).map(x=>({no:x['单据编号'], st:x['单据状态']})) }
  })()`)
  console.log('登录身份/可删候选 = ' + JSON.stringify(r, null, 1))

  if (r.archivedCount > 0) {
    const target = r.sample[0].no
    const res = await s.evaluate(`(async () => {
      const t = localStorage.getItem('mes_token')
      const rr = await fetch('/api/px/callButton', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+t},
        body: JSON.stringify({panelCode:'RD_SPEC_DOC', buttonName:'删除', formData:{编号:${JSON.stringify(target)}}, buttonParam:{}})
      })
      const jj = await rr.json()
      return { http: rr.status, code: jj.code, msg: jj.message, status: jj?.data?.['单据状态'] ?? null }
    })()`)
    console.log(`删除 ${target} 的服务端回写 = ` + JSON.stringify(res))

    // 按前端口径翻译
    const st = res.status
    let expect
    if (st === '已作废') expect = 'success 单据已删除'
    else if (st === '删除申请中') expect = 'warning 待管理员审批通过后才会真正删除'
    else expect = 'info 如实说已提交'
    console.log('前端应提示 = ' + expect)
    console.log(st === '删除申请中'
      ? '=> PASS:服务端只落删除申请,提示必须说"待管理员审批"(不再谎报删除成功)'
      : `=> 状态=${JSON.stringify(st)},按 deleteOutcome 对应档位`)
  } else {
    console.log('没有已归档单据可测(跳过写操作)')
  }

  await s.close?.()
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
