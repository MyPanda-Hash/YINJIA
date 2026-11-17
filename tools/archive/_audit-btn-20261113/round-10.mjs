// round-10: 测试库 —— 采购订单左栏找草稿单并选中,读工具栏「审核」是否可点。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(7000)

const dump = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => text(td))
    return { no: cells[1], supplier: cells[3], status: cells[cells.length - 1] }
  })
  return {
    factory: text(document.querySelector('.factory-name')),
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: text(g.querySelector('.tb-main')),
      disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
    })),
    rows,
    statusSet: [...new Set(rows.map((r) => r.status))],
    drafts: rows.filter((r) => r.status === '草稿'),
  }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-10.json', JSON.stringify(dump, null, 2), 'utf8')
console.log('drafts=' + dump.drafts.length + ' statuses=' + JSON.stringify(dump.statusSet) + ' url=' + await page.url())
