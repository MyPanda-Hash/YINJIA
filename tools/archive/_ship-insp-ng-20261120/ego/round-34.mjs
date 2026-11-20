const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
// 找到侧栏「品质管理」的节点并 hover
const box = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cands = [...document.querySelectorAll('div,li,a,span')].filter((e) => txt(e) === '品质管理' && e.offsetParent)
  if (!cands.length) return null
  const el = cands[cands.length - 1]
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), cls: (el.className || '').toString() }
})
console.log('BOX', JSON.stringify(box))
if (box) {
  await page.mouse.move(box.x, box.y)
  await page.waitForTimeout(500)
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(2500)
}
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('div,li,a,span')].filter((e) => e.offsetParent && e.children.length === 0 && /出货检验|首件检验|巡线检验|出厂检验|来料检验|不合格/.test(txt(e))).map((e) => txt(e))
  return { links: [...new Set(vis)].slice(0, 30) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s34-menu-open.png' })
