// 审计:每个 doc 面板下发的 buttonGroups 里有没有「审核」(直接审核 / 一步到位)动作。
// 判据与前端一致:engine.normalizeApprovalGroups 只会把 extras(=不在工作流固定动作里的动作)留下来,
// 所以 raw 配置里任何一个组含「审核」⇔ 工具栏能渲染出那颗按钮(PanelxList.hoistDirectAudit 会把它提出来单独成组)。
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

// 会话过期就自动登录(admin/123456,登录工厂 YJ = 正式库)
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
console.log('token? ' + Boolean(token))

const ACTS = ['提交审批', '审批通过', '审批驳回', '审批情况', '弃审']
const has = []
const miss = []
const noApproval = []
for (const code of PANELS) {
  const res = await page.fetch('/api/px/getPanelConfig?panelCode=' + encodeURIComponent(code), {
    headers: { Authorization: 'Bearer ' + token },
    timeout: 20000,
  })
  let json = null
  try { json = JSON.parse(res.body) } catch (e) { json = null }
  const groups = json?.data?.metadata?.buttonGroups || []
  const allActions = groups.flatMap((g) => g.actions || [])
  const name = json?.data?.metadata?.panelName || json?.data?.panelName || code
  if (allActions.includes('审核')) has.push(code)
  else {
    const workflow = allActions.some((a) => ['提交审批', '审批通过', '弃审'].includes(a))
    if (!workflow) noApproval.push(code + ' ' + name + ' :: ' + JSON.stringify(groups.map((g) => g.name + '=' + (g.actions || []).join(','))))
    else miss.push(code + ' ' + name + ' :: ' + JSON.stringify(groups.map((g) => g.name + '=' + (g.actions || []).join(','))))
  }
}
console.log('=== 有「审核」的面板 (' + has.length + ') ===')
console.log(has.join(' '))
console.log('=== 缺「审核」但有审批组的面板 (' + miss.length + ') ===')
console.log(miss.join('\n'))
console.log('=== 完全没有审批流的面板 (' + noApproval.length + ') ===')
console.log(noApproval.join('\n'))
