const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('.approval-sheet')
  return {
    sheetW: Math.round(sheet.getBoundingClientRect().width),
    sheetH: Math.round(sheet.getBoundingClientRect().height),
    rows: [...sheet.querySelectorAll('.as-row')].slice(0, 5).map((r) => ({ t: txt(r).slice(0, 34), h: Math.round(r.getBoundingClientRect().height) })),
    refs: [...sheet.querySelectorAll('.as-ref-ctl')].map((c) => ({ t: txt(c).slice(0, 24), w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) })),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s25-bhc-542.png' })
