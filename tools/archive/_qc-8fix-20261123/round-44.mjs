// round-44: 横向滚动 + 鼠标点新批次格
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.reload({ timeout: 60000 })
await page.waitForTimeout(7000)
const row = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0005'))
  if (!tr) return null
  const r = tr.getBoundingClientRect()
  return { x: r.x + 40, y: r.y + r.height / 2 }
})
await page.mouse.click(row.x, row.y, { label: 'select draft' })
await page.waitForTimeout(2500)
// 添加批次
const add = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act')].find((x) => (x.innerText || '').includes('添加批次'))
  const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.click(add.x, add.y, { label: 'add batch' })
await page.waitForTimeout(1200)
const before = await page.evaluate(() => {
  const s = document.querySelector('.qr-grid-scroll')
  const r = s.getBoundingClientRect()
  return { left: s.scrollLeft, sw: s.scrollWidth, cw: s.clientWidth, x: r.x + r.width / 2, y: r.y + r.height / 2, rect: { x: r.x, y: r.y, w: r.width, h: r.height } }
})
console.log('scroll before:', JSON.stringify(before))
// 鼠标移到表格中间, 用横向滚轮(shift+wheel 或 deltaX)
await page.mouse.move(before.x, before.y, { label: 'hover grid' })
await page.mouse.wheel(400, 0)
await page.waitForTimeout(800)
const after = await page.evaluate(() => ({ left: document.querySelector('.qr-grid-scroll').scrollLeft }))
console.log('scroll after wheel(400,0):', JSON.stringify(after))
// 取批次格 rect(滚动后)
const cells = await page.evaluate(() => {
  const tr = document.querySelector('.qr-grid tbody tr')
  return [...tr.querySelectorAll('td')].map((td, ci) => {
    const ta = td.querySelector('textarea')
    const r = (ta || td).getBoundingClientRect()
    return { ci, x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.x >= 0 && r.x + r.width <= window.innerWidth, val: ta ? ta.value : (td.innerText || '').trim().slice(0, 8) }
  })
})
console.log('cells:', JSON.stringify(cells))
