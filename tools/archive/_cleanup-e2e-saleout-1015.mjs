/**
 * 清理(2026-10-15):把 e2e 实测生成的销售出库测试单作废掉。
 *
 * 为什么需要单独一步(踩坑留档):e2e 探针原先走 /px/deleteForms(rowCodes=[单号]) ——
 *   那个端点是「列表页多选删除」,而**单张草稿的作废语义在 callButton 的「删除」按钮**
 *   (ButtonService.delete:仅草稿可删 -> voidDoc),它读 formData.**编号**。
 *   两者不是同一条路径 => 先前那次清理**静默失败**(单据仍留在库里,raw 计数 54->55),
 *   而业务列表(totalSize)仍是 54 —— 因为作废单不进列表。**只看业务列表会误判为"已清干净"**,
 *   故本脚本与 e2e 探针成对保留。
 *
 * 用法: node tools/archive/_cleanup-e2e-saleout-1015.mjs [apiBase] [单号...]
 *   不带单号时清理默认的 SO-2026-10-0001。
 *   若返回 409「仅草稿状态可删除」= 该单已被作废过(幂等,无需再处理)。
 */
const base = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '') + '/api'
const nos = process.argv.slice(3).filter((a) => !a.startsWith('-'))
const targets = nos.length ? nos : ['SO-2026-10-0001']

const lg = await (await fetch(base + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

for (const no of targets) {
  const r = await fetch(base + '/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'SALE_OUT', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }),
  })
  const txt = (await r.text()).slice(0, 300)
  const done = r.status === 200 || txt.includes('仅草稿状态可删除')
  console.log((done ? '[OK]' : '[WARN]') + ' ' + no + ' -> ' + r.status + ' ' + txt)
}
process.exit(0)