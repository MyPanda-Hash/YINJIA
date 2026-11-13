// round-15: 把单据表头区每个输入框/下拉映射成「标签 → 控件」清单,找到 币种 / 汇率 两个必填。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(500)
const dump = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const out = []
  for (const el of document.querySelectorAll('input, .el-select__wrapper')) {
    if (!el.offsetParent) continue
    const box = el.closest('td, .fld, .item, .cell, .hcell, .h-field, div')
    out.push({
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 40),
      value: el.tagName === 'INPUT' ? (el.value || '') : text(el),
      around: text(el.closest('td, .fld, .item, .cell, .hcell')).slice(0, 40),
      row: text(document.elementFromPoint(0, 0)?.parentElement || '').slice(0, 0),
    })
  }
  // 表头文本(用来定位「币种」「汇率」这两个标签在哪)
  const all = [...document.querySelectorAll('*')].filter((el) => {
    const t = text(el)
    return t === '币种' || t === '汇率' || t === '仓库'
  }).map((el) => ({
    tag: el.tagName,
    cls: (el.className || '').toString().slice(0, 40),
    parentHTML: (el.parentElement?.outerHTML || '').slice(0, 260),
  }))
  return { controls: out.slice(0, 40), labels: all.slice(0, 6) }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-15.json', JSON.stringify(dump, null, 2), 'utf8')
console.log('controls=' + dump.controls.length + ' labels=' + dump.labels.length)
