// round-07: 用会话直连接口验证「生单时按行预填仓库/仓位 → 暂收 → 检验/入库」整条链
// (界面上的两列与「应用到所有行」按钮已在 round-06 取证:heads 含 仓库/仓位、按钮存在、下拉有 9 个仓 / 168 个仓位)
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
const flat = (list) => (list || []).flatMap((d) => {
  const det = d?.detail && typeof d.detail === 'object' ? Object.values(d.detail).find((v) => Array.isArray(v)) : null
  return (det && det.length ? det : [d]).map((it) => it)
})

// ① 找一个还有剩余量(剩余数量 > 0)的已审核采购订单
const lst = await post('/api/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 80 })
const docs = (lst.body?.data?.list || []).map((d) => ({ no: d['编号'], st: d['单据状态'] })).filter((d) => d.st === '已审核')
let picked = null
for (const d of docs.slice(0, 20)) {
  const lines = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [d.no] })
  const rows = lines.body?.data?.docs?.[0]?.lines || []
  const usable = rows.filter((r) => Number(r['剩余数量'] || 0) > 0)
  if (usable.length) { picked = { no: d.no, batchNo: lines.body?.data?.docs?.[0]?.nextBatchNo, rows: usable }; break }
}
if (!picked) { console.log('NO_DOC'); throw new Error('没有剩余量>0 的已审核采购订单') }
const row0 = picked.rows[0]
console.log('PICKED ' + JSON.stringify({ no: picked.no, batch: picked.batchNo, lineKey: row0.lineKey, 剩余: row0['剩余数量'], 仓库: row0['仓库'], 仓位: row0['仓位'] }))

// ② 生单:带上按行选的 仓库/仓位(与前端 whBinPayload 同口径)
const gen = await post('/api/px/push/generate', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', overRatio: 0.05,
  docs: [{
    sourceNo: picked.no,
    batchNo: picked.batchNo,
    lines: [{ lineKey: row0.lineKey, qty: Number(row0['剩余数量']), 仓库: 'A仓', 仓库编码: 'CK-A', 仓库启用仓位管理: '1', 仓位: 'A1-09-1', 仓位名称: 'A仓-A1-09-1' }],
  }],
})
console.log('GEN ' + gen.status + ' ' + JSON.stringify(gen.body?.data || gen.body).slice(0, 300))
const madeRecv = (gen.body?.data?.['生成'] || [])[0]?.['编号'] || ''
console.log('RECV_NO ' + madeRecv)

// ③ 读回暂收单明细:仓库/仓位 是否落下
const recv = await post('/api/px/queryFormDataList', { panelCode: 'QC_RECV', condition: { 单据编号: madeRecv }, pageNo: 1, pageSize: 5 })
const recvLines = flat(recv.body?.data?.list).map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'], 仓位名称: it['仓位名称'] }))
console.log('RECV ' + JSON.stringify(recvLines))

// ④ 暂收 → 检验或入库单(同一会话、整单剩余行),再读回检验/入库行的 仓库/仓位
let inspLines = []
let inLines = []
if (madeRecv) {
  const lines = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [madeRecv] })
  const recvRows = lines.body?.data?.docs?.[0]?.lines || []
  const qty = {}
  for (const r of recvRows) if (Number(r['剩余数量'] || 0) > 0) qty[r.lineKey] = Number(r['剩余数量'])
  if (Object.keys(qty).length) {
    const g2 = await post('/api/px/push/generate', {
      panelCode: 'QC_RECV', action: '生成检验或入库单',
      docs: [{ sourceNo: madeRecv, lines: Object.entries(qty).map(([lineKey, q]) => ({ lineKey, qty: q })) }],
    })
    const made = g2.body?.data?.['生成'] || []
    // 免检直达 → 采购入库单；需检 → 来料检验单
    for (const m of made) {
      const sub = m['生成清单'] || []
      for (const s of sub) {
        const panel = s['面板']
        const no = s['编号']
        if (panel === 'QC_INSP') {
          const r = await post('/api/px/queryFormDataList', { panelCode: 'QC_INSP', condition: {}, pageNo: 1, pageSize: 5 })
          inspLines = flat(r.body?.data?.list).filter((it) => (it['单据编号'] || '') === no)
            .map((it) => ({ 单据编号: no, 物料编码: it['物料编码'], 仓库代码: it['仓库代码'], 仓位: it['仓位'] }))
        } else if (panel === 'PURCHASE_IN') {
          const r = await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 5 })
          inLines = flat(r.body?.data?.list).filter((it) => (it['单据编号'] || '') === no)
            .map((it) => ({ 单据编号: no, 存货编码: it['存货编码'], 仓库: it['仓库'], 仓位: it['仓位'] }))
        }
      }
    }
    console.log('CHAIN ' + JSON.stringify({ made: made.map((m) => m['编号']) }))
    console.log('INSP ' + JSON.stringify(inspLines.slice(0, 4)))
    console.log('IN ' + JSON.stringify(inLines.slice(0, 4)))
    await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-07-2.json',
      JSON.stringify({ g2: g2.body?.data, inspLines, inLines }, null, 2), 'utf8')
  }
}
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-07.json',
  JSON.stringify({ picked: { no: picked.no, lineKey: row0.lineKey }, gen: gen.body?.data, madeRecv, recvLines, inspLines, inLines }, null, 2), 'utf8')
