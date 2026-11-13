// round-04(合单生单·收尾验证):合单 → 暂收 → ①免检直达入库 / ②检验 → 入库 两条出口都要在
// **入库行「源单编号」**上带出行级订单号(合单前的订单号),而不是表头那个"订单1、订单2"。
const fs = await import('node:fs/promises')
const task = await taskSpace('merge-generate-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
// 切到测试账套(round-03 已把浏览器切回正式库)
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
  if (!picked) return cur + '(目标未找到)'
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

// 合单:两单(免检物料 YJ-HSM-004 + 免检物料 YJ-ZL-025) → 一张暂收
const o1 = await mkOrder('福建鑫恒碳业有限公司', 'YJ-XH', { code: 'YJ-HSM-004', name: '海绵' }, 40)
const o2 = await mkOrder('福建鑫恒碳业有限公司', 'YJ-XH', { code: 'YJ-ZL-025', name: '纸箱' }, 60)
const l1 = await linesOf(o1)
const l2 = await linesOf(o2)
const merge = await post('/api/px/push/merge', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', batchNo: l1.batch,
  docs: [
    { sourceNo: o1, batchNo: l1.batch, lines: l1.picks },
    { sourceNo: o2, batchNo: l2.batch, lines: l2.picks },
  ],
})
const recvNo = String(merge.body?.data?.['编号'] || '')
if (recvNo) created.push({ panel: 'QC_RECV', no: recvNo })
console.log('MERGE ' + merge.status + ' ' + JSON.stringify(merge.body?.data || merge.body).slice(0, 260))
console.log('RECV ' + JSON.stringify((await detailRows('QC_RECV', recvNo)).map((it) => ({
  物料编码: it['物料编码'], 采购单号: it['采购单号'], 采购订单行号: it['采购订单行号'],
}))))

// 暂收审核 → 生成检验或入库单(免检物料会走"暂收 → 采购入库单")
await call('QC_RECV', '审核', { 编号: recvNo })
const l3 = await post('/api/px/push/lines', { panelCode: 'QC_RECV', action: '生成检验或入库单', sourceNos: [recvNo] })
const picks = (l3.body?.data?.docs?.[0]?.lines || []).filter((r) => Number(r['剩余数量'] || 0) > 0)
  .map((r) => ({ lineKey: r.lineKey, qty: Number(r['剩余数量']) }))
const g = await post('/api/px/push/generate', { panelCode: 'QC_RECV', action: '生成检验或入库单', docs: [{ sourceNo: recvNo, lines: picks }] })
const made = g.body?.data?.['生成'] || []
const chain = made.flatMap((m) => (m['生成清单'] || []).map((s) => ({ 面板: s['面板'], 编号: s['编号'] })))
if (!chain.length && made[0]?.['编号']) chain = [{ 面板: made[0]['面板'], 编号: made[0]['编号'] }]
for (const c of chain) created.push({ panel: c['面板'], no: c['编号'] })
console.log('CHAIN ' + JSON.stringify(chain))
const chainRows = []
for (const c of chain) {
  const panel = String(c['面板'])
  const its = await detailRows(panel, String(c['编号']))
  for (const it of its) {
    chainRows.push({
      面板: panel, 编号: c['编号'], 物料编码: it['物料编码'] || it['存货编码'],
      采购单号: it['采购单号'], 源单编号: it['源单编号'], 采购订单行号: it['采购订单行号'], 仓库: it['仓库'] || it['仓库代码'],
    })
  }
}
console.log('CHAIN_ROWS ' + JSON.stringify(chainRows))

// 清理
const cleanup = []
for (const c of [...chain.map((x) => [String(x['面板']), String(x['编号'])]), ['QC_RECV', recvNo], ['PU_ORDER', o2], ['PU_ORDER', o1]]) {
  if (!c[1]) continue
  const un = await call(c[0], '弃审', { 编号: c[1] })
  const del = await call(c[0], '删除', { 编号: c[1] })
  cleanup.push({ panel: c[0], no: c[1], 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status })
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
await fs.writeFile('C:/Users/Lenovo/ego/merge-generate-20261113/round-04.json',
  JSON.stringify({ o1, o2, recvNo, recvRows: await detailRows('QC_RECV', recvNo), chain, chainRows, cleanup }, null, 2), 'utf8')
