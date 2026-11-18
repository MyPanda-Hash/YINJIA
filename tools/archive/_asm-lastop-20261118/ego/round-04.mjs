// round-04:ASM 弹窗紧凑摘要(话术/表头/命中行),并确认「组装装箱」末道工单能出现在列表里
const OUT = 'C:/Users/vigna/ego/ship-insp-lastop-20261118'
const task = await taskSpace('ship-insp-lastop-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 60000 })
await page.waitForTimeout(6000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  }
  await page.waitForTimeout(400)
} catch (e) {
  console.log('restore skip: ' + e.message)
}

await page.evaluate(() => {
  const el = [...document.querySelectorAll('div, span, a, li, button')]
    .filter((n) => (n.textContent || '').trim() === '选生产工单').pop()
  if (el) el.click()
})
await page.waitForTimeout(4500)

const summary = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('选生产工单'))
  if (!dlg) return { dialog: false }
  const heads = [...dlg.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const rows = [...dlg.querySelectorAll('.el-table__body tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  const stageIdx = heads.indexOf('进入环节')
  const woIdx = heads.indexOf('工单号')
  return {
    dialog: true,
    tip: (dlg.querySelector('.wopick-tip') || {}).textContent?.trim(),
    gate: (dlg.querySelector('.wopick-gate') || {}).textContent?.trim(),
    heads,
    total: (dlg.querySelector('.el-pagination__total') || {}).textContent?.trim(),
    entered: rows.filter((r) => r[stageIdx] && r[stageIdx] !== '-').map((r) => ({
      wo: r[woIdx], line: r[heads.indexOf('工单行号')], stage: r[stageIdx],
      creatable: r[heads.indexOf('可开单')], status: r[heads.indexOf('生产状态')],
      sheet: r[heads.indexOf('已建单号')],
    })),
    rowCount: rows.length,
  }
})
console.log(JSON.stringify(summary, null, 2))
await page.screenshot({ path: OUT + '/04-asm-picker.png' })
await task.finish({ keep: [] })
