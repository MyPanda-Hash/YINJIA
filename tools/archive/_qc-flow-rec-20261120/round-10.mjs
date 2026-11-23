/**
 * round-10:整页 reload(清掉 keep-alive 残留的列表视图/关键字)后,用关键字定位一条带检验数据记录的批次,
 * 量主链中间格两个节点(来料检验单 / 检验数据记录)的宽度与位置。
 */
const OUT = 'C:/Users/vigna/ego/qc-flow-rec-20261120'
const task = await taskSpace('qc-flow-rec-20261120')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8091/#/qc/flowMonitor', { timeout: 40000 })
await page.reload()
await page.waitForSelector('.qcf-page', { timeout: 30000 })
await page.waitForTimeout(3500)

const before = await page.evaluate(() => ({
  mode: [...document.querySelectorAll('.el-radio-button__inner')].find((b) => b.classList.contains('is-active'))?.textContent?.trim(),
  rows: document.querySelectorAll('.qcf-grid-row').length,
  kw: document.querySelector('.qcf-kw input')?.value || '',
}))
console.log('before =', JSON.stringify(before))

await page.evaluate(() => {
  const inp = document.querySelector('.qcf-kw input')
  if (!inp) return
  const setV = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setV.call(inp, 'JYSJ-2026-10-0102')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
})
await page.waitForTimeout(3500)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const m = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } }
  const row = rows.find((r) => [...r.querySelectorAll('.qcf-slot')].some((s) => s.querySelectorAll('.qcf-node').length > 1))
  const out = { rowCount: rows.length }
  if (!row) { out.note = '没有并列行'; return out }
  const slots = [...row.querySelectorAll('.qcf-slot')]
  out.lane = box(row.querySelector('.qcf-lane'))
  out.slots = slots.map((s) => ({ cls: s.className, ...box(s) }))
  out.midNodes = [...slots[1].querySelectorAll('.qcf-node')].map((n) => ({
    text: n.querySelector('.qcf-node-no')?.textContent?.trim(),
    ...box(n),
  }))
  return out
})
console.log(JSON.stringify(m, null, 2))
await page.screenshot({ path: OUT + '/10-parallel-metrics.png' })
console.log('done')
