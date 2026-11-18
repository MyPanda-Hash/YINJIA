const task = await taskSpace(17)
const page = task.page('p1')
const html = await page.evaluate(() => {
  const el = document.querySelector('.factory')
  if (!el) return null
  let p = el
  for (let i = 0; i < 3 && p.parentElement; i++) p = p.parentElement
  return p.outerHTML.slice(0, 2000)
})
console.log(html)
const opened = await page.evaluate(() => {
  const el = document.querySelector('.factory')
  if (!el) return 'no .factory'
  const rect = el.getBoundingClientRect()
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
})
console.log(JSON.stringify(opened))
if (opened && opened.x !== undefined) {
  await page.mouse.click(opened.x + Math.min(40, opened.w / 2), opened.y + opened.h / 2, { label: 'open factory menu' })
}
await page.waitForTimeout(1200)
const items = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return [...document.querySelectorAll('.factory-item')].map((el) => {
    const r = el.getBoundingClientRect()
    return { text: txt(el), visible: !!(el.offsetWidth || el.offsetHeight), x: r.x, y: r.y, w: r.width, h: r.height }
  })
})
console.log(JSON.stringify(items, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-07-factory-open.png' })
