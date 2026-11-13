// round-03: 同一条链,但保存检验/退回行时**带上 采购单号/采购订单行号**(与界面提交一致:明细行整行回传),
// 然后走完 退回(勾特采) → 特采(两级审批) → 采购入库,并核对每站明细行的订单号 + 退货回冲额度。
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
const out = {}

const s1 = await call('PU_ORDER', '保存', {
  单据日期: today, 供应商: '福建鑫恒碳业有限公司', 供应商编码: 'YJ-XH', 币种: '人民币', 汇率: 1,
  detail: { items: [{ 物料编码: 'YJ-XH-002', 物料名称: '鑫恒酸洗（80-250）', 计量单位: 'kg', 数量: 100, 单价: 10 }] },
})
const po = String(s1.body?.data?.['编号'] || '')
await call('PU_ORDER', '审核', { 编号: po })
const l1 = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [po] })
const g1 = await post('/api/px/push/generate', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', overRatio: 0.05,
  docs: [{ sourceNo: po, batchNo: l1.body?.data?.docs?.[0]?.nextBatchNo, lines: pick1(l1.body?.data?.docs?.[0]?.lines || []) }],
})
const recvNo = String(((g1.body?.data?.['生成'] || [])[0] || {})['编号'] || '')
out.recv = (await detailRows('QC_RECV', recvNo)).map((it) => ({ 物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'] }))
await call('QC_RECV', '审核', { 编号: recvNo })
const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [recvNo] })
const g2 = await post('/api/px/push/generate', {
  panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: recvNo, lines: pick1(l2.body?.data?.docs?.[0]?.lines || []) }],
})
const inspNo = String((((g2.body?.data?.['生成'] || [])[0]?.['生成清单'] || [])[0] || {})['编号'] || '')
const inspRows = await detailRows('QC_INSP', inspNo)
out.insp = inspRows.map((it) => ({ 物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'] }))
// 保存检验行:整行回传(含 readonly 的采购单号/行号 —— 界面就是这么提交的)
const items = inspRows.map((it) => ({
  物料编码: it['物料编码'], 物料名称: it['物料名称'], 规格型号: it['规格型号'], 单位: it['单位'],
  送检数量: 100, 合格数量: 60, 不合格数量: 40, 仓库代码: it['仓库代码'],
  采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'],
}))
await call('QC_INSP', '保存', { 编号: inspNo, detail: { items } })
const audInsp = await call('QC_INSP', '审核', { 编号: inspNo })
out.inspAfterSave = (await detailRows('QC_INSP', inspNo)).map((it) => ({ 采购单号: it['采购单号'] }))
console.log('INSP ' + inspNo + ' audit=' + audInsp.status + ' rows=' + JSON.stringify(out.inspAfterSave))

// 退回单(检验审核自动生)
let thNo = ''
for (const d of (await post('/api/px/queryFormDataList', { panelCode: 'QC_RETURN', condition: {}, pageNo: 1, pageSize: 30 })).body?.data?.list || []) {
  const no = String(d['编号'] || '')
  if (!no) continue
  const its = await detailRows('QC_RETURN', no)
  if (its.length) { thNo = no; break }
}
out.ret = thNo ? (await detailRows('QC_RETURN', thNo)).map((it) => ({
  单号: thNo, 物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'], 退货数量: it['退货数量'] ?? it['数量'],
})) : []
console.log('RETURN ' + thNo + ' ' + JSON.stringify(out.ret))

// 勾特采 + 审核 → 特采单
let tcNo = ''
if (thNo) {
  const retRows = await detailRows('QC_RETURN', thNo)
  const retItems = retRows.map((it) => ({
    物料编码: it['物料编码'], 物料名称: it['物料名称'], 规格型号: it['规格型号'], 单位: it['单位'],
    送检数量: it['送检数量'], 退货数量: it['退货数量'] ?? it['数量'], 特采: 1,
    采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'],
  }))
  await call('QC_RETURN', '保存', { 编号: thNo, detail: { items: retItems } })
  out.retAfterSave = (await detailRows('QC_RETURN', thNo)).map((it) => ({ 采购单号: it['采购单号'], 特采: it['特采'] }))
  const audRet = await call('QC_RETURN', '审核', { 编号: thNo })
  console.log('AUDIT_RET ' + audRet.status + ' rows=' + JSON.stringify(out.retAfterSave))
  for (const d of (await post('/api/px/queryFormDataList', { panelCode: 'QC_TC_IN', condition: {}, pageNo: 1, pageSize: 20 })).body?.data?.list || []) {
    const no = String(d['编号'] || '')
    if (String(d['采购单号'] || '') === po) { tcNo = no; break }
  }
}
out.tc = tcNo
console.log('TC ' + tcNo)

// 特采单两级审批:提交审批 → 审批通过(一级) → 审批通过(二级=超管,同一账号也须两次)
let tcSteps = []
if (tcNo) {
  for (const btn of ['提交审批', '审批通过', '审批通过']) {
    const r = await call('QC_TC_IN', btn, { 编号: tcNo })
    tcSteps.push({ btn, status: r.status, code: r.body?.code, msg: String(r.body?.message || '').slice(0, 120), 状态: r.body?.data?.['单据状态'] })
    if ((r.body?.code ?? r.status) !== 200) break
  }
  out.tcSteps = tcSteps
  console.log('TC_STEPS ' + JSON.stringify(tcSteps))
}

// 特采生成入库 → 行级 源单编号
out.piTc = []
for (const d of (await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 30 })).body?.data?.list || []) {
  const no = String(d['编号'] || '')
  if (!no) continue
  const its = await detailRows('PURCHASE_IN', no)
  const hit = its.filter((it) => String(it['源单编号'] || '') === po)
  if (hit.length) out.piTc.push(...hit.map((it) => ({ 单号: no, 存货编码: it['存货编码'], 源单编号: it['源单编号'], 采购订单行号: it['采购订单行号'], 实收数量: it['实收数量'], 特采: it['特采'] })))
}
console.log('PI_ROWS ' + JSON.stringify(out.piTc))

// 退货回冲额度(退回单已审核 → 已退回应 >0)
const l3 = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [po] })
const rowAfter = (l3.body?.data?.docs?.[0]?.lines || [])[0] || {}
out.cap = { 数量: rowAfter['数量'], 已送: rowAfter['已送数量'], 已退回: rowAfter['已退回数量'], 剩余: rowAfter['剩余数量'], 可送上限: rowAfter['可送上限'] }
console.log('CAP ' + JSON.stringify(out.cap))

// 清理
const cleanup = []
const docs = [['PURCHASE_IN', out.piTc.map((x) => x.单号)], ['QC_TC_IN', [tcNo]], ['QC_RETURN', [thNo]],
  ['QC_INSP', [inspNo]], ['QC_RECV', [recvNo]], ['PU_ORDER', [po]]]
for (const [panel, nos] of docs) {
  for (const no of [...new Set(nos.filter(Boolean))]) {
    const un = await call(panel, '弃审', { 编号: no })
    const del = await call(panel, '删除', { 编号: no })
    cleanup.push({ panel, no, 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
  }
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
out.cleanup = cleanup
out.po = po
out.recvNo = recvNo
out.inspNo = inspNo
out.thNo = thNo
out.tcNo = tcNo
await fs.writeFile('C:/Users/Lenovo/ego/chain-pono-20261113/round-03.json', JSON.stringify(out, null, 2), 'utf8')
