// round-02: 造一条完整链(订单→暂收→检验→退回含特采→特采),**不清理**,把单号打出来给下一步排查。
const fs = await import('node:fs/promises')
const task = await taskSpace('chain-pono-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
if (!String(factory).includes('测试')) throw new Error('不是测试账套:' + factory)
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const call = (p, b, f) => post('/api/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: {} })
const detailRows = async (panelCode, docNo) => {
  const res = await post('/api/px/queryFormDataList', { panelCode, condition: {}, keyword: docNo, pageNo: 1, pageSize: 20 })
  for (const d of res.body?.data?.list || []) {
    const det = d?.detail && typeof d.detail === 'object' ? d.detail : {}
    for (const v of Object.values(det)) {
      if (!Array.isArray(v) || !v.length) continue
      const hit = v.filter((it) => String(it['单据编号'] || d['编号'] || '') === docNo)
      if (hit.length) return hit
      if (String(d['编号'] || '') === docNo) return v
    }
  }
  return []
}
const pick1 = (rows) => rows.filter((r) => Number(r['剩余数量'] || 0) > 0).map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
const today = new Date().toISOString().slice(0, 10)

const s1 = await call('PU_ORDER', '保存', {
  单据日期: today, 供应商: '福建鑫恒碳业有限公司', 供应商编码: 'YJ-XH', 币种: '人民币', 汇率: 1,
  detail: { items: [{ 物料编码: 'YJ-XH-002', 物料名称: '鑫恒酸洗（80-250）', 计量单位: 'kg', 数量: 100, 单价: 10 }] },
})
const po = String(s1.body?.data?.['编号'] || '')
await call('PU_ORDER', '审核', { 编号: po })
const l1 = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [po] })
const rows1 = l1.body?.data?.docs?.[0]?.lines || []
const g1 = await post('/api/px/push/generate', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', overRatio: 0.05,
  docs: [{ sourceNo: po, batchNo: l1.body?.data?.docs?.[0]?.nextBatchNo, lines: pick1(rows1) }],
})
const recvNo = String(((g1.body?.data?.['生成'] || [])[0] || {})['编号'] || '')
await call('QC_RECV', '审核', { 编号: recvNo })
const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [recvNo] })
const g2 = await post('/api/px/push/generate', {
  panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: recvNo, lines: pick1(l2.body?.data?.docs?.[0]?.lines || []) }],
})
const inspNo = String((((g2.body?.data?.['生成'] || [])[0]?.['生成清单'] || [])[0] || {})['编号'] || '')
const inspRows = await detailRows('QC_INSP', inspNo)
const items = inspRows.map((it) => ({
  物料编码: it['物料编码'], 物料名称: it['物料名称'], 规格型号: it['规格型号'], 单位: it['单位'],
  送检数量: 100, 合格数量: 60, 不合格数量: 40, 仓库代码: it['仓库代码'],
}))
await call('QC_INSP', '保存', { 编号: inspNo, detail: { items } })
await call('QC_INSP', '审核', { 编号: inspNo })

// 退回单(检验审核自动生) → 勾特采 → 审核
let thNo = ''
for (const d of (await post('/api/px/queryFormDataList', { panelCode: 'QC_RETURN', condition: {}, pageNo: 1, pageSize: 30 })).body?.data?.list || []) {
  const no = String(d['编号'] || '')
  if (!no || no === thNo) continue
  const its = await detailRows('QC_RETURN', no)
  if (its.some((it) => String(it['采购单号'] || '') === po)) { thNo = no; break }
}
let tcNo = ''
if (thNo) {
  const retRows = await detailRows('QC_RETURN', thNo)
  const retItems = retRows.map((it) => ({
    物料编码: it['物料编码'], 物料名称: it['物料名称'], 规格型号: it['规格型号'], 单位: it['单位'],
    送检数量: it['送检数量'], 退货数量: it['退货数量'] ?? it['数量'], 特采: 1,
  }))
  await call('QC_RETURN', '保存', { 编号: thNo, detail: { items: retItems } })
  const aud = await call('QC_RETURN', '审核', { 编号: thNo })
  console.log('AUDIT_RET ' + aud.status)
  for (const d of (await post('/api/px/queryFormDataList', { panelCode: 'QC_TC_IN', condition: {}, pageNo: 1, pageSize: 20 })).body?.data?.list || []) {
    const no = String(d['编号'] || '')
    if (String(d['采购单号'] || '') === po) { tcNo = no; break }
  }
}
console.log(JSON.stringify({ po, recvNo, inspNo, thNo, tcNo }))
await fs.writeFile('C:/Users/Lenovo/ego/chain-pono-20261113/round-02.json', JSON.stringify({ po, recvNo, inspNo, thNo, tcNo }, null, 2), 'utf8')
