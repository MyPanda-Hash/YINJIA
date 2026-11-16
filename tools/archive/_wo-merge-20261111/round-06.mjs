// round-06:把日期范围改宽(2026-09-01 ~ 2026-10-31)→ 查询 → 找 XQ-20260924-01 的行
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(800)

// 1) 点开日期范围输入框,直接键入起止日期
const inputs = await page.evaluate(() => {
  const els = [...document.querySelectorAll('input.el-range-input')]
  return els.map((e) => e.value)
})
console.log('date before:', JSON.stringify(inputs))
const box = await page.evaluate(() => {
  const el = document.querySelector('input.el-range-input')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('first input box:', JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(800)
  await page.keyboard.type('2026-09-01', { delay: 60 })
  await page.waitForTimeout(300)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)
  await page.keyboard.type('2026-10-31', { delay: 60 })
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
}
// 2) 点「查询」
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '查询')
  if (b) { b.click(); return true }
  return false
})
console.log('query clicked:', clicked)
await page.waitForTimeout(6000)
const info = await page.evaluate(() => ({
  dateRange: [...document.querySelectorAll('input.el-range-input')].map((i) => i.value),
  total: (() => { const t = document.body.innerText.match(/共有数据[:：]\s*(\d+)/); return t ? t[1] : null })(),
  orderNos: [...new Set([...document.querySelectorAll('.el-table__body tr')].map((tr) => (tr.querySelectorAll('td')[1] || {}).innerText || '').map((s) => s.split(' ')[0]))],
  rows: [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())).filter((c) => (c[1] || '').includes('XQ-20260924-01')),
}))
console.log(JSON.stringify(info, null, 2).slice(0, 8000))
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_wo-merge-20261111/round-06-list.png' })
  console.log('screenshot ok')
} catch (e) { console.log('screenshot fail: ' + e.message) }
