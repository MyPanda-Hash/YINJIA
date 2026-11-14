// round-19.mjs — 全量 502 行渲染性能与终版截图
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/?v=ng6#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const pickState = async (label) => {
  await page.evaluate(() => {
    const inp = document.querySelector('.qcf-sel input')
    if (inp) inp.click()
  })
  await page.waitForTimeout(600)
  const ok = await page.evaluate((label) => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => (o.textContent || '').trim() === label)
    if (opt) { opt.click(); return true }
    return false
  }, label)
  await page.waitForTimeout(2500)
  return ok
}
console.log('切到 全部 =', await pickState('全部'))

const snap = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const t0 = performance.now()
  const rows = document.querySelectorAll('.qcf-grid-row').length
  const nodes = document.querySelectorAll('.qcf-node').length
  return {
    rows, nodes,
    measureMs: Math.round(performance.now() - t0),
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    hiddenBadges: document.querySelectorAll('.qcf-hidden-tag').length,
    ngLanes: document.querySelectorAll('.qcf-lane-ng').length,
    domNodes: document.getElementsByTagName('*').length,
  }
})
console.log('全量渲染 =', JSON.stringify(snap, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-19-all-502.png' })

// 滚动到底部测一下响应(取最后一行的文本)
const bottom = await page.evaluate(() => {
  const body = document.querySelector('.qcf-grid-body')
  if (body) body.scrollTop = body.scrollHeight
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const last = rows[rows.length - 1]
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return { count: rows.length, last: last ? text(last).slice(0, 160) : null }
})
console.log('滚到底 =', JSON.stringify(bottom))
