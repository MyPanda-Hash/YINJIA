// round-03: 逐面板探查「界面入口」—— 5 张检验面板各自的审批/审核/弃审按钮是否真的可见可用
// 只读(不点审批动作);截图落 OUT。
const OUT = 'C:/Users/vigna/ego/wo-insp-audit-20261108'
const task = await taskSpace('wo-insp-audit-20261108')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

const PANELS = [
  ['QC_FIRST_INSP', '首件检验单'],
  ['QC_PROC_INSP', '制程检验单'],
  ['QC_ASM_INSP', '组装成品检验单'],
  ['QC_OQC_REPORT', '出厂检验报告'],
  ['QC_INSP', '来料检验单'],
]
const out = {}
for (const [code, label] of PANELS) {
  await page.goto('http://localhost:5173/#/panelx/list/' + code, { timeout: 30000 })
  await page.waitForTimeout(4000)
  // 关闭可能残留的弹窗
  await page.evaluate(() => { [...document.querySelectorAll('.el-dialog__headerbtn, .el-overlay .el-dialog__headerbtn')].forEach((b) => b.click()) })
  await page.waitForTimeout(600)
  await restoreWindow()
  const d = await page.evaluate(() => {
    const vis = (el) => el && el.offsetParent !== null
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const top = [...document.querySelectorAll('.tools .tb-main, .tools .toolbar-query-btn')].filter(vis).map(txt)
    const side = [...document.querySelectorAll('.approval-side .as-side-btn, .as-side-btns .as-side-btn')].filter(vis).map(txt)
    const sideSections = [...document.querySelectorAll('.approval-side .as-side-section')].filter(vis).map(txt)
    const docChip = [...document.querySelectorAll('.doc-chip')].map(txt)
    const docStatus = [...document.querySelectorAll('.doc-status')].map(txt)
    const rows = [...document.querySelectorAll('.el-table__body tr')].slice(0, 5).map((r) => txt(r).slice(0, 120))
    return { hash: location.hash, top, side, sideSections, docChip, docStatus, rows }
  })
  const has = (arr, k) => arr.some((t) => t === k || t.includes(k))
  out[code] = {
    label,
    提交审批: has(d.side, '提交审批') || has(d.top, '提交审批'),
    审批通过: has(d.side, '审批通过') || has(d.top, '审批通过'),
    弃审: has(d.side, '弃审') || has(d.top, '弃审'),
    审核直审: has(d.side, '审核') || has(d.top, '审核'),
    审批情况: has(d.side, '审批情况') || has(d.top, '审批情况'),
    top: d.top, side: d.side, docChip: d.docChip, docStatus: d.docStatus,
    rows: d.rows.slice(0, 3),
  }
  console.log('=== ' + label + ' (' + code + ') ===')
  console.log(JSON.stringify(out[code], null, 2))
  await page.screenshot({ path: OUT + '/round-03-' + code + '.png' })
}
console.log('\nSUMMARY=' + JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, {
  提交审批: v.提交审批, 审批通过: v.审批通过, 弃审: v.弃审, 审核直审: v.审核直审, doc: v.docChip, status: v.docStatus,
}])), null, 1))
console.log('ROUND03_DONE')
