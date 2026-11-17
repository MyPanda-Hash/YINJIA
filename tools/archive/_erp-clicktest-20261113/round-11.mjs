// round-11: 看新建的 3 张单里到底落下了什么(计量单位/仓库/基本单位),并查 SALE_OUT 的必填字段。
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
const detailRows = async (panel, no) => {
  const res = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, keyword: no, pageNo: 1, pageSize: 20 })
  for (const d of res.body?.data?.list || []) {
    const det = d?.detail && typeof d.detail === 'object' ? d.detail : {}
    for (const v of Object.values(det)) {
      if (!Array.isArray(v) || !v.length) continue
      const hit = v.filter((it) => String(it['单据编号'] || d['编号'] || '') === no)
      if (hit.length) return hit
      if (String(d['编号'] || '') === no) return v
    }
  }
  return []
}
for (const [panel, no] of [['FINISH_IN', 'FI-2026-11-0002'], ['MATERIAL_OUT', 'LL-2026-11-0019'], ['SALE_OUT', ''], ['OTHER_OUT', 'OO-2026-11-0002']]) {
  if (!no) continue
  const rows = await detailRows(panel, no)
  const r = rows[0] || {}
  console.log(panel + ' ' + no + ' 行=' + JSON.stringify(Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== '').slice(0, 22))))
}
// 面板字段(必填/单位相关) —— 用面板配置接口读 detail 字段
for (const panel of ['SALE_OUT', 'FINISH_IN', 'MATERIAL_OUT', 'OTHER_OUT']) {
  const cfg = await post('/api/px/getPanelConfig', { panelCode: panel }).catch(() => ({}))
  const fields = (cfg.body?.data?.metadata?.detail?.tabs || []).flatMap((t) => t.fields || [])
  const det = fields.filter((f) => ['计量单位', '单位', '仓库', '仓库编码', '基本单位名称', '经手人', '经手人编码', '数量', '实收数量'].includes(f.dataName))
  console.log(panel + ' 关键字段: ' + JSON.stringify(det.map((f) => ({ n: f.dataName, req: f.required, ro: f.readonly || f.editable === false }))))
}
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-11.json', JSON.stringify({ ok: true }, null, 2), 'utf8')

