// round-02(合单生单):① 供应商不一致必须被拒(且报的是供应商那条,不是数量)；
// ② 界面「生单 ▼」下拉里确实出现「合单生单」;③ 造单→审核→合单→核对行级采购单号→清理。
const fs = await import('node:fs/promises')
const task = await taskSpace('merge-generate-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
console.log('FACTORY ' + factory)
if (!String(factory).includes('测试')) throw new Error('不是测试账套,拒绝写入:' + factory)

const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const call = (panelCode, buttonName, formData) => post('/api/px/callButton', { panelCode, buttonName, formData, buttonParam: {} })
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
const today = new Date().toISOString().slice(0, 10)
const created = []
const mkOrder = async (supplier, supplierCode, item, qty) => {
  const r = await call('PU_ORDER', '保存', {
    单据日期: today, 供应商: supplier, 供应商编码: supplierCode, 币种: '人民币', 汇率: 1,
    detail: { items: [{ 物料编码: item.code, 物料名称: item.name, 计量单位: 'kg', 数量: qty, 单价: 10 }] },
  })
  const no = String(r.body?.data?.['编号'] || '')
  if (no) { created.push({ panel: 'PU_ORDER', no }); await call('PU_ORDER', '审核', { 编号: no }) }
  return no
}
const linesOf = async (no) => {
  const r = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [no] })
  const rows = r.body?.data?.docs?.[0]?.lines || []
  return {
    batch: r.body?.data?.docs?.[0]?.nextBatchNo,
    picks: rows.filter((x) => Number(x['剩余数量'] || 0) > 0).map((x) => ({ lineKey: x.lineKey, qty: Number(x['剩余数量']) })),
  }
}

// ① 异供应商:两张不同供应商的单一起合
const sa = await mkOrder('福建鑫恒碳业有限公司', 'YJ-XH', { code: 'YJ-XH-002', name: '鑫恒酸洗（80-250）' }, 25)
const sb = await mkOrder('东莞市真炙包装材料有限公司', 'YJ-ZZ', { code: 'YJ-ZL-025', name: '纸箱' }, 15)
const la = await linesOf(sa)
const lb = await linesOf(sb)
const bad = await post('/api/px/push/merge', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单',
  docs: [{ sourceNo: sa, batchNo: la.batch, lines: la.picks }, { sourceNo: sb, batchNo: lb.batch, lines: lb.picks }],
})
console.log('BAD_SUPPLIER ' + bad.status + ' code=' + bad.body?.code + ' msg=' + String(bad.body?.message || bad.body?.msg || '').slice(0, 200))

// ② 界面:生单 ▼ 下拉里应有「合单生单」
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
const menu = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')].map((el) => (el.textContent || '').trim()))
console.log('GEN_MENU ' + JSON.stringify(menu))
await page.evaluate(() => { document.querySelector('.tools .tb-menu')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

// ③ 同供应商两单 → 合单(第二个供应商那张换成同供应商的新单)
const sc = await mkOrder('福建鑫恒碳业有限公司', 'YJ-XH', { code: 'CL004', name: '切削液' }, 12)
const lc = await linesOf(sc)
const good = await post('/api/px/push/merge', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', batchNo: la.batch,
  docs: [
    { sourceNo: sa, batchNo: la.batch, lines: la.picks.map((l) => ({ ...l, 仓库: 'A仓', 仓库编码: 'CK-A', 仓位: 'A1-09-1' })) },
    { sourceNo: sc, batchNo: lc.batch, lines: lc.picks.map((l) => ({ ...l, 仓库: 'A仓', 仓库编码: 'CK-A', 仓位: 'A1-09-2' })) },
  ],
})
const mergedNo = String(good.body?.data?.['编号'] || '')
if (mergedNo) created.push({ panel: 'QC_RECV', no: mergedNo })
console.log('MERGE_OK ' + good.status + ' ' + JSON.stringify({
  编号: mergedNo, 合单来源: good.body?.data?.['合单来源'], 合单行数: good.body?.data?.['合单行数'], 合计: good.body?.data?.['本次送料合计'],
}))
const recvRows = mergedNo ? await detailRows('QC_RECV', mergedNo) : []
console.log('RECV_ROWS ' + JSON.stringify(recvRows.map((it) => ({
  物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'], 仓库: it['仓库'], 仓位: it['仓位'], 数量: it['数量'],
}))))

// ④ 清理
const cleanup = []
for (const c of [['QC_RECV', mergedNo], ['PU_ORDER', sc], ['PU_ORDER', sb], ['PU_ORDER', sa]]) {
  if (!c[1]) continue
  const un = await call(c[0], '弃审', { 编号: c[1] })
  const del = await call(c[0], '删除', { 编号: c[1] })
  cleanup.push({ panel: c[0], no: c[1], 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
await fs.writeFile('C:/Users/Lenovo/ego/merge-generate-20261113/round-02.json',
  JSON.stringify({ sa, sb, sc, bad: bad.body, menu, mergedNo, recvRows, cleanup }, null, 2), 'utf8')
