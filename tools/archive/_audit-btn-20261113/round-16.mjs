// round-16: 明细表头列名 + 第一行每个单元格的控件形态(找到「仓库」那一格怎么填)。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(400)
const dump = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const heads = [...document.querySelectorAll('.grid table thead th, table thead th')].map((th) => text(th))
  const row = document.querySelector('.grid table tbody tr, table tbody tr')
  const cells = row ? [...row.querySelectorAll('td')].map((td) => ({
    txt: text(td).slice(0, 24),
    select: !!td.querySelector('.el-select'),
    input: td.querySelector('input') ? String(td.querySelector('input').value || '') : null,
    ref: !!td.querySelector('[class*="ref"]'),
    html: (td.innerHTML || '').slice(0, 120),
  })) : []
  return { heads, cells }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-16.json', JSON.stringify(dump, null, 2), 'utf8')
console.log('heads=' + dump.heads.length + ' cells=' + dump.cells.length)
