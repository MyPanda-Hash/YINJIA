// round-05:出货功能检验(QC_PROC_INSP)与首件检验(QC_FIRST_INSP)的选单弹窗话术/列应保持不变(只读)
const OUT = 'C:/Users/vigna/ego/ship-insp-lastop-20261118'
const task = await taskSpace('ship-insp-lastop-20261118')
const page = task.page('p1')

const out = []
for (const [code, tag] of [['QC_PROC_INSP', 'proc'], ['QC_FIRST_INSP', 'first']]) {
  await page.goto(`http://localhost:5173/#/panelx/list/${code}`, { timeout: 60000 })
  await page.waitForTimeout(6000)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(300)
  } catch (e) {
    console.log('restore skip: ' + e.message)
  }
  const clicked = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div, span, a, li, button')]
      .filter((n) => (n.textContent || '').trim() === '选生产工单').pop()
    if (!el) return false
    el.click()
    return true
  })
  await page.waitForTimeout(4500)
  const info = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('选生产工单'))
    if (!dlg) return { dialog: false }
    return {
      dialog: true,
      tip: (dlg.querySelector('.wopick-tip') || {}).textContent?.trim(),
      gate: (dlg.querySelector('.wopick-gate') || {}).textContent?.trim(),
      heads: [...dlg.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim()),
      total: (dlg.querySelector('.el-pagination__total') || {}).textContent?.trim(),
      firstRow: [...dlg.querySelectorAll('.el-table__body tr')].slice(0, 2).map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
    }
  })
  out.push({ code, clicked, info })
  await page.screenshot({ path: `${OUT}/05-${tag}-picker.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
  await page.goto('about:blank')
  await page.waitForTimeout(500)
}
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
