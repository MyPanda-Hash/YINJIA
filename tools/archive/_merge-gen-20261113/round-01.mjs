// round-01(合单生单):测试账套造 2 张同供应商 + 1 张异供应商采购订单 → 审核 →
// ① 合单两单同供应商 → 应只出**一张**送料暂收单,且逐行带「采购单号(合单前订单号)」+「采购订单行号」;
// ② 合单异供应商 → 应被拒;
// ③ 该暂收单审核后 → 检验/入库行继续带行级采购单号;
// ④ 清理造出来的单据。
const fs = await import('node:fs/promises')
const task = await taskSpace('merge-generate-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(5000)
// 会话兜底:页面停在登录页就登一次(admin/123456)
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
// 账套必须是测试库
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
  if (!picked) return cur + '(目标未找到:' + name + ')'
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
await page.waitForTimeout(500)
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
const today = new Date().toISOString().slice(0, 10)
const created = []
const mkOrder = async (supplier, supplierCode, item, qty) => {
  const r = await call('PU_ORDER', '保存', {
    单据日期: today, 供应商: supplier, 供应商编码: supplierCode, 币种: '人民币', 汇率: 1,
    detail: { items: [{ 物料编码: item.code, 物料名称: item.name, 计量单位: item.unit || 'kg', 数量: qty, 单价: 10 }] },
  })
  const no = String(r.body?.data?.['编号'] || '')
  if (no) { created.push({ panel: 'PU_ORDER', no }); await call('PU_ORDER', '审核', { 编号: no }) }
  return no
}

// ① 造单(同供应商 A ×2 + 异供应商 B ×1)
const a1 = await mkOrder('福建鑫恒碳业有限公司', 'YJ-XH', { code: 'YJ-XH-002', name: '鑫恒酸洗（80-250）', unit: 'kg' }, 30)
const a2 = await mkOrder('福建鑫恒碳业有限公司', 'YJ-XH', { code: 'CL004', name: '切削液', unit: 'kg' }, 20)
const b1 = await mkOrder('东莞市真炙包装材料有限公司', 'YJ-ZZ', { code: 'YJ-ZL-025', name: '纸箱', unit: '个' }, 10)
console.log('ORDERS ' + JSON.stringify({ a1, a2, b1 }))

// 取两单的可送行
const linesOf = async (no) => {
  const r = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [no] })
  return { rows: r.body?.data?.docs?.[0]?.lines || [], batch: r.body?.data?.docs?.[0]?.nextBatchNo }
}
const la = await linesOf(a1)
const lb = await linesOf(a2)
const lc = await linesOf(b1)
const pick = (l) => l.rows.filter((r) => Number(r['剩余数量'] || 0) > 0).map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
console.log('LINES ' + JSON.stringify({ a1: pick(la).length, a2: pick(lb).length, b1: pick(lc).length }))

// ② 合单两单同供应商(带仓库/仓位)
const merge = await post('/api/px/push/merge', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', batchNo: la.batch,
  docs: [
    { sourceNo: a1, batchNo: la.batch, lines: pick(la).map((l) => ({ ...l, 仓库: 'A仓', 仓库编码: 'CK-A', 仓位: 'A1-09-1' })) },
    { sourceNo: a2, batchNo: lb.batch, lines: pick(lb).map((l) => ({ ...l, 仓库: 'A仓', 仓库编码: 'CK-A', 仓位: 'A1-09-2' })) },
  ],
})
const mergedNo = String(merge.body?.data?.['编号'] || '')
console.log('MERGE ' + merge.status + ' ' + JSON.stringify(merge.body?.data || merge.body).slice(0, 400))
if (mergedNo) created.push({ panel: 'QC_RECV', no: mergedNo })
const recvRows = mergedNo ? await detailRows('QC_RECV', mergedNo) : []
console.log('RECV_ROWS ' + JSON.stringify(recvRows.map((it) => ({
  物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'], 仓库: it['仓库'], 仓位: it['仓位'], 数量: it['数量'],
}))))

// ③ 异供应商合单应被拒
const bad = await post('/api/px/push/merge', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单',
  docs: [{ sourceNo: a1, lines: pick(la) }, { sourceNo: b1, lines: pick(lc) }],
})
console.log('BAD_MERGE ' + bad.status + ' code=' + bad.body?.code + ' msg=' + String(bad.body?.message || '').slice(0, 160))

// ④ 暂收审核 → 生成检验/入库,看行级采购单号是否继续往下带
let chain = []
let chainRows = []
if (mergedNo) {
  await call('QC_RECV', '审核', { 编号: mergedNo })
  const l2 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [mergedNo] })
  const rows2 = (l2.body?.data?.docs?.[0]?.lines || []).filter((r) => Number(r['剩余数量'] || 0) > 0).map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
  const g2 = await post('/api/px/push/generate', { panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: mergedNo, lines: rows2 }] })
  console.log('CHAIN ' + g2.status + ' ' + JSON.stringify(g2.body?.data || g2.body).slice(0, 400))
  const made = g2.body?.data?.['生成'] || []
  chain = made.flatMap((m) => (m['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] })))
  if (!chain.length && made[0]?.['编号']) chain = [{ 面板: made[0]['面板'] || 'QC_INSP', 编号: made[0]['编号'] }]
  for (const c of chain) created.push({ panel: c['面板'], no: c['编号'] })
  for (const c of chain) {
    const its = await detailRows(String(c['面板']), String(c['编号']))
    for (const it of its) {
      chainRows.push({ 面板: c['面板'], 编号: c['编号'], 物料编码: it['物料编码'] || it['存货编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'] })
    }
  }
}
console.log('CHAIN_DOCS ' + JSON.stringify(chain))
console.log('CHAIN_ROWS ' + JSON.stringify(chainRows))

// ⑤ 清理(倒序;已审核先弃审)
const cleanup = []
for (const c of [...chain.map((x) => [String(x['面板']), String(x['编号'])]), ['QC_RECV', mergedNo], ['PU_ORDER', b1], ['PU_ORDER', a2], ['PU_ORDER', a1]]) {
  if (!c[1]) continue
  const un = await call(c[0], '弃审', { 编号: c[1] })
  const del = await call(c[0], '删除', { 编号: c[1] })
  cleanup.push({ panel: c[0], no: c[1], 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
await fs.writeFile('C:/Users/Lenovo/ego/merge-generate-20261113/round-01.json',
  JSON.stringify({ a1, a2, b1, merge: merge.body, mergedNo, recvRows, bad: bad.body, chain, chainRows, cleanup }, null, 2), 'utf8')
