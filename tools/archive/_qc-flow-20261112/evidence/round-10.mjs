// round-10.mjs — 8090(打包版:jar 内 static + 新后端 class)同一页复核,确认部署产物与源码版一致
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const state = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const r = document.querySelector('.qcf-grid-row')
  return {
    url: location.href,
    hasBoard: !!document.querySelector('.qcf-board'),
    title: text(document.querySelector('.qcf-title')),
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    rows: document.querySelectorAll('.qcf-grid-row').length,
    firstRow: r ? {
      batch: text(r.querySelector('.qcf-batch')),
      kv: [...r.querySelectorAll('.qcf-kv')].map(text),
      nodes: [...r.querySelectorAll('.qcf-node')].map(text),
      stage: text(r.querySelector('.qcf-stage-tag')),
    } : null,
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-10-8090.png' })
console.log('done')
