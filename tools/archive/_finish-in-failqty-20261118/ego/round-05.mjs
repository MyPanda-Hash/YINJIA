const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')]
  const th = heads.find((h) => (h.innerText || '').includes('不合格数量'))
  const out = { found: !!th, scrollables: [] }
  if (th) {
    out.thBox = (() => { const r = th.getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width } })()
    let el = th.parentElement
    while (el && el !== document.documentElement) {
      const s = getComputedStyle(el)
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2) {
        out.scrollables.push({ cls: el.className, tag: el.tagName, sw: el.scrollWidth, cw: el.clientWidth, sl: el.scrollLeft })
      }
      el = el.parentElement
    }
  }
  return out
})
console.log(JSON.stringify(info, null, 2))
