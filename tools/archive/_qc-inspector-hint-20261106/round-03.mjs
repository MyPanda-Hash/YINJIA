const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 45000 })
await page.waitForTimeout(9000)

const nav = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent || '').replace(/\s+/g, '').trim()
    if ((t === '▶' || t === '▷' || t === '◀' || t === '◁') && el.children.length === 0) {
      const r = el.getBoundingClientRect()
      out.push({ t, tag: el.tagName, cls: String(el.className).slice(0, 50), w: Math.round(r.width), title: el.getAttribute('title') })
    }
  }
  return out
})
console.log('导航键: ' + JSON.stringify(nav, null, 2))
