// round-08: 直连接口取「转ERP」的真实报错(比界面快,消息也不会消失),把 5 张还没成功的单逐个问一遍。
// 只读语义:转ERP 失败不会改动单据;成功则会记 ERP单号(测试账套,可接受)。
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
const erp = async (panel, no) => {
  const r = await post('/api/px/callButton', { panelCode: panel, buttonName: '转ERP', formData: { 编号: no, 单据编号: no }, buttonParam: {} })
  return { panel, no, status: r.status, code: r.body?.code, msg: String(r.body?.message || '').slice(0, 400), data: r.body?.data }
}
const out = []
for (const [p, n] of [
  ['FINISH_IN', 'FI-2026-10-0001'],
  ['MATERIAL_OUT', 'LL-2026-11-0008'],
  ['SALE_OUT', 'XSCK-20270901-00001'],
]) {
  const r = await erp(p, n)
  out.push(r)
  console.log(p + ' ' + n + ' → ' + r.status + ' code=' + r.code + ' msg=' + r.msg + ' data=' + JSON.stringify(r.data))
}
// MATERIAL_OUT 明细到底用哪一列放物料
const mo = await post('/api/px/queryFormDataList', { panelCode: 'MATERIAL_OUT', condition: {}, keyword: 'LL-2026-11-0008', pageNo: 1, pageSize: 5 })
const doc = (mo.body?.data?.list || []).find((d) => String(d['编号']) === 'LL-2026-11-0008')
const det = doc?.detail && typeof doc.detail === 'object' ? doc.detail : {}
const key = Object.keys(det).find((k) => Array.isArray(det[k]))
const rows = (det[key] || []).slice(0, 2)
console.log('MATERIAL_OUT detailKey=' + key + ' 行键=' + JSON.stringify(rows.map((r) => Object.keys(r).slice(0, 18))))
console.log('MATERIAL_OUT 行样本=' + JSON.stringify(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== '')))).slice(0, 600))
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-08.json', JSON.stringify({ results: out, materialOutRow: rows }, null, 2), 'utf8')
