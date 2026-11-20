const task = await taskSpace('qc-line-patrol-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1600, height: 1000 } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const clickText = async (text, sel = 'button, .as-side-btn, .lp-addblock, span') => {
  const ok = await page.evaluate(({ text, sel }) => {
    const els = [...document.querySelectorAll(sel)]
    const el = els.find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === text)
    if (!el) return false
    el.click()
    return true
  }, { text, sel })
  return ok
}
console.log('click 新增 =', await clickText('新增', '.as-side-btn'))
await page.waitForTimeout(2500)
const afterNew = await page.evaluate(() => ({
  rows: document.querySelectorAll('.lp-sheet .lp-row').length,
  empty: (document.querySelector('.lp-sheet .lp-empty')?.innerText || '').replace(/\s+/g, ' ').trim(),
}))
console.log('after 新增: ' + JSON.stringify(afterNew))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/03-empty-new.png' })

// 点「＋ 新增巡线记录」
const addOk = await page.evaluate(() => {
  const el = document.querySelector('.lp-sheet .lp-addblock')
  if (!el) return false
  el.click()
  return true
})
console.log('click addblock =', addOk)
await page.waitForTimeout(1200)
const afterAdd = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.lp-sheet .lp-row')]
  const opts = [...document.querySelectorAll('.lp-sheet .lp-grid tbody tr')].map((tr) => tr.rowIndex)
  const val = (key) => {
    const td = document.querySelector('.lp-sheet td[data-lp="' + key + '"]')
    const inp = td ? td.querySelector('input') : null
    return inp ? inp.value : (td ? (td.innerText || '').trim() : null)
  }
  return {
    trCount: opts.length,
    patrolTime: val('巡线时间'),
    inputs: [...document.querySelectorAll('.lp-sheet .lp-grid tbody input')].map((i) => i.value),
  }
})
console.log('after add: ' + JSON.stringify(afterAdd, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/03-one-block.png' })
await task.finish({ keep: [] })
