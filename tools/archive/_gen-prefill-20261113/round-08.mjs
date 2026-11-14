// round-08: 测试账套自建一张采购订单 → 审核 → 生单时按行选仓库/仓位 → 读回 暂收 → 检验/入库 是否带下来。
// 全程只在 YINJIA-MES·测试库;结束把造出来的单据删掉(不留脏数据)。
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
console.log('FACTORY ' + factory)
if (!factory.includes('测试')) throw new Error('当前不是测试账套,拒绝写入: ' + factory)
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
const flat = (list) => (list || []).flatMap((d) => {
  const det = d?.detail && typeof d.detail === 'object' ? Object.values(d.detail).find((v) => Array.isArray(v)) : null
  return (det && det.length ? det : [d])
})
const created = []

// ① 建单(草稿):表头 + 一行明细(A-32-01, 100)
const today = new Date().toISOString().slice(0, 10)
const save1 = await call('PU_ORDER', '保存', {
  单据日期: today, 供应商: '福建鑫恒碳业有限公司', 供应商编码: 'YJ-XH', 币种: '人民币', 汇率: 1,
  detail: { items: [{ 物料编码: 'A-32-01', 物料名称: 'S阻垢炭棒/滤芯', 计量单位: '支', 数量: 100, 单价: 10 }] },
})
const po = String(save1.body?.data?.['编号'] || '')
console.log('PO ' + po + ' ' + save1.status + ' ' + JSON.stringify(save1.body?.data || save1.body).slice(0, 200))
if (!po) throw new Error('建单失败')
created.push({ panel: 'PU_ORDER', no: po })

// ② 审核(本次新口径:有审批权即可直审)
const aud = await call('PU_ORDER', '审核', { 编号: po, 审核意见: '【验收】预填仓库仓位' })
console.log('AUDIT ' + aud.status + ' ' + JSON.stringify(aud.body?.data || aud.body).slice(0, 200))

// ③ 生单候选 + 按行带 仓库/仓位
const lines = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [po] })
const rows = lines.body?.data?.docs?.[0]?.lines || []
const batchNo = lines.body?.data?.docs?.[0]?.nextBatchNo
console.log('LINES ' + JSON.stringify(rows.map((r) => ({ k: r.lineKey, 剩余: r['剩余数量'], 仓库: r['仓库'] }))))
const r0 = rows.find((r) => Number(r['剩余数量'] || 0) > 0)
if (!r0) throw new Error('生单候选没有剩余行')
const gen = await post('/api/px/push/generate', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', overRatio: 0.05,
  docs: [{
    sourceNo: po, batchNo,
    lines: [{ lineKey: r0.lineKey, qty: Number(r0['剩余数量']), 仓库: 'A仓', 仓库编码: 'CK-A', 仓库启用仓位管理: '1', 仓位: 'A1-09-1', 仓位名称: 'A1-09-1' }],
  }],
})
const made = (gen.body?.data?.['生成'] || [])[0] || {}
console.log('GEN ' + gen.status + ' ' + JSON.stringify(made).slice(0, 300))
const recvNo = String(made['编号'] || '')
if (recvNo) created.push({ panel: 'QC_RECV', no: recvNo })

// ④ 读回暂收单行
const recv = await post('/api/px/queryFormDataList', { panelCode: 'QC_RECV', condition: {}, pageNo: 1, pageSize: 5 })
const recvLines = flat(recv.body?.data?.list).filter((it) => (it['单据编号'] || '') === recvNo)
  .map((it) => ({ 单据编号: recvNo, 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'] }))
console.log('RECV_LINES ' + JSON.stringify(recvLines))

// ⑤ 暂收 → 检验或入库单,再读回
let chainDocs = []
let chainLines = []
if (recvNo) {
  const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [recvNo] })
  const rr = l2.body?.data?.docs?.[0]?.lines || []
  const picks = rr.filter((r) => Number(r['剩余数量'] || 0) > 0).map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
  if (picks.length) {
    const g2 = await post('/api/px/push/generate', {
      panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: recvNo, lines: picks }],
    })
    const made2 = g2.body?.data?.['生成'] || []
    chainDocs = made2.flatMap((m) => (m['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] })))
    if (!chainDocs.length && made2[0]) chainDocs = [{ 面板: made2[0]['面板'], 编号: made2[0]['编号'] }]
    for (const c of chainDocs) created.push({ panel: c['面板'], no: c['编号'] })
    for (const c of chainDocs) {
      const r = await post('/api/px/queryFormDataList', { panelCode: c['面板'] === 'QC_INSP' ? 'QC_INSP' : c['面板'], condition: {}, pageNo: 1, pageSize: 5 })
      const ls = flat(r.body?.data?.list).filter((it) => (it['单据编号'] || '') === c['编号'])
      for (const it of ls) {
        chainLines.push({
          面板: c['面板'], 单据编号: c['编号'], 物料编码: it['物料编码'] || it['存货编码'],
          仓库: it['仓库'] || it['仓库代码'], 仓位: it['仓位'],
        })
      }
    }
  }
}
console.log('CHAIN_DOCS ' + JSON.stringify(chainDocs))
console.log('CHAIN_LINES ' + JSON.stringify(chainLines))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-08.json',
  JSON.stringify({ po, recvNo, recvLines, chainDocs, chainLines, created }, null, 2), 'utf8')
