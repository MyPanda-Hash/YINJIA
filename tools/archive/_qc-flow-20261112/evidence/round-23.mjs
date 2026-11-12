// round-23.mjs — 免检批次现在画成「免检跳过」小标(不再有"未生成"单据框),并核对提示文案
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/?v=skip1#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 关键字定位到用户截图里的那几张单
await page.evaluate(() => {
  const inp = document.querySelector('.qcf-kw input')
  if (!inp) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'SL-2026-10-0114')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  const btn = document.querySelector('.qcf-refresh')
  if (btn) btn.click()
})
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const row = document.querySelector('.qcf-grid-row')
  if (!row) return { rows: 0 }
  const chips = [...row.querySelectorAll('.qcf-skip-chip')].map((c) => ({ text: text(c), title: c.title }))
  const nodes = [...row.querySelectorAll('.qcf-node')].map((n) => ({ text: text(n), title: n.title }))
  return {
    rows: document.querySelectorAll('.qcf-grid-row').length,
    batch: text(row.querySelector('.qcf-batch')),
    stage: text(row.querySelector('.qcf-stage-tag')),
    chips,
    nodes,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-23-skip-node.png' })
console.log('done')
