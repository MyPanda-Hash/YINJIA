// 2026-11-13 round-05:双击/单击改数量回归 —— 预填应是「计划值」(日计划/原计划),不是报工数
const task = await taskSpace('wo-dayplan-orig-20261113')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8091'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(BASE + '/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(5000)
await restoreWindow()

async function pickLine(name) {
  const ok = await page.evaluate((n) => {
    const el = [...document.querySelectorAll('.wb-line')].find((x) => (x.querySelector('.wb-line-name')?.textContent || '').trim().startsWith(n))
    if (!el) return 'not-found'
    el.click(); return 'ok'
  }, name)
  await page.waitForTimeout(3500)
  return ok
}

async function clickCellThenReadInput(line, index) {
  await pickLine(line)
  const before = await page.evaluate((i) => {
    const cells = [...document.querySelectorAll('.wb-main .el-table__body tr.el-table__row td .dp-plan')]
    const cell = cells[i]
    if (!cell) return { err: 'no-cell', count: cells.length }
    const text = (cell.textContent || '').trim()
    const title = cell.getAttribute('title') || ''
    cell.click()   // 真实单击 = startQtyEdit
    return { text, title }
  }, index)
  await page.waitForTimeout(700)
  const state = await page.evaluate(() => {
    const wrap = document.querySelector('.dp-input')
    const inp = wrap ? wrap.querySelector('input') : null
    return { hasInput: !!wrap, value: inp ? inp.value : null }
  })
  // Esc 取消编辑
  await page.evaluate(() => {
    const inp = document.querySelector('.dp-input input')
    if (inp) {
      inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }))
      inp.blur()
    }
  })
  await page.waitForTimeout(600)
  const after = await page.evaluate(() => ({
    hasInput: !!document.querySelector('.dp-input'),
    text: (document.querySelector('.wb-main .el-table__body tr.el-table__row td .dp-plan') || {}).textContent?.trim() || '',
  }))
  return { line, index, before, state, after }
}

// 3号车间:格 715/15(今天的日计划=700)⇒ 预填应为 700(计划),不是 15(报工)
console.log('A=' + JSON.stringify(await clickCellThenReadInput('3号车间', 0)))
// 1号车间:历史红格 834/500(历史无日计划 ⇒ 预填原计划 834);不保存
console.log('B=' + JSON.stringify(await clickCellThenReadInput('1号车间', 0)))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-dayplan-orig-20261113/round-12-edit-prefill2.png' })
console.log('DONE')
