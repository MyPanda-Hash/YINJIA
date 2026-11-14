// round-22.mjs — 专拍「不合格分支」:按 TH- 关键字筛出有退回单的批次
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/?v=ng7#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 状态切「全部」+ 关键字 TH-(有退回单的批次)
await page.evaluate(() => { const i = document.querySelector('.qcf-sel input'); if (i) i.click() })
await page.waitForTimeout(600)
await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => (o.textContent || '').trim() === '全部')
  if (opt) opt.click()
})
await page.waitForTimeout(2000)
await page.evaluate(() => {
  const inp = document.querySelector('.qcf-kw input')
  if (!inp) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'TH-2026')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  const btn = document.querySelector('.qcf-refresh')
  if (btn) btn.click()
})
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const ng = rows.filter((r) => r.querySelector('.qcf-lane-ng'))
  return {
    rows: rows.length,
    ngRows: ng.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    samples: ng.slice(0, 4).map((r) => ({
      batch: text(r.querySelector('.qcf-batch')),
      main: [...r.querySelectorAll('.qcf-lane:first-child .qcf-node')].map(text),
      ng: [...r.querySelectorAll('.qcf-lane-ng .qcf-node')].map(text),
      stage: text(r.querySelector('.qcf-stage-tag')),
    })),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-22-ng-branch.png' })
console.log('done')
