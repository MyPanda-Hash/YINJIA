/* round-04:用新页签打开检验委托单纸面,截图 + DOM 结构取证(给后续填单脚本用) */
const task = await taskSpace('sample-insp-20261115')
const pages = await task.pages()
console.log('pages:', pages.map((p) => p.label).join(','))
const page = await task.newPage()
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115'
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.ic-sheet')
  const tables = [...document.querySelectorAll('.ic-sheet table')].map((t) => ({
    cls: t.className,
    rows: t.querySelectorAll('tr').length,
    firstRow: (t.querySelector('tr')?.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
  }))
  const pickBtn = [...document.querySelectorAll('.ic-sheet button, .ic-sheet span')].filter((e) => (e.textContent || '').includes('选择检验项目')).map((e) => e.tagName + '.' + e.className)
  const inputs = [...document.querySelectorAll('.ic-sheet input')].slice(0, 8).map((i) => ({ ph: i.placeholder, val: i.value, cls: i.className }))
  return { hash: location.hash, hasSheet: !!sheet, sheetW: sheet?.getBoundingClientRect().width, tables, pickBtn, inputs, side: [...document.querySelectorAll('.approval-side .as-side-btn')].map((e) => e.textContent.trim()) }
})
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: OUT + '/round-04-01-commission-paper.png' })
console.log('shot =>', OUT + '/round-04-01-commission-paper.png')
await task.finish({ keep: true })
