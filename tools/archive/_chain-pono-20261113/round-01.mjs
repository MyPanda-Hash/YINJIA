// round-01(全链行级采购单号):测试账套跑完整条链
// 采购订单 → 送料暂收(单张「生单」) → 来料检验 → 暂收退料(有不合格行) → 特采 → 采购入库
// 逐步读回**明细行**上的 采购单号 / 源单编号 / 采购订单行号,并检查退货回冲口径。
const fs = await import('node:fs/promises')
const task = await taskSpace('chain-pono-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(5000)
if (await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await page.waitForTimeout(8000)
}
async function switchFactory(name) {
  const cur = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
  if (cur === name) return cur
  await page.evaluate(() => {
    const el = document.querySelector('.factory')
    el?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    el?.click()
  })
  await page.waitForTimeout(900)
  const picked = await page.evaluate((want) => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item, .factory-item')]
    const t = items.find((el) => (el.textContent || '').trim() === want)
    if (!t) return ''
    t.click()
    return (t.textContent || '').trim()
  }, name)
  if (!picked) return cur + '(未找到)'
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const inp = document.querySelector('.factory-switch-dialog input')
    if (inp) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(inp, '123456')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.factory-switch-dialog button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
    btn?.click()
  })
  await page.waitForTimeout(9000)
  return await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
}
const factory = await switchFactory('YINJIA-MES·测试库')
console.log('FACTORY ' + factory)
if (!String(factory).includes('测试')) throw new Error('不是测试账套,拒绝写入:' + factory)

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
const created = []
const out = {}

// ① 采购订单(需检物料,方便走检验;数量 100)
const save1 = await call('PU_ORDER', '保存', {
  单据日期: today, 供应商: '福建鑫恒碳业有限公司', 供应商编码: 'YJ-XH', 币种: '人民币', 汇率: 1,
  detail: { items: [{ 物料编码: 'YJ-XH-002', 物料名称: '鑫恒酸洗（80-250）', 计量单位: 'kg', 数量: 100, 单价: 10 }] },
})
const po = String(save1.body?.data?.['编号'] || '')
created.push({ panel: 'PU_ORDER', no: po })
await call('PU_ORDER', '审核', { 编号: po })
console.log('PO ' + po)

// ② 单张「生单」→ 暂收(generateBatch 路径;验证 采购单号 是否落到明细行)
const l1 = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [po] })
const rows1 = l1.body?.data?.docs?.[0]?.lines || []
const batch1 = l1.body?.data?.docs?.[0]?.nextBatchNo
const gen1 = await post('/api/px/push/generate', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', overRatio: 0.05,
  docs: [{ sourceNo: po, batchNo: batch1, lines: pick1(rows1).map((l) => ({ ...l, 仓库: 'A仓', 仓库编码: 'CK-A', 仓位: 'A1-09-1' })) }],
})
const recvNo = String(((gen1.body?.data?.['生成'] || [])[0] || {})['编号'] || '')
created.push({ panel: 'QC_RECV', no: recvNo })
out.recv = (await detailRows('QC_RECV', recvNo)).map((it) => ({
  物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'], 仓库: it['仓库'], 仓位: it['仓位'],
}))
console.log('RECV ' + recvNo + ' ' + JSON.stringify(out.recv))

// ③ 暂收审核 → 生成检验单
await call('QC_RECV', '审核', { 编号: recvNo })
const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [recvNo] })
const gen2 = await post('/api/px/push/generate', {
  panelCode: 'QC_RECV', action: '生成检验或入库单',
  docs: [{ sourceNo: recvNo, lines: pick1(l2.body?.data?.docs?.[0]?.lines || []) }],
})
const chain2 = ((gen2.body?.data?.['生成'] || [])[0]?.['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] }))
for (const c of chain2) created.push({ panel: c['面板'], no: c['编号'] })
const inspNo = (chain2.find((c) => c['面板'] === 'QC_INSP') || {})['编号'] || ''
console.log('INSP ' + inspNo + ' chain=' + JSON.stringify(chain2))
out.insp = inspNo ? (await detailRows('QC_INSP', inspNo)).map((it) => ({
  物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'],
})) : []
console.log('INSP_ROWS ' + JSON.stringify(out.insp))

// ④ 检验行填不合格数量(40/60 → 合格 60 不合格 40)→ 审核 → 自动生 采购入库(合格) + 暂收退回(不良)
if (inspNo) {
  const inspRows = await detailRows('QC_INSP', inspNo)
  const items = inspRows.map((it) => ({
    物料编码: it['物料编码'], 物料名称: it['物料名称'], 规格型号: it['规格型号'], 单位: it['单位'],
    送检数量: 100, 合格数量: 60, 不合格数量: 40, 仓库代码: it['仓库代码'], 仓位: it['仓位'],
    采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'],
  }))
  const saveInsp = await call('QC_INSP', '保存', { 编号: inspNo, detail: { items } })
  console.log('SAVE_INSP ' + saveInsp.status + ' ' + JSON.stringify(saveInsp.body?.data || saveInsp.body).slice(0, 160))
  const audInsp = await call('QC_INSP', '审核', { 编号: inspNo })
  console.log('AUDIT_INSP ' + audInsp.status + ' ' + JSON.stringify(audInsp.body?.data || audInsp.body).slice(0, 160))
}

// ⑤ 读回:检验审核自动生的 采购入库(合格品) + 暂收退回单
const piList = await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 30 })
const piDocs = (piList.body?.data?.list || []).map((d) => String(d['编号'] || ''))
const freshPi = piDocs.find((n) => n.startsWith('PI-') && !created.some((c) => c.no === n))
out.pi = []
for (const no of piDocs.slice(0, 6)) {
  // 只找本链产生的(行上 源单编号 = 本单采购订单)
  const its = await detailRows('PURCHASE_IN', no)
  const hit = its.filter((it) => String(it['源单编号'] || '') === po)
  if (hit.length) {
    created.push({ panel: 'PURCHASE_IN', no })
    out.pi.push(...hit.map((it) => ({ 单号: no, 存货编码: it['存货编码'], 源单编号: it['源单编号'], 采购订单行号: it['采购订单行号'], 实收数量: it['实收数量'] })))
    break
  }
}
console.log('PI_ROWS ' + JSON.stringify(out.pi) + ' freshPi=' + freshPi)

// ⑥ 暂收退回单(检验审核自动生成,不良行) → 读回采购单号 → 勾特采 → 审核 → 特采单
const thList = await post('/api/px/queryFormDataList', { panelCode: 'QC_RETURN', condition: {}, pageNo: 1, pageSize: 30 })
let thNo = ''
out.ret = []
for (const d of thList.body?.data?.list || []) {
  const no = String(d['编号'] || '')
  if (!no || created.some((c) => c.no === no)) continue
  const its = await detailRows('QC_RETURN', no)
  const hit = its.filter((it) => String(it['采购单号'] || '') === po || String(it['采购订单行号'] || '') !== '')
  if (!hit.length) continue
  thNo = no
  out.ret = hit.map((it) => ({ 单号: no, 物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'], 退货数量: it['退货数量'] ?? it['数量'] }))
  break
}
console.log('RETURN ' + thNo + ' ' + JSON.stringify(out.ret))
if (thNo) {
  created.push({ panel: 'QC_RETURN', no: thNo })
  // 勾特采(列 特采=1)后审核 → 自动生成特采单
  const retRows = await detailRows('QC_RETURN', thNo)
  const items = retRows.map((it) => ({
    物料编码: it['物料编码'], 物料名称: it['物料名称'], 规格型号: it['规格型号'], 单位: it['单位'],
    送检数量: it['送检数量'], 退货数量: it['退货数量'] ?? it['数量'], 特采: 1,
    采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'],
  }))
  const saveRet = await call('QC_RETURN', '保存', { 编号: thNo, detail: { items } })
  console.log('SAVE_RET ' + saveRet.status + ' ' + JSON.stringify(saveRet.body?.data || saveRet.body).slice(0, 160))
  const audRet = await call('QC_RETURN', '审核', { 编号: thNo })
  console.log('AUDIT_RET ' + audRet.status + ' ' + JSON.stringify(audRet.body?.data || audRet.body).slice(0, 160))
}

// ⑦ 特采单(表头 采购单号 = 行级订单号)→ 审核 → 采购入库(源单编号)
const tcList = await post('/api/px/queryFormDataList', { panelCode: 'QC_TC_IN', condition: {}, pageNo: 1, pageSize: 20 })
let tcNo = ''
for (const d of tcList.body?.data?.list || []) {
  const no = String(d['编号'] || '')
  if (!no || created.some((c) => c.no === no)) continue
  const head = { 编号: no, 采购单号: d['采购单号'], 产品名称: d['产品名称'] }
  if (String(head['采购单号'] || '') === po) { tcNo = no; out.tc = head; break }
}
console.log('TC ' + tcNo + ' ' + JSON.stringify(out.tc))
if (tcNo) {
  created.push({ panel: 'QC_TC_IN', no: tcNo })
  const audTc = await call('QC_TC_IN', '审核', { 编号: tcNo })
  console.log('AUDIT_TC ' + audTc.status + ' ' + JSON.stringify(audTc.body?.data || audTc.body).slice(0, 200))
  // 特采生成的入库单:找 源单编号 = po 且 特采=是 的行
  const pi2 = await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 30 })
  out.piTc = []
  for (const d of pi2.body?.data?.list || []) {
    const no = String(d['编号'] || '')
    if (!no || created.some((c) => c.no === no)) continue
    const its = await detailRows('PURCHASE_IN', no)
    const hit = its.filter((it) => String(it['源单编号'] || '') === po && String(it['特采'] || '') === '是')
    if (hit.length) {
      created.push({ panel: 'PURCHASE_IN', no })
      out.piTc.push(...hit.map((it) => ({ 单号: no, 存货编码: it['存货编码'], 源单编号: it['源单编号'], 采购订单行号: it['采购订单行号'], 实收数量: it['实收数量'], 特采: it['特采'] })))
      break
    }
  }
  console.log('PI_TC ' + JSON.stringify(out.piTc))
}

// ⑧ 退货回冲口径:退回行采购单号匹配后,该订单行的可送上限应回补(读 push/lines 对比)
const l2b = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [po] })
const rowAfter = (l2b.body?.data?.docs?.[0]?.lines || [])[0] || {}
out.capAfter = { 数量: rowAfter['数量'], 已送: rowAfter['已送数量'], 已退回: rowAfter['已退回数量'], 剩余: rowAfter['剩余数量'], 可送上限: rowAfter['可送上限'] }
console.log('CAP_AFTER ' + JSON.stringify(out.capAfter))

// ⑨ 清理(倒序;已审核先弃审)
const cleanup = []
for (const c of created.slice().reverse()) {
  const un = await call(c.panel, '弃审', { 编号: c.no })
  const del = await call(c.panel, '删除', { 编号: c.no })
  cleanup.push({ panel: c.panel, no: c.no, 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
out.cleanup = cleanup
await fs.writeFile('C:/Users/Lenovo/ego/chain-pono-20261113/round-01.json', JSON.stringify(out, null, 2), 'utf8')
