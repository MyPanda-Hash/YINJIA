// round-04: 诊断 QC_ASM_INSP / QC_INSP 的顶部工具栏「审批 ▼」下拉内容(界面入口是否存在)
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

const out = {}
for (const code of ['QC_ASM_INSP', 'QC_INSP']) {
  await page.goto('http://localhost:5173/#/panelx/list/' + code, { timeout: 30000 })
  await page.waitForTimeout(4500)
  await page.evaluate(() => { [...document.querySelectorAll('.el-overlay .el-dialog__headerbtn')].forEach((b) => b.click()) })
  await page.waitForTimeout(500)
  await restoreWindow()
  const base = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const groups = [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: txt(g.querySelector('.tb-main')),
      hasCaret: !!g.querySelector('.tb-caret'),
    }))
    return {
      groups,
      docChip: [...document.querySelectorAll('.doc-chip')].map(txt),
      docStatus: [...document.querySelectorAll('.doc-status')].map(txt),
      allText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
    }
  })
  // 点开「审批」组的下拉,列出可选动作
  const opened = await (async () => {
    const ok = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('.tools .tb-group')]
      const g = groups.find((x) => ((x.querySelector('.tb-main') || {}).textContent || '').trim() === '审批')
      if (!g) return false
      const caret = g.querySelector('.tb-caret')
      if (caret) { caret.click(); return true }
      return false
    })
    if (!ok) return { ok: false }
    await page.waitForTimeout(600)
    const items = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')]
      .map((el) => ({ text: (el.textContent || '').trim(), disabled: el.classList.contains('disabled') })))
    return { ok: true, items }
  })()
  out[code] = { base: { groups: base.groups, docChip: base.docChip, docStatus: base.docStatus }, approvalDropdown: opened }
  console.log('=== ' + code + ' ===')
  console.log(JSON.stringify(out[code], null, 2))
  if (opened.ok) await page.screenshot({ path: OUT + '/round-04-' + code + '-approval-dropdown.png' })
}
console.log('ROUND04_DONE')
