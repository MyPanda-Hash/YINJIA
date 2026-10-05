/**
 * _cleanup-batch-probe-leftovers.cjs — 清掉批次号探针在**测试账套**里因后端短暂不可用而没删成的单据。
 * 用法:node tools/archive/_cleanup-batch-probe-leftovers.cjs
 */
'use strict'
const API = 'http://127.0.0.1:8090/api'
const TARGETS = [
  ['QC_RECV', 'SL-2026-10-0010'],
  ['PURCHASE_IN', 'PI-2026-10-0001'],
]

async function main() {
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!lj?.data?.token) throw new Error('登录失败:' + JSON.stringify(lj).slice(0, 200))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const cb = async (p, b, no) => {
    const j = await (await fetch(API + '/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: p, buttonName: b, formData: { 编号: no }, buttonParam: {} }),
    })).json()
    return `${j.code} ${j.message || ''}`.trim()
  }
  for (const [panel, no] of TARGETS) {
    for (const b of ['弃审', '删除']) console.log(`  ${panel} ${no} ${b} → ${await cb(panel, b, no)}`)
  }
}
main().catch((e) => { console.error('异常:' + (e && e.message || e)); process.exit(1) })
