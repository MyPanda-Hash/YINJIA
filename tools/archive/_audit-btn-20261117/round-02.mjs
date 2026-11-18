// 复验(改完后端后):79 张 doc 面板逐张取 buttonGroups,确认审批组里都有「审核」;
// 并在采购入库单(PURCHASE_IN)页面上把工具栏按钮文字抓出来 + 截图取证。
const PANELS = [
  'ASM_BOM','CGD','DAY_REPORT','DISPATCH','EQUIP_CHECK','FEED_CONFIRM','FINISH_IN','GRAN_RECORD','KHDD',
  'MAINT_PLAN','MANU_ORDER','MATERIAL_OUT','MATERIAL_RET','MIX_RECORD','OTHER_IN','OTHER_OUT','OUTSOURCE_ORDER',
  'PACK_CONFIRM','PU_ORDER','PURCHASE_IN','QC_ASM_INSP','QC_BHC','QC_BHG','QC_BHZ','QC_CATALOG','QC_CUT_INSP',
  'QC_FIN_SPEC','QC_FIRST_INSP','QC_INSP','QC_INSP_REC','QC_JJF','QC_LYB','QC_MOLD_INSP','QC_OQC_REPORT',
  'QC_PROC_INSP','QC_RECV','QC_RETURN','QC_SCP','QC_SCY','QC_TC_IN','RD_ALKALINE','RD_ANTIBACT','RD_APPROVAL',
  'RD_ASM_BOM','RD_ASM_PROC','RD_CHANGE','RD_DOM_TEST','RD_DROP_PREC','RD_EQUIP_USE','RD_FILTER_EFF','RD_INSP_PLAN',
  'RD_INSTR_USE','RD_MINERAL','RD_MOLD_FORMULA','RD_MOLD_PROC','RD_PLAN','RD_PROD_DOCLIST','RD_PROD_INFO',
  'RD_PROGRESS','RD_RO_PROTECT','RD_SAMPLE_EXT','RD_SAMPLE_INT','RD_SCALE','RD_SOAK','RD_SPEC_DOC',
  'RD_SPIKE_WATER','RD_X_SINTER','ROUTE','SALE_IN','SALE_OUT','SAMPLE_REQ','SO_ORDER','STOCKTAKE',
  'SUPPLIER_PU_ORDER','TRANSFER','WH_RECORD','WLBOM','WO_ORDER','WO_REPORT',
]

const task = await taskSpace('audit-direct-audit-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 30000 })
await page.waitForTimeout(3000)

let token = await page.evaluate(() => localStorage.getItem('mes_token'))
if (!token) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  token = await page.evaluate(() => localStorage.getItem('mes_token'))
}

const has = []
const miss = []
for (const code of PANELS) {
  const res = await page.fetch('/api/px/getPanelConfig?panelCode=' + encodeURIComponent(code), {
    headers: { Authorization: 'Bearer ' + token },
    timeout: 20000,
  })
  let json = null
  try { json = JSON.parse(res.body) } catch (e) { json = null }
  const groups = json?.data?.metadata?.buttonGroups || []
  const allActions = groups.flatMap((g) => g.actions || [])
  if (allActions.includes('审核')) has.push(code)
  else miss.push(code + ' :: ' + JSON.stringify(groups.map((g) => g.name + '=' + (g.actions || []).join(','))))
}
console.log('=== 有「审核」(' + has.length + '/' + PANELS.length + ') ===')
console.log(has.join(' '))
console.log('=== 仍缺「审核」(' + miss.length + ') ===')
console.log(miss.join('\n') || '(none)')

// 采购入库单页面的工具栏实际渲染
await page.reload()
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  docNo: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  toolbar: [...document.querySelectorAll('.tb-group .tb-main')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
})), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-direct-audit-20261117/purchase-in-toolbar.png' })
