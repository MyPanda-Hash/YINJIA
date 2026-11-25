// 第 10 轮:找列表选择器 → 选中 ZJ-2026-11-0012 → 只读态取证
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const probe = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const out = {}
  const cands = [...document.querySelectorAll('[class*="list"]')].slice(0, 20)
  out.classes = cands.map((c) => ({ cls: c.className, tag: c.tagName, first: txt(c).slice(0, 60) }))
  out.tables = [...document.querySelectorAll('table')].map((t) => ({ cls: t.className, rows: t.querySelectorAll('tbody tr').length, head: txt(t.querySelector('thead')).slice(0, 80) }))
  out.hasDocNo = document.body.innerText.includes('ZJ-2026-11-0012')
  return out
})
console.log(JSON.stringify(probe, null, 1).slice(0, 3000))
