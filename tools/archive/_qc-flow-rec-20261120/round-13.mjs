/**
 * round-13:并列格文字/边框是否被裁 + 取一张流程列的特写(有 clip 就裁,没有就整屏)。
 */
const OUT = 'C:/Users/vigna/ego/qc-flow-rec-20261120'
const task = await taskSpace('qc-flow-rec-20261120')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8091/#/qc/flowMonitor', { timeout: 40000 })
await page.reload()
await page.waitForSelector('.qcf-page', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const lab = [...document.querySelectorAll('.qcf-only')].find((l) => (l.textContent || '').includes('仅需检验'))
  const input = lab?.querySelector('input[type="checkbox"]')
  if (input && !input.checked) input.click()
})
await page.waitForTimeout(3500)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const clipInfo = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.qcf-grid-row')].find((r) => r.querySelectorAll('.qcf-slot.is-par .qcf-node').length > 1)
  if (!row) return null
  const group = row.querySelector('.qcf-slot.is-par')
  const nodes = [...group.querySelectorAll('.qcf-node')]
  const lane = row.querySelector('.qcf-lane')
  const lb = lane.getBoundingClientRect()
  return {
    clip: { x: Math.round(lb.x) - 8, y: Math.round(lb.y) - 8, width: Math.round(lb.width) + 16, height: Math.round(lb.height) + 16 },
    nodes: nodes.map((n) => ({
      no: n.querySelector('.qcf-node-no')?.textContent?.trim(),
      clientH: n.clientHeight,
      scrollH: n.scrollHeight,
      clipped: n.scrollHeight > n.clientHeight + 1,
      lastText: n.lastElementChild?.textContent?.trim(),
    })),
    groupBox: (() => { const b = group.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) } })(),
  }
})
console.log(JSON.stringify(clipInfo, null, 2))
try {
  await page.screenshot({ path: OUT + '/13-parallel-closeup.png', clip: clipInfo.clip })
  console.log('closeup ok')
} catch (e) {
  console.log('clip unsupported: ' + e.message)
  await page.screenshot({ path: OUT + '/13-parallel-closeup.png' })
}
console.log('done')
