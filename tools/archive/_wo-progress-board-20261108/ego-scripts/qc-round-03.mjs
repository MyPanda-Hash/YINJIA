// Round3:960 宽度横向溢出定位(Lead,2026-11-09)
const OUT = 'C:/Users/vigna/ego/wo-board-qc-lead-20261109'
const task = await taskSpace('wo-board-qc-lead-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(4000)
const diag = await page.evaluate(() => {
  const vw = window.innerWidth
  const bad = []
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width <= 0) return
    if (r.right > vw + 0.5 || r.left < -0.5) {
      const cls = typeof el.className === 'string' ? el.className : ''
      // 只收顶层几个,避免把内部叶子刷满
      if (['DIV', 'SECTION', 'HEADER', 'SPAN', 'BUTTON', 'INPUT', 'TABLE'].includes(el.tagName)) {
        bad.push({ tag: el.tagName, cls: cls.slice(0, 80), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) })
      }
    }
  })
  bad.sort((a, b) => b.right - a.right)
  return {
    vw,
    doc: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
    body: { client: document.body.clientWidth, scroll: document.body.scrollWidth },
    top: bad.slice(0, 15),
  }
})
console.log(JSON.stringify(diag, null, 2))
await task.finish({ keep: [] })
