// round-14: 用户点名要"点击测试"的四条(表头多单号的影响):
//  ① 转ERP 不受影响 —— 已在 round-04 用合并单 PI-2026-11-0013 点出 ERP单号 CGRK-20261113-00047
//  ② 退货回冲额度 —— 采购订单的「生单」对话框里看 已退回/可送上限
//  ③ 界面查询   —— 暂收单面板按「采购订单号」查合并单(应查不到)、按单据编号查(应查到)
//  ④ 报表/打印   —— 合并的暂收单点「打印」「导出报表」
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
const out = {}
const MERGED = 'SL-2026-11-0010'
const doc = ((await post('/api/px/queryFormDataList', { panelCode: 'QC_RECV', condition: {}, keyword: MERGED, pageNo: 1, pageSize: 5 })).body?.data?.list || [])
  .find((d) => String(d['编号']) === MERGED)
console.log('MERGED_DOC ' + JSON.stringify({ no: doc?.['编号'], 采购订单号: doc?.['采购订单号'], 状态: doc?.['单据状态'] }))
out.mergedDoc = { no: doc?.['编号'], 采购订单号: doc?.['采购订单号'], 状态: doc?.['单据状态'] }

/** ③ 界面查询:打开查询弹窗,填「采购订单号」→ 查询 */
async function queryRecv(fieldLabel, value) {
  await page.goto('http://localhost:5173/#/panelx/list/QC_RECV', { timeout: 40000 })
  await page.waitForTimeout(6000)
  // 打开「查询」
  await page.evaluate(() => D0 => 0)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.tools button, .tools .tb-main')].find((b) => (b.textContent || '').trim() === '查询')
    btn?.click()
  })
  await page.waitForTimeout(2000)
  const hasDialog = await page.evaluate(() => !!document.querySelector('.header-query-dialog, .el-dialog'))
  const filled = await page.evaluate(({ label, val }) => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('查询'))
    if (!dlg) return { ok: false }
    const items = [...dlg.querySelectorAll('.el-form-item, .qf-item, .query-field')]
    for (const it of items) {
      const lab = (it.querySelector('label')?.textContent || '').trim()
      if (!lab.includes(label)) continue
      const inp = it.querySelector('input')
      if (!inp) continue
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(inp, val)
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true, lab }
    }
    return { ok: false }
  }, { label: fieldLabel, val: value })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('查询'))
    const btn = dlg ? [...dlg.querySelectorAll('button')].find((b) => /查询|确定/.test(b.textContent || '')) : null
    btn?.click()
  })
  await page.waitForTimeout(5000)
  const res = await page.evaluate((no) => {
    const rows = [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim())
    return { railRows: rows.length, hit: rows.some((t) => t.includes(no)), first: rows.slice(0, 3) }
  }, MERGED)
  return { hasDialog, filled, res }
}
out.queryByPoNo = await queryRecv('采购订单号', 'PO-2026-11-0015')
console.log('③ 按采购订单号查(合并单里的其中一张) → ' + JSON.stringify(out.queryByPoNo.res))
out.queryByDocNo = await queryRecv('单据编号', MERGED)
console.log('③ 按单据编号查合并单 → ' + JSON.stringify(out.queryByDocNo.res))

/** ④ 打印 / 导出报表:选中合并单后点工具栏 */
await page.goto('http://localhost:5173/#/panelx/list/QC_RECV', { timeout: 40000 })
await page.waitForTimeout(6000)
await page.evaluate((no) => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  rows.find((r) => (r.textContent || '').includes(no))?.click()
}, MERGED)
await page.waitForTimeout(2500)
const before = await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  groups: [...document.querySelectorAll('.tools .tb-group')].map((g) => (g.querySelector('.tb-main')?.textContent || '').trim()),
}))
console.log('④ 工具栏 ' + JSON.stringify(before))
// 打印:打开「打印」组下拉,点「打印」
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '打印')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
const printItems = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')].map((el) => (el.textContent || '').trim()))
console.log('④ 打印下拉 ' + JSON.stringify(printItems))
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').trim() === '打印')
  it?.click()
})
await page.waitForTimeout(6000)
out.print = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()),
  dialogs: [...document.querySelectorAll('.el-dialog__title')].map((t) => (t.textContent || '').trim()),
  printWindows: window.__printed === undefined ? 'n/a' : window.__printed,
}))
console.log('④ 点打印 → ' + JSON.stringify(out.print))
// 关掉可能弹出的弹窗
await page.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('.el-dialog__headerbtn')?.click() })
await page.waitForTimeout(1000)
// 导出报表
const hasReportBtn = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-main')].some((b) => (b.textContent || '').trim() === '导出报表'))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.tools .tb-main')].find((x) => (x.textContent || '').trim() === '导出报表')
  b?.click()
})
await page.waitForTimeout(3000)
out.report = await page.evaluate(() => ({
  hasReportBtn: [...document.querySelectorAll('.tools .tb-main')].some((b) => (b.textContent || '').trim() === '导出报表'),
  dialogs: [...document.querySelectorAll('.el-dialog__title')].map((t) => (t.textContent || '').trim()),
  options: [...document.querySelectorAll('.el-dialog .el-radio, .el-dialog .el-select__placeholder')].map((x) => (x.textContent || '').trim()).slice(0, 6),
}))
out.report.hasReportBtn = out.report.hasReportBtn || hasReportBtn
console.log('④ 导出报表 → ' + JSON.stringify(out.report))

/** ② 退货回冲:找一张已审核的暂收退料单,取它表头/行上的采购订单号,到采购订单「生单」对话框里看已退回 */
const th = ((await post('/api/px/queryFormDataList', { panelCode: 'QC_RETURN', condition: {}, pageNo: 1, pageSize: 60 })).body?.data?.list || [])
  .find((d) => String(d['单据状态']) === '已审核' && String(d['采购订单号'] || '').trim() !== '')
out.returnDoc = th ? { no: th['编号'], 采购订单号: th['采购订单号'] } : null
console.log('② 退回单样本 ' + JSON.stringify(out.returnDoc))
if (out.returnDoc?.采购订单号) {
  const poNo = String(out.returnDoc['采购订单号']).split(/[、,，]/)[0].trim()
  const lines = await post('/api/px/push/lines', { panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: [poNo] })
  const row = (lines.body?.data?.docs?.[0]?.lines || [])[0] || {}
  out.returnOffset = { poNo, 数量: row['数量'], 已送: row['已送数量'], 已退回: row['已退回数量'], 剩余: row['剩余数量'], 可送上限: row['可送上限'] }
  console.log('② 该订单行的 已退回/可送上限 → ' + JSON.stringify(out.returnOffset))
}
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-14.json', JSON.stringify(out, null, 2), 'utf8')
