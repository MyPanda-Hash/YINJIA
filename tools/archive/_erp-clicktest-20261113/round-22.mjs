// round-22: 补最后一张(采购入库,带供应商编码) + 删除本轮所有测试单(测试账套保持干净)。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-cleanup-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(6000)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const call = (p, b, f) => post('/api/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: {} })
const erp = async (panel, no) => {
  const r = await call(panel, '转ERP', { 编号: no, 单据编号: no })
  return { status: r.status, msg: String(r.body?.message || '').slice(0, 240), data: r.body?.data }
}
const today = new Date().toISOString().slice(0, 10)
const M = { code: 'YJ-XWR-003', name: '白色无纺布130g', unit: '个', wh: '恒亿仓', whCode: 'CK00006' }
const B = { 基本单位名称: '个', 基本单位编码: '个', 基本单位id: '1', 换算系数: '1' }

// ① 采购入库(补 供应商编码)
const save = await call('PURCHASE_IN', '保存', {
  单据日期: today, 供应商: '福建鑫恒碳业有限公司', 供应商编码: 'YJ-XH',
  detail: { items: [{ 行号: 1, 存货编码: M.code, 存货名称: M.name, 仓库: M.wh, 仓库编码: M.whCode, 计量单位: M.unit, 实收数量: 1, 单价: 1, ...B }] },
})
const piNo = String(save.body?.data?.['编号'] || '')
console.log('PI 建单 ' + piNo + ' ' + String(save.body?.message || '').slice(0, 120))
let piResult = null
if (piNo) {
  const aud = await call('PURCHASE_IN', '审核', { 编号: piNo })
  console.log('PI 审核 ' + aud.status + ' ' + String(aud.body?.message || '').slice(0, 120))
  if ((aud.body?.code ?? aud.status) === 200) {
    const r = await erp('PURCHASE_IN', piNo)
    piResult = { panel: 'PURCHASE_IN', no: piNo, ok: !!(r.data && String(r.data['是否已转ERP'] ?? '') === '是'), erpNo: r.data?.['ERP单号'] || '', msg: r.msg }
    console.log('PI 转ERP → ' + JSON.stringify(piResult))
  }
}

// ② 清理(弃审+删除本轮造的单;已转的先弃审会清 ERP 标记)
const docs = [
  ['PURCHASE_IN', piNo], ['PURCHASE_IN', 'PI-2026-11-0014'],
  ['QC_RETURN', 'TH-2026-11-0008'],
  ['FINISH_IN', 'FI-2026-11-0004'], ['FINISH_IN', 'FI-2026-11-0005'], ['FINISH_IN', 'FI-2026-11-0006'],
  ['OTHER_IN', 'OI-2026-11-0004'],
  ['SALE_OUT', 'SO-2026-11-0003'], ['SALE_OUT', 'SO-2026-11-0004'],
  ['MATERIAL_OUT', 'LL-2026-11-0020'], ['MATERIAL_OUT', 'LL-2026-11-0021'], ['MATERIAL_OUT', 'LL-2026-11-0022'],
  ['OTHER_OUT', 'OO-2026-11-0004'],
]
const cleanup = []
for (const [panel, no] of docs) {
  if (!no) continue
  const un = await call(panel, '弃审', { 编号: no })
  const del = await call(panel, '删除', { 编号: no })
  cleanup.push({ panel, no, 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-22.json', JSON.stringify({ piResult, cleanup }, null, 2), 'utf8')
