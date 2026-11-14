// round-21.mjs — 终版截图(5173 正式账套):466 行 / 不合格分支 / 显示已隐藏
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/?v=final4#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const pickState = async (label) => {
  await page.evaluate(() => { const i = document.querySelector('.qcf-sel input'); if (i) i.click() })
  await page.waitForTimeout(600)
  const ok = await page.evaluate((label) => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => (o.textContent || '').trim() === label)
    if (opt) { opt.click(); return true }
    return false
  }, label)
  await page.waitForTimeout(2800)
  return ok
}

console.log('切 全部 =', await pickState('全部'))
const info = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  return {
    factory: text(document.querySelector('.brand, .tb-brand, .top-bar')).slice(0, 30),
    rows: rows.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    ngRows: rows.filter((r) => r.querySelector('.qcf-lane-ng')).length,
    switchLabels: [...document.querySelectorAll('.qcf-only')].map(text),
  }
})
console.log('全部(未勾) =', JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-21-final-prod.png' })

await page.evaluate(() => {
  const c = [...document.querySelectorAll('.qcf-only')].find((x) => (x.textContent || '').includes('显示已隐藏'))
  const i = c && c.querySelector('input')
  if (i) i.click()
})
await page.waitForTimeout(3000)
const on = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  return { rows: rows.length, stats: [...document.querySelectorAll('.qcf-stat')].map(text), hiddenBadges: rows.filter((r) => r.querySelector('.qcf-hidden-tag')).length }
})
console.log('全部(勾上) =', JSON.stringify(on))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-21-final-prod-hidden.png' })
console.log('done')
