// round-33 — A1 补充:1#/2# 表观两列「勾选式可点」点击取证(5173 测试库新草稿)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 40000 })
await page.waitForTimeout(8000)
const st0 = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim(), hash: location.hash }))
console.log('STATE0=' + JSON.stringify(st0))
const newClicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '新增')
  if (b) b.click()
  return !!b
})
console.log('NEW=' + newClicked)
await page.waitForTimeout(7000)
const before = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.sample-row .fi-box')]
  const cell = document.querySelector('.sample-row td.is-check')
  return {
    sheet: !!document.querySelector('.fi-grid'),
    boxes: boxes.length,
    firstText: boxes[0] ? boxes[0].textContent : null,
    checkCells: document.querySelectorAll('.sample-row td.is-check').length,
    editable: !!document.querySelector('.fi-sheet.is-editing'),
  }
})
console.log('BOXES0=' + JSON.stringify(before))
const clicked = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.sample-row .fi-box')]
  if (!boxes.length) return false
  boxes[0].click()
  return true
})
await page.waitForTimeout(1000)
const after = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.sample-row .fi-box')]
  return { firstText: boxes[0] ? boxes[0].textContent : null, onCount: document.querySelectorAll('.sample-row .fi-box.on').length }
})
console.log('AFTER_CLICK=' + JSON.stringify({ clicked, ...after }))
await normalWin()
await page.screenshot({ path: OUT + '/round-33-checkbox.png' })
await fs.writeFile(OUT + '/a1-checkbox.json', JSON.stringify({ st0, before, clicked, after }, null, 1), 'utf8')
console.log('DONE round-33')
