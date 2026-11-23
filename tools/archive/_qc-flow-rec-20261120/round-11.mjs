/**
 * round-11(第二轮·并行规整):整页 reload 后量并列格几何 + 截图。
 * 判据:① 中间格两节点等宽等高;② 送料 / 中间格 / 入库三者垂直居中对齐;
 *      ③ 箭头中点与三格中线一致。
 */
const OUT = 'C:/Users/vigna/ego/qc-flow-rec-20261120'
const task = await taskSpace('qc-flow-rec-20261120')
const page = task.page('p1')

try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) { console.log('clearCache skip: ' + e.message) }
await page.goto('http://127.0.0.1:8091/?_r=' + Date.now(), { timeout: 40000 })
await page.waitForSelector('.qcf-page', { timeout: 40000 }).catch(() => {})
await page.waitForTimeout(2500)
await page.goto('http://127.0.0.1:8091/#/qc/flowMonitor', { timeout: 30000 })
await page.waitForSelector('.qcf-page', { timeout: 30000 })
await page.reload()
await page.waitForSelector('.qcf-page', { timeout: 30000 })
await page.waitForTimeout(3500)

// 用关键字定位一行「需检验 + 有检验数据记录」的批次
await page.evaluate(() => {
  const inp = document.querySelector('.qcf-kw input')
  if (!inp) return
  const setV = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setV.call(inp, 'JYSJ-2026-11-0003')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
})
await page.waitForTimeout(3500)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const m = await page.evaluate(() => {
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), cy: Math.round(b.y + b.height / 2) } }
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const row = rows.find((r) => r.querySelectorAll('.qcf-slot.is-par .qcf-node').length > 1)
  if (!row) return { rowCount: rows.length, note: '没有并列行' }
  const slots = [...row.querySelectorAll('.qcf-slot')]
  const arrows = [...row.querySelectorAll('.qcf-lane > .qcf-arrow')]
  const mid = slots[1]
  const nodes = [...mid.querySelectorAll('.qcf-node')]
  return {
    rowCount: rows.length,
    lane: box(row.querySelector('.qcf-lane')),
    slots: slots.map((s) => ({ cls: s.className, ...box(s) })),
    midNodes: nodes.map((n) => ({ no: n.querySelector('.qcf-node-no')?.textContent?.trim(), ...box(n) })),
    arrows: arrows.map((a) => box(a)),
    // 中线一致性:送料/中格/入库 三者的垂直中心
    centers: slots.map((s) => Math.round(s.getBoundingClientRect().y + s.getBoundingClientRect().height / 2)),
    equalSize: nodes.length === 2 && Math.abs(box(nodes[0]).w - box(nodes[1]).w) <= 1 && Math.abs(box(nodes[0]).h - box(nodes[1]).h) <= 1,
  }
})
console.log(JSON.stringify(m, null, 2))
await page.screenshot({ path: OUT + '/11-parallel-tidy.png' })
console.log('screenshot ->', OUT + '/11-parallel-tidy.png')
