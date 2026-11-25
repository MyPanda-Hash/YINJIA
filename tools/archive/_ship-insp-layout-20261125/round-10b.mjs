// 第 10b 轮:找列表选择器(健壮版)
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const probe = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tables = [...document.querySelectorAll('table')].map((t) => ({
    cls: t.className, rows: t.querySelectorAll('tbody tr').length,
    head: txt(t.querySelector('thead')).slice(0, 90),
  }))
  const trHit = [...document.querySelectorAll('tr')].filter((tr) => txt(tr).includes('ZJ-2026-11-0012')).map((tr) => ({
    cls: tr.className, parentCls: tr.parentElement?.className, cells: [...tr.children].map((c) => txt(c).slice(0, 24)),
  }))
  return { tables, trHit, bodyHas: document.body.innerText.includes('ZJ-2026-11-0012'), listHtml: (document.querySelector('.doc-rail, .rail, .panelx-list')?.outerHTML || '').slice(0, 200) }
})
console.log(JSON.stringify(probe, null, 1).slice(0, 4000))
