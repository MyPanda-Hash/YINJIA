const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.evaluate(() => { window.scrollTo(0, 0) })
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const inputs = [...document.querySelectorAll('.approval-sheet input, .approval-sheet textarea')].map((i) => i.value).filter(Boolean)
  const rows = [...document.querySelectorAll('.approval-sheet .as-row')].slice(0, 8).map((r) => {
    const b = r.getBoundingClientRect()
    return { text: txt(r).slice(0, 80), h: Math.round(b.height), w: Math.round(b.width) }
  })
  const sheet = document.querySelector('.approval-sheet')
  const sb = sheet ? sheet.getBoundingClientRect() : null
  return {
    inputs, rows,
    sheet: sb ? { w: Math.round(sb.width), h: Math.round(sb.height) } : null,
    scrollW: document.querySelector('.sheet-scroll')?.scrollWidth,
    clientW: document.querySelector('.sheet-scroll')?.clientWidth,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s18-bhc-paper.png', fullPage: false })
