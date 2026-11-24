const task = await taskSpace(33)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_SAMPLE_EXT')
await page.waitForSelector('.as-side-btn', { timeout: 25000 })
await page.waitForTimeout(600)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
  if (b) b.click()
})
await page.waitForFunction(() => document.querySelectorAll('.apv-panel').length === 1, undefined, { timeout: 10000 })
const mask = await page.evaluate(() => {
  const m = document.querySelector('.apv-mask')
  const p = document.querySelector('.apv-panel')
  const cs = getComputedStyle(m)
  const r = m.getBoundingClientRect()
  const pr = p.getBoundingClientRect()
  return {
    bg: cs.backgroundColor, position: cs.position, inset: [cs.top, cs.right, cs.bottom, cs.left], z: cs.zIndex,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    panel: { x: pr.x, y: pr.y, w: pr.width, h: pr.height },
    vw: innerWidth, vh: innerHeight,
    topLeftStack: (() => {
      const el = document.elementFromPoint(10, 500)
      return el ? el.className || el.tagName : null
    })(),
  }
})
console.log(JSON.stringify(mask, null, 1))
