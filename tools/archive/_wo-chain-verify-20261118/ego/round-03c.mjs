// round-03c: 看 ② 全部已排产 的行 → 点中 GD-2026-10-0228 那行 → 预排线 → 读日期链
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const rows2 = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.sb-block')]
  const b = blocks[1]
  if (!b) return []
  return [...b.querySelectorAll('.el-table__body tr')].map((tr, i) => ({ i, text: (tr.textContent || '').replace(/\s+/g, ' ').trim() }))
})
console.log('block2 rows: ' + JSON.stringify(rows2.slice(0, 10), null, 2))
const hit = rows2.find((r) => r.text.includes('GD-2026-10-0228'))
console.log('hit=' + JSON.stringify(hit))
if (hit) {
  await page.evaluate((idx) => {
    const blocks = [...document.querySelectorAll('.sb-block')]
    const tr = blocks[1].querySelectorAll('.el-table__body tr')[idx]
    if (tr) tr.click()
  }, hit.i)
  await page.waitForTimeout(900)
  await page.click('text="预排线"')
  await page.waitForTimeout(3500)
}
const dialog = await page.evaluate(() => {
  const d = document.querySelector('.el-dialog')
  if (!d) return { open: false }
  const rows = [...d.querySelectorAll('.el-table__body tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    const inputs = [...tr.querySelectorAll('input')].map((i) => i.value)
    return { cells, inputs }
  })
  return { open: true, title: (d.querySelector('.el-dialog__title') || {}).textContent, rows }
})
console.log(JSON.stringify(dialog, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-03-chain.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
