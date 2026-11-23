// round-32: 鼠标点「单据编号」输入框 + 键盘输入 + 鼠标点「查询」
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const rectOf = (sel, text) => page.evaluate(({ sel, text }) => {
  const els = [...document.querySelectorAll(sel)].filter((n) => (n.textContent || '').trim() === text)
  const el = els[0]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }
}, { sel, text })
// 单据编号 label → 同一 field 容器里的 input
const box = await page.evaluate(() => {
  const lab = [...document.querySelectorAll('.el-form-item__label, label, .filter-label')].find((l) => (l.textContent || '').trim() === '单据编号')
  let p = lab
  for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
    const inp = p.querySelector && p.querySelector('input.el-input__inner')
    if (inp) { const r = inp.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }
  }
  // 退化:label 下方 30px
  const r = lab.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + 34 }
})
console.log('input box:', JSON.stringify(box))
await page.mouse.click(box.x, box.y, { label: 'focus 单据编号 filter' })
await page.waitForTimeout(400)
await page.keyboard.insertText('ZC-2026-11-0008')
await page.waitForTimeout(500)
const btn = await rectOf('button, .el-button', '查询')
console.log('query btn:', JSON.stringify(btn))
if (btn) await page.mouse.click(btn.cx, btn.cy, { label: 'click 查询' })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  queryAreaText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
  total: (document.body.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
  rowCount: document.querySelectorAll('.el-table__body tr').length,
  firstRow: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  inputVal: [...document.querySelectorAll('input.el-input__inner')].map((i) => i.value).filter(Boolean).slice(0, 8),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-32-detail-query.png' })
