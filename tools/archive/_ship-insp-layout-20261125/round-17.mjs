// 第 17 轮:找「已完成」页签的正确元素并点它
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const hits = [...document.querySelectorAll('*')].filter((e) => txt(e) === '已完成' && e.children.length === 0)
  return hits.map((e) => ({
    tag: e.tagName, cls: e.className, parentCls: e.parentElement?.className,
    rect: (() => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })(),
  }))
})
console.log(JSON.stringify(probe, null, 1))
// 点最像页签的那一个(在 .doc-select-rail 里)
const clicked = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rail = document.querySelector('.doc-select-rail') || document.body
  const el = [...rail.querySelectorAll('*')].find((e) => txt(e) === '已完成' && e.children.length === 0)
  if (!el) return false
  el.click(); return true
})
console.log('clicked: ' + clicked)
await page.waitForTimeout(4000)
const rows = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].slice(0, 5).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)))
console.log('rows: ' + JSON.stringify(rows))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-17.png' })
