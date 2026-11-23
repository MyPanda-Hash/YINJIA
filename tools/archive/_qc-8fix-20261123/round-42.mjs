// round-42: 诊断查询对话框按钮命中区
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
console.log(JSON.stringify(await page.evaluate(() => {
  const b = document.querySelector('.header-query-dialog .el-dialog__footer button.el-button--primary')
  const r = b.getBoundingClientRect()
  const probe = (x, y) => { const el = document.elementFromPoint(x, y); return el ? { tag: el.tagName, cls: String(el.className).slice(0, 50), txt: (el.innerText || '').trim().slice(0, 8) } : null }
  const pts = []
  for (const dx of [0.2, 0.5, 0.8]) for (const dy of [0.2, 0.5, 0.8]) pts.push({ x: r.x + r.width * dx, y: r.y + r.height * dy, hit: probe(r.x + r.width * dx, r.y + r.height * dy) })
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    vw: window.innerWidth, vh: window.innerHeight,
    visual: window.visualViewport ? { w: window.visualViewport.width, h: window.visualViewport.height, scale: window.visualViewport.scale, top: window.visualViewport.pageTop } : null,
    pts,
  }
}), null, 1))
