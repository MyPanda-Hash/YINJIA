const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/?v=' + Date.now() + '#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(7000)
const box = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const cands = [...document.querySelectorAll('div,li,a,span')].filter((e) => txt(e) === '品质管理' && e.offsetParent)
  if (!cands.length) return null
  const el = cands[cands.length - 1]
  el.scrollIntoView({ block: 'center' })
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
await page.waitForTimeout(600)
if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(2500) }
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const nodes = [...document.querySelectorAll('div,li,a,span')].filter((e) => e.offsetParent && e.children.length === 0 && /出货检验|首件检验|巡线检验/.test(txt(e)))
  return { links: [...new Set(nodes.map((e) => txt(e)))].slice(0, 20), meta: nodes.slice(0, 6).map((e) => ({ t: txt(e), html: e.outerHTML.slice(0, 160) })) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s36-menu.png' })
