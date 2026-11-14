// round-02: ① 取"已成功转过ERP"的入库单行,学一个**金蝶沙箱里确实存在**的存货编码与仓库;
// ② 用它造 2 张同供应商采购订单 → 合单生单(表头多单号) → 暂收 → 审核 → 采购入库(草稿→审核);
// ③ 界面点「转ERP」,看是否正常、是否按行挂源单。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
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

// ① 学一个已知可推的存货/仓库(取一张已转ERP的采购入库单)
const pi = await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 100 })
const pushed = (pi.body?.data?.list || []).find((d) => String(d['是否已转ERP'] ?? '') === '是')
let known = null
if (pushed) {
  const rows = await detailRows('PURCHASE_IN', String(pushed['编号']))
  const r0 = rows[0] || {}
  known = { 存货编码: r0['存货编码'], 仓库: r0['仓库'], 仓库编码: r0['仓库编码'], 计量单位: r0['计量单位'], 单价: r0['单价'], 供应商: pushed['供应商'] }
}
console.log('KNOWN ' + JSON.stringify(known))
if (!known?.存货编码) throw new Error('没找到已成功推送过的入库单样本,无法保证金蝶沙箱里有对应商品')

const today = new Date().toISOString().slice(0, 10)
const supplier = known.供应商 || '福建鑫恒碳业有限公司'
const mkOrder = async (qty) => {
  const r = await call('PU_ORDER', '保存', {
    单据日期: today, 供应商: supplier, 供应商编码: 'YJ-XH', 币种: '人民币', 汇率: 1,
    detail: { items: [{ 行号: 1, 物料编码: known.存货编码, 物料名称: '合单验证物料', 计量单位: known.计量单位 || 'kg', 数量: qty, 单价: known.单价 || 10, 仓库: known.仓库 }] },
  })
  const no = String(r.body?.data?.['编号'] || '')
  await call('PU_ORDER', '审核', { 编号: no })
  return no
}
const o1 = await mkOrder(30)
const o2 = await mkOrder(20)
console.log('ORDERS ' + JSON.stringify({ o1, o2 }))

const linesOf = async (no) => {
  const r = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [no] })
  const rows = r.body?.data?.docs?.[0]?.lines || []
  return { batch: r.body?.data?.docs?.[0]?.nextBatchNo, picks: rows.filter((x) => Number(x['剩余数量'] || 0) > 0).map((x) => ({ lineKey: x.lineKey, qty: Number(x['剩余数量']) })) }
}
const l1 = await linesOf(o1)
const l2 = await linesOf(o2)
const merge = await post('/api/px/push/merge', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', batchNo: l1.batch,
  docs: [
    { sourceNo: o1, batchNo: l1.batch, lines: l1.picks.map((l) => ({ ...l, 仓库: known.仓库 })) },
    { sourceNo: o2, batchNo: l2.batch, lines: l2.picks.map((l) => ({ ...l, 仓库: known.仓库 })) },
  ],
})
const recvNo = String(merge.body?.data?.['编号'] || '')
console.log('MERGE ' + merge.status + ' ' + JSON.stringify(merge.body?.data || merge.body).slice(0, 240))
await call('QC_RECV', '审核', { 编号: recvNo })
const l3 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [recvNo] })
const picks = (l3.body?.data?.docs?.[0]?.lines || []).filter((r) => Number(r['剩余数量'] || 0) > 0).map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
const g = await post('/api/px/push/generate', { panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: recvNo, lines: picks }] })
const chain = ((g.body?.data?.['生成'] || [])[0]?.['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] }))
const piNo = String((chain.find((c) => c['面板'] === 'PURCHASE_IN') || {})['编号'] || '')
console.log('RECV ' + recvNo + ' CHAIN=' + JSON.stringify(chain))
// 入库单审核(转ERP 前提)
const audPi = piNo ? await call('PURCHASE_IN', '审核', { 编号: piNo }) : { status: 0 }
const piRows = piNo ? await detailRows('PURCHASE_IN', piNo) : []
const piHead = piNo ? ((await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, keyword: piNo, pageNo: 1, pageSize: 5 })).body?.data?.list || []).find((d) => String(d['编号']) === piNo) : null
const out = {
  known, o1, o2, recvNo, piNo,
  auditPi: { status: audPi.status, data: audPi.body?.data },
  piHeadPoNo: piHead?.['采购订单号'],
  piLines: piRows.map((it) => ({ 存货编码: it['存货编码'], 源单编号: it['源单编号'], 采购订单行号: it['采购订单行号'], 实收数量: it['实收数量'], 仓库: it['仓库'] })),
}
console.log('PI ' + piNo + ' head采购订单号=' + JSON.stringify(out.piHeadPoNo) + ' rows=' + JSON.stringify(out.piLines))

// ② 界面:打开采购入库单 → 选中该单 → 点「转ERP」
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(6000)
const sel = await page.evaluate((no) => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  const hit = rows.find((r) => (r.textContent || '').includes(no))
  if (!hit) return { ok: false }
  hit.click()
  return { ok: true }
}, piNo)
console.log('SELECT_PI ' + JSON.stringify(sel))
await page.waitForTimeout(3000)
const before = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')]
  const t = g.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '转ERP')
  return {
    hasErpBtn: !!t,
    disabled: (t?.querySelector('.tb-main')?.className || '').includes('disabled'),
    doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
    status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  }
})
console.log('BEFORE ' + JSON.stringify(before))
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')]
  const t = g.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '转ERP')
  t?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(25000)
const after = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()),
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
}))
console.log('AFTER ' + JSON.stringify(after))
out.clickResult = after
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-02.json', JSON.stringify(out, null, 2), 'utf8')
