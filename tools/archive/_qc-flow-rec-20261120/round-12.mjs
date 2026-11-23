/**
 * round-12:勾「仅需检验」后取并列行,量几何 + 截图(并行规整验收)。
 */
const OUT = 'C:/Users/vigna/ego/qc-flow-rec-20261120'
const task = await taskSpace('qc-flow-rec-20261120')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8091/#/qc/flowMonitor', { timeout: 40000 })
await page.reload()
await page.waitForSelector('.qcf-page', { timeout: 30000 })
await page.waitForTimeout(3000)

const clicked = await page.evaluate(() => {
  const lab = [...document.querySelectorAll('.qcf-only')].find((l) => (l.textContent || '').includes('仅需检验'))
  const input = lab?.querySelector('input[type="checkbox"]')
  if (input && !input.checked) { input.click(); return true }
  return false
})
console.log('clicked 仅需检验 =', clicked)
await page.waitForTimeout(3500)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const m = await page.evaluate(() => {
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } }
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const row = rows.find((r) => r.querySelectorAll('.qcf-slot.is-par .qcf-node').length > 1)
  if (!row) return { rowCount: rows.length, note: '没有并列行' }
  const slots = [...row.querySelectorAll('.qcf-slot')]
  const arrows = [...row.querySelectorAll('.qcf-lane > .qcf-arrow')]
  const nodes = [...slots[1].querySelectorAll('.qcf-node')]
  const cy = (el) => Math.round(el.getBoundingClientRect().y + el.getBoundingClientRect().height / 2)
  return {
    rowCount: rows.length,
    slots: slots.map((s) => ({ cls: s.className, ...box(s), cy: cy(s) })),
    midNodes: nodes.map((n) => ({ no: n.querySelector('.qcf-node-no')?.textContent?.trim(), ...box(n) })),
    arrows: arrows.map((a) => ({ ...box(a), cy: cy(a) })),
    equalSize: nodes.length === 2 && Math.abs(box(nodes[0]).w - box(nodes[1]).w) <= 1 && Math.abs(box(nodes[0]).h - box(nodes[1]).h) <= 1,
    centred: new Set([cy(slots[0]), cy(slots[1]), cy(slots[2])]).size === 1,
  }
})
console.log(JSON.stringify(m, null, 2))
await page.screenshot({ path: OUT + '/12-parallel-tidy.png' })
console.log('screenshot ->', OUT + '/12-parallel-tidy.png')
