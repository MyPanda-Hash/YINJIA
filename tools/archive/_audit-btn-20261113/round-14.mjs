// round-14: 看清「币种 / 汇率 / 明细第1行仓库」三个必填项在 DOM 里的控件形态,
// 备好在测试账套里补齐它们再直审。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(500)
const dump = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const cells = [...document.querySelectorAll('.hdr-grid .fld, .header-fields .fld, .hd-field, .fld')].slice(0, 40).map((c) => ({
    label: text(c.querySelector('.fld-label, label')),
    inputTag: c.querySelector('input')?.tagName || '',
    inputVal: c.querySelector('input')?.value || '',
    isSelect: !!c.querySelector('.el-select'),
    readonly: !!c.querySelector('input[readonly]'),
  }))
  return {
    cells,
    detailFirstRow: [...document.querySelectorAll('.el-table__body tr')].slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => ({
      txt: text(td),
      sel: !!td.querySelector('.el-select'),
      inp: td.querySelector('input') ? (td.querySelector('input').value || '') : null,
    }))),
  }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-14.json', JSON.stringify(dump, null, 2), 'utf8')
console.log('cells=' + dump.cells.length + ' detailRows=' + dump.detailFirstRow.length)
