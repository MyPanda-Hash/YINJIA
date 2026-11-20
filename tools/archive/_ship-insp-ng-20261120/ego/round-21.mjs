const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.approval-sheet .as-row')]
  const target = rows.find((r) => txt(r).includes('出货检验单号'))
  if (!target) return { err: 'row not found' }
  const kids = [...target.children].map((c) => {
    const b = c.getBoundingClientRect()
    return { cls: (c.className || '').toString(), text: txt(c).slice(0, 40), w: Math.round(b.width), h: Math.round(b.height) }
  })
  const refs = [...target.querySelectorAll('.as-ref-ctl')].map((c) => {
    const b = c.getBoundingClientRect()
    const cs = getComputedStyle(c)
    return { text: txt(c).slice(0, 30), w: Math.round(b.width), h: Math.round(b.height), widthCss: cs.width, display: cs.display, flexWrap: cs.flexWrap }
  })
  return { html: target.outerHTML.slice(0, 1200), kids, refs, rowW: Math.round(target.getBoundingClientRect().width) }
})
console.log(JSON.stringify(info, null, 2))
