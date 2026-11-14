// round-12: 验证另一条分支 —— 需检物料(来料检验=是):采购订单 → 暂收(带仓库/仓位) → 来料检验单,
// 确认检验行的 仓库代码 / 仓位 也带下来了。结束清理。
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
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
const call = (panelCode, buttonName, formData) => post('/api/px/callButton', { panelCode, buttonName, formData, buttonParam: {} })
async function rowsOf(panelCode, docNo) {
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

const today = new Date().toISOString().slice(0, 10)
const out = { steps: [] }
// ① 建单(需检物料 YJ-XH-002)
const save1 = await call('PU_ORDER', '保存', {
  单据日期: today, 供应商: '福建鑫恒碳业有限公司', 供应商编码: 'YJ-XH', 币种: '人民币', 汇率: 1,
  detail: { items: [{ 物料编码: 'YJ-XH-002', 物料名称: '鑫恒酸洗（80-250）', 计量单位: 'kg', 数量: 50, 单价: 10 }] },
})
const po = String(save1.body?.data?.['编号'] || '')
out.po = po
out.steps.push({ 建单: po })
await call('PU_ORDER', '审核', { 编号: po })

// ② 生单(带仓库/仓位)
const lines = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [po] })
const rows = lines.body?.data?.docs?.[0]?.lines || []
const batchNo = lines.body?.data?.docs?.[0]?.nextBatchNo
const r0 = rows.find((r) => Number(r['剩余数量'] || 0) > 0)
const gen = await post('/api/px/push/generate', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', overRatio: 0.05,
  docs: [{ sourceNo: po, batchNo, lines: [{ lineKey: r0.lineKey, qty: Number(r0['剩余数量']), 仓库: 'A仓', 仓库编码: 'CK-A', 仓库启用仓位管理: '1', 仓位: 'A1-09-1' }] }],
})
const recvNo = String(((gen.body?.data?.['生成'] || [])[0] || {})['编号'] || '')
out.recv = recvNo
out.steps.push({ 暂收单: recvNo })
out.recvRows = (await rowsOf('QC_RECV', recvNo)).map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'] }))

// ③ 暂收单审核 → 生成检验单(需检物料会进来料检验单)
await call('QC_RECV', '审核', { 编号: recvNo })
const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [recvNo] })
const picks = (l2.body?.data?.docs?.[0]?.lines || []).filter((r) => Number(r['剩余数量'] || 0) > 0)
  .map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
const g2 = await post('/api/px/push/generate', { panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: recvNo, lines: picks }] })
out.china = g2.body?.data?.['生成']
const chain = ((g2.body?.data?.['生成'] || [])[0]?.['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] }))
out.chain = chain
out.chainRows = []
for (const c of chain) {
  const its = await rowsOf(String(c['面板']), String(c['编号']))
  for (const it of its) {
    out.chainRows.push({ 面板: c['面板'], 编号: c['编号'], 物料编码: it['物料编码'] || it['存货编码'], 仓库: it['仓库'] || it['仓库代码'], 仓位: it['仓位'] })
  }
}

// ④ 清理:倒序删(已审核的先弃审)
const cleanup = []
for (const c of [...chain.map((x) => [String(x['面板']), String(x['编号'])]), ['QC_RECV', recvNo], ['PU_ORDER', po]]) {
  const un = await call(c[0], '弃审', { 编号: c[1] })
  const del = await call(c[0], '删除', { 编号: c[1] })
  cleanup.push({ panel: c[0], no: c[1], 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
}
out.cleanup = cleanup
console.log('PO ' + po + ' RECV ' + recvNo)
console.log('RECV_ROWS ' + JSON.stringify(out.recvRows))
console.log('CHAIN ' + JSON.stringify(chain))
console.log('CHAIN_ROWS ' + JSON.stringify(out.chainRows))
console.log('CLEANUP ' + JSON.stringify(cleanup))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-12.json', JSON.stringify(out, null, 2), 'utf8')
