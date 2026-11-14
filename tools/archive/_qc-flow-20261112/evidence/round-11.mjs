// round-11.mjs — 检验结论三档(合格/部分不合格/不合格)复核 + 终版截图
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 找一行既合格又不合格(部分不合格)的,确认徽标/文案
const info = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const partial = rows.find((r) => /不合格/.test(text(r)) && /合格 \d+ \/ 不合格/.test(text(r)))
  const pick = partial || rows[0]
  return {
    rows: rows.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    sample: pick ? {
      batch: text(pick.querySelector('.qcf-batch')),
      nodes: [...pick.querySelectorAll('.qcf-node')].map(text),
      verdict: [...pick.querySelectorAll('.qcf-verdict')].map((v) => ({ text: text(v), cls: v.className })),
      stage: text(pick.querySelector('.qcf-stage-tag')),
    } : null,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-11-final.png' })
console.log('done')
