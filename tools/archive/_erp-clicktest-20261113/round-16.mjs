// round-16: 收尾 —— 删掉本轮为测试转ERP造出来的单据(保持测试账套干净),并打印最终结果汇总。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
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
const docs = [
  ['PURCHASE_IN', 'PI-2026-11-0013'],
  ['QC_RECV', 'SL-2026-11-0010'],
  ['PU_ORDER', 'PO-2026-11-0016'],
  ['PU_ORDER', 'PO-2026-11-0015'],
  ['OTHER_IN', 'OI-2026-11-0003'],
  ['QC_RETURN', 'TH-2026-11-0007'],
  ['QC_RETURN', 'TH-2026-11-0006'],
  ['OTHER_OUT', 'OO-2026-11-0003'],
  ['OTHER_OUT', 'OO-2026-11-0002'],
  ['OTHER_OUT', 'OO-2026-11-0001'],
  ['SALE_OUT', 'SO-2026-11-0002'],
  ['SALE_OUT', 'SO-2026-11-0001'],
  ['FINISH_IN', 'FI-2026-11-0003'],
  ['FINISH_IN', 'FI-2026-11-0002'],
  ['MATERIAL_OUT', 'LL-2026-11-0019'],
  ['MATERIAL_OUT', 'LL-2026-11-0018'],
]
const cleanup = []
for (const [panel, no] of docs) {
  const un = await call(panel, '弃审', { 编号: no })
  const del = await call(panel, '删除', { 编号: no })
  cleanup.push({ panel, no, 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-16.json', JSON.stringify(cleanup, null, 2), 'utf8')
