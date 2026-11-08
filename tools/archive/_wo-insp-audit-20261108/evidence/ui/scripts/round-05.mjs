// round-05: 诊断 QC_ASM_INSP 顶部工具栏「审批」组的真实结构与点击可达性
const OUT = 'C:/Users/vigna/ego/wo-insp-audit-20261108'
const task = await taskSpace('wo-insp-audit-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }
const d = await page.evaluate(() => {
  const tools = document.querySelector('.tools')
  const groups = [...document.querySelectorAll('.tools .tb-group')].map((g, i) => ({
    i,
    html: g.outerHTML.slice(0, 900),
    main: (g.querySelector('.tb-main') || {}).textContent,
  }))
  return { toolsHtmlLen: tools ? tools.innerHTML.length : -1, groups }
})
console.log(JSON.stringify(d, null, 2))
// 打开「审批」组下拉并截图
const opened = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')].find((x) => ((x.querySelector('.tb-main') || {}).textContent || '').trim() === '审批')
  if (!g) return false
  const caret = g.querySelector('.tb-caret')
  if (caret) caret.click()
  return true
})
await page.waitForTimeout(700)
const menu = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu')].map((m) => ({
  html: m.outerHTML.slice(0, 1200),
  items: [...m.querySelectorAll('.ctx-item')].map((el) => ({ text: (el.textContent || '').trim(), disabled: el.classList.contains('disabled') })),
})))
console.log('menu=' + JSON.stringify(menu, null, 2))
await page.screenshot({ path: OUT + '/round-05-asam-toolbar-approval.png' })
console.log('ROUND05_DONE')
