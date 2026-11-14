// round-14.mjs — 第二轮:不合格分支(退回/特采)+ 已转ERP 隐藏开关,界面实测
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/?v=ng1#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const before = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const lanes = [...document.querySelectorAll('.qcf-lane')].length
  const ngRows = rows.filter((r) => r.querySelector('.qcf-lane-ng'))
  return {
    hash: location.hash,
    rows: rows.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    lanes,
    ngRowCount: ngRows.length,
    ngSample: ngRows.slice(0, 3).map((r) => ({
      batch: text(r.querySelector('.qcf-batch')),
      ngNodes: [...r.querySelectorAll('.qcf-lane-ng .qcf-node')].map(text),
      stage: text(r.querySelector('.qcf-stage-tag')),
    })),
    hiddenSwitchLabel: [...document.querySelectorAll('.qcf-only')].map((c) => text(c)),
  }
})
console.log('默认(不含已隐藏) =', JSON.stringify(before, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-14-board-ng.png' })

// 勾上「显示已隐藏」
await page.evaluate(() => {
  const label = [...document.querySelectorAll('.qcf-only')].find((c) => (c.textContent || '').includes('显示已隐藏'))
  const inp = label && label.querySelector('input')
  if (inp) inp.click()
})
await page.waitForTimeout(2500)
const after = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  return {
    rows: rows.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    hiddenBadges: rows.filter((r) => r.querySelector('.qcf-hidden-tag')).length,
    firstHidden: (() => {
      const r = rows.find((x) => x.querySelector('.qcf-hidden-tag'))
      if (!r) return null
      return {
        batch: text(r.querySelector('.qcf-batch')),
        nodes: [...r.querySelectorAll('.qcf-lane')][0] ? [...r.querySelectorAll('.qcf-node')].map(text) : [],
        tag: text(r.querySelector('.qcf-hidden-tag')),
      }
    })(),
  }
})
console.log('含已隐藏 =', JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-14-hidden-on.png' })
console.log('done')
